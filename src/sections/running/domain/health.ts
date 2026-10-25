// Health and performance metrics (T138, T156; US5, FR-060–FR-069, data-model §3 and §5). Pure
// functions over published health series, the owner's lab entries and manual Garmin figures, and
// the evaluated goals; every function that needs a date takes "today" (Europe/London), so tests
// pin dates without a clock.
//
// - Ranges (FR-068): 3 months, 1 year and all time, back from today. A range never starts before
//   the data (or a chart's own start, e.g. fitness after its warm-up), and a range that would add
//   less than a month over a shorter one is left out. Charts open on 1 year (owner, 2026-10-24).
// - Daily metrics (body fat, resting HR, HRV): each reading as a faint dot under its trailing
//   7-day average (composition.ts's trailingMean, the same mean the body-fat goal is judged on).
//   The headline "now" is the latest 7-day average (owner, 2026-10-24). Weight is published only
//   as its 7-day average (FR-061), so it has no readings to show.
// - Targets (FR-063) come from the evaluated goals: the active goal for the metric, by priority,
//   else the latest achieved one.
// - Lab results (FR-064/065): one marker per lab value ("DEXA scan", "Lab test"), compared with the
//   nearest Garmin reading within 7 days either side as {lab, device, diff}, diff = lab - device.
// - HRV (US5.7): the chart starts at the first reading, with a note naming the watch change behind
//   it when the published runs show one around that date. Nothing is hard-coded.
// - Fitness/fatigue/form (FR-060): intervals.icu's model (fitness = CTL, fatigue = ATL, form =
//   fitness - fatigue, derived here, never stored). Both build up from zero where intervals.icu's
//   history starts, so the chart starts 42 days (the CTL time constant) after the first point
//   (owner, 2026-10-24).
// - Manual Garmin figures (FR-069): training status and race predictions from manual-metrics.ts,
//   each dated by its `as_of`; race predictions sit beside their race-time goals.
import { addDays, daysBetween, formatDate } from '../../../shared/format/dates.ts';
import type { LabMeasurement, Run } from '../data/store/index.ts';
import { trailingMean, type DatedValue } from './composition.ts';
import { capitalise, distanceLabel, formatMetric, shortTargetText } from './goal-text.ts';
import type { GoalEvaluation, RaceTimeEvaluation, ValueEvaluation, ValueMetric } from './goals.ts';
import { PREDICTION_DISTANCES, predictionDistanceFor, predictionHistory, type ManualMetrics, type Prediction, type PredictionDistance } from './manual-metrics.ts';

export type { DatedValue };

// --- Ranges -------------------------------------------------------------------------------

export type RangeKey = '3m' | '1y' | 'all';

/** Days each bounded range reaches back from today. */
export const RANGE_DAYS = { '3m': 91, '1y': 365 } as const;

export interface ChartRange {
  key: RangeKey;
  /** Inclusive YYYY-MM-DD bounds. */
  from: string;
  to: string;
}

/**
 * Days a longer range must add over the shorter one before it is offered; less than this and it
 * would look the same (owner, 2026-10-24: "All time" was 3–9 days longer than "1 year").
 */
export const RANGE_MIN_EXTRA_DAYS = 30;

/**
 * The ranges a chart offers for data starting on `first`, ending today. Each starts no earlier
 * than `first`; "1 year" is offered only when the data reaches back at least a month past
 * 3 months, and "All time" only when it reaches back at least a month past a year. No data: no
 * ranges.
 */
export function chartRanges(first: string | undefined, today: string): ChartRange[] {
  if (!first) return [];
  const start = (days: number) => {
    const from = addDays(today, -days);
    return first > from ? first : from;
  };
  const reachesPast = (days: number) => first <= addDays(today, -(days + RANGE_MIN_EXTRA_DAYS));
  const ranges: ChartRange[] = [{ key: '3m', from: start(RANGE_DAYS['3m']), to: today }];
  if (reachesPast(RANGE_DAYS['3m'])) ranges.push({ key: '1y', from: start(RANGE_DAYS['1y']), to: today });
  if (reachesPast(RANGE_DAYS['1y'])) ranges.push({ key: 'all', from: first, to: today });
  return ranges;
}

/** The points inside [from, to]. */
export function inRange<T extends { date: string }>(points: readonly T[], from: string, to: string): T[] {
  return points.filter((p) => p.date >= from && p.date <= to);
}

/** Points on or after `start` (a chart's own start date), oldest first. */
export function startingFrom<T extends { date: string }>(points: readonly T[], start: string | undefined): T[] {
  return start ? points.filter((p) => p.date >= start) : [...points];
}

/** The latest point, if any. */
export function latest<T>(points: readonly T[]): T | undefined {
  return points.at(-1);
}

