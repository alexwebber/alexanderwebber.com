// Goal evaluation (T089; FR-033..042, data-model §5). Pure: everything, including "today"
// (a Europe/London YYYY-MM-DD date), is passed in, so tests pin it.
//
// - race_time: achieved on the first date with an eligible effort under the target at the goal
//   distance (the effort time rounded to the second, so a displayed "20:00" never counts as under
//   20:00). Progress is the gap from the fastest effort to the target; the bar shows the target
//   time as a share of the fastest time (100% once it's beaten). For 5k, 10k, half and marathon
//   the owner's latest Garmin prediction is attached with its as-of date (FR-038, FR-069).
// - body_composition: achieved on the first date the 7-day average reaches the target in the
//   stated direction (weight: published weight_avg7; body fat: build-time mean, composition.ts).
// - metric: achieved on the first date the recorded value reaches the target.
// - milestone: achieved only by the owner's achieved_override.
// - achieved_override wins over everything; status_override "active" ignores an automatic
//   achievement. "First date" is order-based, so a later regression never un-achieves a goal.
// - created: when a goal has one, only data from that date counts, for achievement and progress,
//   so an import of older history can't achieve a goal (or move its start) years back.
// - deadline < today, unachieved: deadline_passed. Retired goals are left out entirely.
// - Progress for value goals: (current - start) / (target - start), clamped 0..1. Start is
//   start_value (dated by start_date when given), else the first reading on/after created, else the
//   first reading in the series. all_time_start is a reference only ("32.1 kg down since ...").
// - Newly achieved: achieved within recent_highlight_days.goal days (FR-042); they lead the
//   landing page's featured goals for that window (owner, 2026-10-23).
import { daysBetween } from '../../../shared/format/dates.ts';
import { parseDistance, parseTime } from '../../../shared/format/parse.ts';
import type { Goal, UpcomingRace } from '../../../shared/storage/index.ts';
import { bodyFatAverage, type DatedValue } from './composition.ts';
import { effortsAt, type Effort, type EffortIndex } from './efforts.ts';
import { predictionDistanceFor, type CurrentManualMetrics, type Prediction } from './manual-metrics.ts';

export type GoalStatus = 'active' | 'achieved' | 'deadline_passed';
export type ValueMetric = 'weight_kg' | 'body_fat_pct' | 'vo2max' | 'resting_hr' | 'hrv';

export interface Achievement {
  date: string;
  by: 'effort' | 'reading' | 'override';
  effort?: Effort;
  /** For body-composition goals, the 7-day average on that day. */
  reading?: DatedValue;
  note?: string;
}

interface Common {
  goal: Goal;
  status: GoalStatus;
  achievement?: Achievement;
  /** Achieved within the highlight window (FR-042). */
  newlyAchieved: boolean;
  /** Whole days from today to the deadline; negative once it has passed. */
  daysToDeadline?: number;
  /** The upcoming race the goal links to. */
  linkedRace?: UpcomingRace;
}

export interface RaceTimeEvaluation extends Common {
  kind: 'race_time';
  distance_m: number;
  target_s: number;
  /** The fastest eligible effort at the distance; undefined: no data yet. */
  fastest?: Effort;
  /** Fastest minus target, in whole seconds (positive: still slower than the target). */
  gap_s?: number;
  /** Target time as a share of the fastest time, clamped 0..1. */
  fraction?: number;
  /** The owner's latest Garmin prediction at this distance; undefined when none is recorded. */
  prediction?: Prediction;
}

export interface ValueEvaluation extends Common {
  kind: 'value';
  metric: ValueMetric;
  direction: 'at_most' | 'at_least';
  target: number;
  /** Judged on the 7-day average (body composition) rather than the recorded value. */
  averaged: boolean;
  start?: number;
  /** The start's date: start_date, or the first reading's; undefined for an undated start_value. */
  startDate?: string;
  /** The owner's earlier reference reading (all_time_start), shown as the change since it. */
  allTimeStart?: DatedValue;
  /** The value progress and achievement are judged on (latest 7-day average or recorded value). */
  current?: DatedValue;
  /** The headline figure, the same as `current` (body composition: its 7-day average, FR-061). */
  latest?: DatedValue;
  fraction?: number;
}

