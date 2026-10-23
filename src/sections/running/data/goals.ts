// Goals from the store (T089/T091): gathers runs, races, overrides, health series and the manual
// Garmin figures, and evaluates every goal for `today` (Europe/London). Shared by the Goals page
// and, later, the landing page's featured goals (US1). Memoised per build and day.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { buildEffortIndex } from '../domain/efforts.ts';
import { evaluateGoals, type GoalEvaluation, type GoalHealth, type ValueMetric } from '../domain/goals.ts';
import { latestManualMetrics } from '../domain/manual-metrics.ts';
import type { HealthMetric } from '../../../shared/storage/index.ts';
import { runningStore, sectionSettings } from './load.ts';

export interface GoalsData {
  evaluations: GoalEvaluation[];
  today: string;
}

const HEALTH: Record<ValueMetric, HealthMetric> = {
  weight_kg: 'weight_avg7',
  body_fat_pct: 'body_fat_pct',
  vo2max: 'vo2max',
  resting_hr: 'resting_hr',
  hrv: 'hrv',
};

const cache = new Map<string, Promise<GoalsData>>();

/** Every non-retired goal, evaluated for `today` (default: today in Europe/London). */
export function loadGoals(today: string = londonToday()): Promise<GoalsData> {
  let data = cache.get(today);
  if (!data) {
    data = evaluate(today);
    cache.set(today, data);
  }
  return data;
}

async function evaluate(today: string): Promise<GoalsData> {
  const store = runningStore();
  const [owner, runs, settings] = await Promise.all([store.getOwner(), store.listRuns(), sectionSettings()]);
  const health: GoalHealth = {};
  for (const [metric, series] of Object.entries(HEALTH) as [ValueMetric, HealthMetric][]) {
    health[metric] = (await store.getHealthSeries(series)).map(({ date, value }) => ({ date, value }));
  }
  const evaluations = evaluateGoals({
    goals: owner.goals,
    efforts: buildEffortIndex(runs, owner.races, owner.overrides),
    health,
    manual: latestManualMetrics(owner.manualMetrics),
    upcomingRaces: owner.upcomingRaces,
    today,
    highlightDays: settings.recent_highlight_days.goal,
  });
  return { evaluations, today };
}

/** Tests swap the store; this drops evaluations made over the old one. */
export function clearGoalsCache(): void {
  cache.clear();
}