/**
 * The key message of one range of a trend, for the chart's text alternative: "From 112.3 kg on
 * 24 Oct 2025 to 101.1 kg on 24 Oct 2026." or "No readings in this range."
 */
export function describeTrend(points: readonly DatedValue[], format: (value: number) => string): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return 'No readings in this range.';
  if (first.date === last.date) return `${format(last.value)} on ${formatDate(last.date)}.`;
  return `From ${format(first.value)} on ${formatDate(first.date)} to ${format(last.value)} on ${formatDate(last.date)}.`;
}

// --- Daily metrics ------------------------------------------------------------------------

export interface DailyMetric {
  /** As recorded, oldest first (faint dots). */
  readings: DatedValue[];
  /** Trailing 7-day mean, one decimal, oldest first (the line, and the headline). */
  average: DatedValue[];
}

/** Readings plus their 7-day average, ending at the last reading. */
export function dailyMetric(readings: readonly DatedValue[]): DailyMetric {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  return { readings: sorted, average: trailingMean(sorted) };
}

// --- Targets ------------------------------------------------------------------------------

/**
 * The goal a metric's chart marks (FR-063): the active (or deadline-passed) goal for it with the
 * highest priority, else the most recently achieved one. Undefined without a goal.
 */
export function goalFor(evaluations: readonly GoalEvaluation[], metric: ValueMetric): ValueEvaluation | undefined {
  const goals = evaluations.filter((e): e is ValueEvaluation => e.kind === 'value' && e.metric === metric);
  const open = goals.filter((e) => e.status !== 'achieved').sort((a, b) => a.goal.priority - b.goal.priority);
  if (open[0]) return open[0];
  return goals.sort((a, b) => (b.achievement?.date ?? '').localeCompare(a.achievement?.date ?? ''))[0];
}

/** The target line for a goal: "Target 93 kg". */
export function targetLine(goal: ValueEvaluation | undefined): { value: number; label: string } | undefined {
  return goal ? { value: goal.target, label: `Target ${formatMetric(goal.metric, goal.target)}` } : undefined;
}

// --- Lab reference measurements -----------------------------------------------------------

export type LabMetric = keyof LabMeasurement['values'];
export type LabType = LabMeasurement['type'];

/** Marker labels (US5.4, US5.5). */
export const LAB_LABELS: Record<LabType, string> = { dexa: 'DEXA scan', lab_vo2max: 'Lab test' };

/** How many days either side a Garmin reading may be to compare with a lab result (FR-065). */
export const LAB_WINDOW_DAYS = 7;

export interface LabPoint {
  date: string;
  type: LabType;
  label: string;
  provider: string;
  value: number;
}

/** One metric's lab results, oldest first. */
export function labPoints(lab: readonly LabMeasurement[], metric: LabMetric): LabPoint[] {
  return [...lab]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((entry) => {
      const value = entry.values[metric];
      return value === undefined ? [] : [{ date: entry.date, type: entry.type, label: LAB_LABELS[entry.type], provider: entry.provider, value }];
    });
}

export interface LabComparison {
  lab: LabPoint;
  /** The nearest Garmin reading within the window; undefined when there is none. */
  device?: DatedValue;
  /** lab - device, to one decimal (US5.4: 51.0 against 54 is -3.0). */
  diff?: number;
}

/**
 * A lab result against the Garmin reading nearest in time, within `windowDays` either side. On a
 * tie the earlier reading wins (it is what the device said going into the test).
 */
export function compareLab(lab: LabPoint, readings: readonly DatedValue[], windowDays = LAB_WINDOW_DAYS): LabComparison {
  let best: { reading: DatedValue; distance: number } | undefined;
  for (const reading of readings) {
    const distance = Math.abs(daysBetween(lab.date, reading.date));
    if (distance > windowDays) continue;
    if (!best || distance < best.distance || (distance === best.distance && reading.date < best.reading.date)) best = { reading, distance };
  }
  if (!best) return { lab };
  return { lab, device: best.reading, diff: Math.round((lab.value - best.reading.value) * 10) / 10 };
}

// --- HRV start (US5.7) --------------------------------------------------------------------

export interface HrvStart {
  /** The first HRV reading's date. */
  date: string;
  /** The watch used before, and the one from that date, when the runs show a change there. */
  before?: string;
  after?: string;
}

/**
 * Where HRV starts, and whether a watch change explains it: the last run before the first reading
 * was on one watch, and the first run on or after it, within `windowDays`, on another.
 */
