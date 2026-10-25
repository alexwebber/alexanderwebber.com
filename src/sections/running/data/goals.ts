// Goals from the store (T089/T091): gathers runs, races, overrides, health series and the manual
// Garmin figures, and evaluates every goal for `today` (Europe/London). Shared by the Goals page,
// the landing page's featured goals (US1) and the health page's targets (US5). Memoised per store
// and day; the test-only health preview passes its own store of synthetic data.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { buildEffortIndex } from '../domain/efforts.ts';
import { evaluateGoals, type GoalEvaluation, type GoalHealth, type ValueMetric } from '../domain/goals.ts';
import { latestManualMetrics } from '../domain/manual-metrics.ts';
import { runningStore, sectionSettings } from './load.ts';
import { perStoreAndDay } from './memo.ts';
import type { HealthMetric, RunningStore } from './store/index.ts';

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

/** Every non-retired goal, evaluated for `today` (default: today in Europe/London). */
export function loadGoals(today: string = londonToday(), store: RunningStore = runningStore()): Promise<GoalsData> {
  return evaluate(today, store);
}

const evaluate = perStoreAndDay(async (today, store): Promise<GoalsData> => {
  const [owner, runs, settings] = await Promise.all([store.getOwner(), store.listRuns(), sectionSettings(store)]);
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
});