export interface MilestoneEvaluation extends Common {
  kind: 'milestone';
}

export type GoalEvaluation = RaceTimeEvaluation | ValueEvaluation | MilestoneEvaluation;

/** Health series as published, oldest first (weight is `weight_avg7`; the rest as recorded). */
export type GoalHealth = Partial<Record<ValueMetric, readonly DatedValue[]>>;

export interface GoalInputs {
  goals: readonly Goal[];
  efforts: EffortIndex;
  health: GoalHealth;
  manual: CurrentManualMetrics;
  upcomingRaces?: readonly UpcomingRace[];
  /** Europe/London date, YYYY-MM-DD. */
  today: string;
  /** recent_highlight_days.goal */
  highlightDays: number;
}

const reaches = (value: number, target: number, direction: 'at_most' | 'at_least') =>
  direction === 'at_most' ? value <= target : value >= target;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Every goal that isn't retired, evaluated. Order follows the input. */
export function evaluateGoals(inputs: GoalInputs): GoalEvaluation[] {
  return inputs.goals.filter((goal) => !goal.retired).map((goal) => evaluateGoal(goal, inputs));
}

export function evaluateGoal(goal: Goal, inputs: GoalInputs): GoalEvaluation {
  const linkedRace = goal.linked_race ? inputs.upcomingRaces?.find((r) => r.id === goal.linked_race) : undefined;
  const base = { goal, ...(linkedRace ? { linkedRace } : {}) };
  let evaluation: Record<string, unknown> & { kind: GoalEvaluation['kind'] };
  let automatic: Achievement | undefined;

  switch (goal.type) {
    case 'race_time': {
      const distance = parseDistance(goal.target.distance ?? goal.target.distance_m ?? NaN);
      const target = parseTime(goal.target.time);
      // The schema and validate-data reject both before a build gets here.
      if (distance === undefined || target === undefined) throw new Error(`goal "${goal.id}": invalid target`);
      const efforts = effortsAt(inputs.efforts, distance).filter((e) => !goal.created || e.date >= goal.created);
      const qualifying = efforts.filter((e) => Math.round(e.time_s) < target);
      const first = qualifying[0];
      if (first) {
        const sameDay = qualifying.filter((e) => e.date === first.date);
        const effort = sameDay.reduce((a, b) => (b.time_s < a.time_s ? b : a));
        automatic = { date: effort.date, by: 'effort', effort };
      }
      const fastest = efforts.reduce<Effort | undefined>((best, e) => (!best || e.time_s < best.time_s ? e : best), undefined);
      const predictionKey = predictionDistanceFor(distance);
      const prediction = predictionKey ? inputs.manual.predictions[predictionKey] : undefined;
      evaluation = {
        kind: 'race_time',
        distance_m: distance,
        target_s: target,
        ...(fastest ? { fastest, gap_s: Math.round(fastest.time_s) - target, fraction: clamp01(target / fastest.time_s) } : {}),
        ...(prediction ? { prediction } : {}),
      };
      break;
    }
    case 'body_composition':
    case 'metric': {
      const { metric, value: target, direction } = goal.target;
      const recorded = [...(inputs.health[metric] ?? [])].sort((a, b) => a.date.localeCompare(b.date));
      const averaged = goal.type === 'body_composition';
      // Weight is published as its 7-day average already; body fat's is computed here.
      const judgedSeries = metric === 'body_fat_pct' ? bodyFatAverage(recorded) : recorded;
      const inScope = (p: DatedValue) => !goal.created || p.date >= goal.created;
      const judged = judgedSeries.filter(inScope);
      const hit = judged.find((p) => reaches(p.value, target, direction));
      if (hit) automatic = { date: hit.date, by: 'reading', reading: hit };
      const firstReading = recorded.find(inScope) ?? recorded[0];
      const start = goal.start_value ?? firstReading?.value;
      const startDate = goal.start_value !== undefined ? goal.start_date : firstReading?.date;
      const current = judged.at(-1);
      // One figure throughout (owner, 2026-10-23): "Now" is the value "to go" and progress use, so
      // body fat shows its 7-day average like weight, not the day's reading.
      const latest = current;
      let fraction: number | undefined;
      if (current && start !== undefined) {
        fraction = target === start ? (reaches(current.value, target, direction) ? 1 : 0) : clamp01((current.value - start) / (target - start));
      }
      evaluation = {
        kind: 'value',
        metric,
        direction,
        target,
        averaged,
        ...(start !== undefined ? { start } : {}),
        ...(startDate ? { startDate } : {}),
        ...(goal.all_time_start ? { allTimeStart: { date: goal.all_time_start.date, value: goal.all_time_start.value } } : {}),
        ...(current ? { current } : {}),
        ...(latest ? { latest } : {}),
        ...(fraction !== undefined ? { fraction } : {}),
      };
      break;
    }
    case 'milestone':
      evaluation = { kind: 'milestone' };
      break;
  }

  let achievement: Achievement | undefined;
  if (goal.achieved_override) {
    achievement = { date: goal.achieved_override.date, by: 'override', ...(goal.achieved_override.note ? { note: goal.achieved_override.note } : {}) };
  } else if (automatic && !('status_override' in goal && goal.status_override === 'active')) {
    achievement = automatic;
  }

  const daysToDeadline = goal.deadline ? daysBetween(inputs.today, goal.deadline) : undefined;
  const status: GoalStatus = achievement ? 'achieved' : daysToDeadline !== undefined && daysToDeadline < 0 ? 'deadline_passed' : 'active';
  const sinceAchieved = achievement ? daysBetween(achievement.date, inputs.today) : undefined;

  return {
    ...base,
    ...evaluation,
    status,
    ...(achievement ? { achievement } : {}),
    newlyAchieved: sinceAchieved !== undefined && sinceAchieved >= 0 && sinceAchieved < inputs.highlightDays,
    ...(daysToDeadline !== undefined ? { daysToDeadline } : {}),
  } as GoalEvaluation;
}

