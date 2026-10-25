// The Health area's data (T141, US5): every approved health series, the owner's lab results and
// manual Garmin figures, the evaluated goals' targets, and the runs' watches (for the HRV note),
// for `today` (Europe/London). Memoised per store and day. The test-only health preview
// (SHELL_PREVIEW=1) passes a store of synthetic data through the same code.
//
// Owner exclusions (health-exclusions.yaml, FR-067) are removed by the processor before the series
// are published, so nothing here needs to drop them again.
import { today as londonToday } from '../../../shared/format/dates.ts';
import type { DatedValue } from '../domain/composition.ts';
import { dailyMetric, fitnessSeries, fitnessStart, goalFor, hrvStart, predictionRows, type DailyMetric, type FitnessPoint, type HrvStart, type PredictionRow } from '../domain/health.ts';
import type { GoalEvaluation, ValueEvaluation } from '../domain/goals.ts';
import { trainingStatusHistory, type CurrentTrainingStatus } from '../domain/manual-metrics.ts';
import { loadGoals } from './goals.ts';
import { runningStore } from './load.ts';
import type { HealthMetric, LabMeasurement, RunningStore } from './store/index.ts';

export interface HealthData {
  today: string;
  /** Published 7-day average only (FR-061). */
  weight: DatedValue[];
  bodyFat: DailyMetric;
  vo2max: DatedValue[];
  restingHr: DailyMetric;
  hrv: DailyMetric;
  /** HRV baseline band points, only where the published series has them (intervals.icu: none). */
  hrvBaseline: { date: string; low: number; high: number }[];
  hrvStart: HrvStart | undefined;
  /** Every day with fitness and fatigue (the chart slices from `fitnessStart.chartStart`). */
  fitness: FitnessPoint[];
  fitnessStart: { historyStart: string; chartStart: string } | undefined;
  goals: { weight?: ValueEvaluation; bodyFat?: ValueEvaluation; vo2max?: ValueEvaluation; restingHr?: ValueEvaluation; hrv?: ValueEvaluation };
  /** Oldest first. */
  lab: LabMeasurement[];
  /** Oldest first; the latest is current. */
  trainingStatus: CurrentTrainingStatus[];
  predictions: PredictionRow[];
  /** Dated race-prediction entries (any distance). */
  predictionEntries: number;
  evaluations: GoalEvaluation[];
}

const cache = new WeakMap<RunningStore, Map<string, Promise<HealthData>>>();

export function loadHealth(today: string = londonToday(), store: RunningStore = runningStore()): Promise<HealthData> {
  let byDay = cache.get(store);
  if (!byDay) cache.set(store, (byDay = new Map()));
  let data = byDay.get(today);
  if (!data) {
    data = load(today, store);
    byDay.set(today, data);
  }
  return data;
}

async function load(today: string, store: RunningStore): Promise<HealthData> {
  const series = async (metric: HealthMetric) => (await store.getHealthSeries(metric, { to: today })).map(({ date, value }) => ({ date, value }));
  const [owner, runs, { evaluations }, weight, bodyFat, vo2max, restingHr, hrvPoints, ctl, atl] = await Promise.all([
    store.getOwner(),
    store.listRuns(),
    loadGoals(today, store),
    series('weight_avg7'),
    series('body_fat_pct'),
    series('vo2max'),
    series('resting_hr'),
    store.getHealthSeries('hrv', { to: today }),
    series('fitness_ctl'),
    series('fatigue_atl'),
  ]);
  const hrv = hrvPoints.map(({ date, value }) => ({ date, value }));
  return {
    today,
    weight,
    bodyFat: dailyMetric(bodyFat),
    vo2max,
    restingHr: dailyMetric(restingHr),
    hrv: dailyMetric(hrv),
    hrvBaseline: hrvPoints.flatMap((p) => (p.baseline_low !== undefined && p.baseline_high !== undefined ? [{ date: p.date, low: p.baseline_low, high: p.baseline_high }] : [])),
    hrvStart: hrvStart(hrv, runs),
    fitness: fitnessSeries(ctl, atl),
    fitnessStart: fitnessStart(ctl),
    goals: {
      ...opt('weight', goalFor(evaluations, 'weight_kg')),
      ...opt('bodyFat', goalFor(evaluations, 'body_fat_pct')),
      ...opt('vo2max', goalFor(evaluations, 'vo2max')),
      ...opt('restingHr', goalFor(evaluations, 'resting_hr')),
      ...opt('hrv', goalFor(evaluations, 'hrv')),
    },
    lab: owner.lab,
    trainingStatus: trainingStatusHistory(owner.manualMetrics),
    predictions: predictionRows(owner.manualMetrics, evaluations),
    predictionEntries: owner.manualMetrics.race_predictions.length,
    evaluations,
  };
}

const opt = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>));