export function hrvStart(hrv: readonly DatedValue[], runs: readonly Pick<Run, 'date' | 'device'>[], windowDays = LAB_WINDOW_DAYS): HrvStart | undefined {
  const first = [...hrv].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!first) return undefined;
  const withDevice = runs.filter((r) => r.device).sort((a, b) => a.date.localeCompare(b.date));
  const before = withDevice.findLast((r) => r.date < first.date);
  const after = withDevice.find((r) => r.date >= first.date);
  if (before && after && before.device !== after.device && daysBetween(first.date, after.date) <= windowDays) {
    return { date: first.date, before: before.device!, after: after.device! };
  }
  return { date: first.date };
}

/** "HRV readings start on 1 Dec 2025, when the Venu X1 replaced the Venu 2 Plus." */
export function hrvNote(start: HrvStart): string {
  const when = `HRV readings start on ${formatDate(start.date)}`;
  return start.before && start.after ? `${when}, when the ${start.after} replaced the ${start.before}.` : `${when}.`;
}

// --- Fitness, fatigue and form (T156) -----------------------------------------------------

/** intervals.icu's fitness time constant: fitness takes about this long to build from zero. */
export const FITNESS_WARMUP_DAYS = 42;

/** How the chart names its model (FR-060): intervals.icu's, never Garmin's training load. */
export const FITNESS_MODEL_LABEL = "intervals.icu's fitness and fatigue model, not Garmin's training load";

export interface FitnessPoint {
  date: string;
  /** CTL */
  fitness: number;
  /** ATL */
  fatigue: number;
  /** fitness - fatigue */
  form: number;
}

/** Days with both fitness and fatigue, oldest first, with form = fitness - fatigue. */
export function fitnessSeries(ctl: readonly DatedValue[], atl: readonly DatedValue[]): FitnessPoint[] {
  const fatigue = new Map(atl.map((p) => [p.date, p.value]));
  return [...ctl]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((p) => {
      const a = fatigue.get(p.date);
      return a === undefined ? [] : [{ date: p.date, fitness: p.value, fatigue: a, form: p.value - a }];
    });
}

/** Where the fitness chart starts: 42 days after the first fitness point. */
export function fitnessStart(ctl: readonly DatedValue[]): { historyStart: string; chartStart: string } | undefined {
  const first = [...ctl].sort((a, b) => a.date.localeCompare(b.date))[0];
  return first ? { historyStart: first.date, chartStart: addDays(first.date, FITNESS_WARMUP_DAYS) } : undefined;
}

/** The note under the fitness chart (owner, 2026-10-24). */
export function fitnessNote(start: { historyStart: string; chartStart: string }): string {
  return `intervals.icu's history starts on ${formatDate(start.historyStart)}, so fitness and fatigue climb from zero for their first ${FITNESS_WARMUP_DAYS} days because of where the data starts, not because of training. The chart starts on ${formatDate(start.chartStart)}.`;
}

// --- Race predictions beside their goals --------------------------------------------------

export interface PredictionRow {
  distance: PredictionDistance;
  /** "5k", "Half marathon" */
  label: string;
  /** The latest entry; undefined: not recorded yet. */
  latest?: Prediction;
  /** Every dated entry for this distance, oldest first (the trend). */
  history: Prediction[];
  /** The race-time goal at this distance: "sub-3:20", and whether it is achieved. */
  goal?: { target: string; achieved: boolean; achievedOn?: string };
  /** The upcoming race the goal links to (Brighton for the marathon). */
  race?: { name: string; date: string };
}

/** The race-time goal shown beside a distance: the highest-priority open one, else an achieved one. */
function raceGoalFor(evaluations: readonly GoalEvaluation[], distance: PredictionDistance): RaceTimeEvaluation | undefined {
  const goals = evaluations
    .filter((e): e is RaceTimeEvaluation => e.kind === 'race_time' && predictionDistanceFor(e.distance_m) === distance)
    .sort((a, b) => a.goal.priority - b.goal.priority);
  return goals.find((e) => e.status !== 'achieved') ?? goals[0];
}

/** All four distances, in order, each with its latest prediction, history, goal and race. */
export function predictionRows(manual: ManualMetrics, evaluations: readonly GoalEvaluation[]): PredictionRow[] {
  return (Object.keys(PREDICTION_DISTANCES) as PredictionDistance[]).map((distance) => {
    const history = predictionHistory(manual, distance);
    const goal = raceGoalFor(evaluations, distance);
    const achieved = goal?.status === 'achieved';
    return {
      distance,
      label: capitalise(distanceLabel(PREDICTION_DISTANCES[distance])),
      history,
      ...(history.length ? { latest: history.at(-1)! } : {}),
      ...(goal ? { goal: { target: shortTargetText(goal), achieved, ...(achieved && goal.achievement ? { achievedOn: goal.achievement.date } : {}) } } : {}),
      ...(goal?.linkedRace ? { race: { name: goal.linkedRace.name, date: goal.linkedRace.date } } : {}),
    };
  });
}