const byPriority = (a: GoalEvaluation, b: GoalEvaluation) => a.goal.priority - b.goal.priority || a.goal.id.localeCompare(b.goal.id);

/** Active goals (including deadline passed) in priority order. */
export function activeGoals(evaluations: readonly GoalEvaluation[]): GoalEvaluation[] {
  return evaluations.filter((e) => e.status !== 'achieved').sort(byPriority);
}

/** Achieved goals, newest first (FR-037). */
export function achievedGoals(evaluations: readonly GoalEvaluation[]): GoalEvaluation[] {
  return evaluations
    .filter((e) => e.status === 'achieved')
    .sort((a, b) => b.achievement!.date.localeCompare(a.achievement!.date) || byPriority(a, b));
}

/**
 * The landing page's featured goals (FR-022): every featured goal, by priority, up to `limit`.
 * Achieved ones stay while the owner keeps them featured (the achieved 5k is featured as a
 * milestone, owner 2026-10-23). Newly achieved ones (FR-042) come first, newest first, for the
 * highlight window, then drop back to their priority place (owner, 2026-10-23).
 * validate-data counts achieved featured goals toward the limit too.
 */
export function featuredGoals(evaluations: readonly GoalEvaluation[], limit: number): GoalEvaluation[] {
  const featured = evaluations
    .filter((e) => e.goal.featured)
    .sort(byPriority)
    .slice(0, limit);
  const fresh = achievedGoals(featured.filter((e) => e.newlyAchieved));
  return [...fresh, ...featured.filter((e) => !e.newlyAchieved)];
}

/** Whether there is anything to show progress from. */
export function hasData(evaluation: GoalEvaluation): boolean {
  if (evaluation.kind === 'race_time') return evaluation.fastest !== undefined;
  if (evaluation.kind === 'value') return evaluation.current !== undefined;
  return true;
}
