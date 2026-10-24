// Training totals by week, month, year and all time (T113; FR-045, FR-058, FR-075). Pure: "today"
// (a Europe/London YYYY-MM-DD date) is passed in. Run dates are already London dates, so weeks
// (Monday to Sunday), months and years hold across BST/GMT changes.
//
// Every published run counts, treadmill and indoor runs included (FR-058): this is training
// volume, not records. Average pace is distance-weighted (total moving time over total distance),
// so a long run counts for more than a short one. Elevation gain sums the runs that recorded it;
// a period whose runs recorded none (say, treadmill only) has no elevation figure rather than a
// made-up 0 (FR-048). Periods run unbroken from the first run's period to today's, so a week off
// shows as a zero column; nothing before the first run is invented.
import { addDays, monthStart, weekStart } from '../../../shared/format/dates.ts';
import type { Run } from '../../../shared/storage/index.ts';

export type RunLike = Pick<Run, 'date' | 'distance_m' | 'moving_s' | 'elevation_gain_m'>;

export type PeriodKind = 'week' | 'month' | 'year';

export interface Totals {
  runs: number;
  distance_m: number;
  moving_s: number;
  /** Distance-weighted: total moving time per km. Undefined without distance. */
  avg_pace_s_per_km?: number;
  /** Sum over runs that recorded it; undefined when none did. */
  elevation_gain_m?: number;
}

export interface PeriodTotals extends Totals {
  kind: PeriodKind;
  /** First day, YYYY-MM-DD (a Monday, the 1st of a month or 1 January). */
  start: string;
  /** Last day, YYYY-MM-DD. */
  end: string;
}

/** Totals over any set of runs. */
export function totals(runs: readonly RunLike[]): Totals {
  let distance = 0;
  let moving = 0;
  let elevation: number | undefined;
  for (const run of runs) {
    distance += run.distance_m;
    moving += run.moving_s;
    if (run.elevation_gain_m !== undefined) elevation = (elevation ?? 0) + run.elevation_gain_m;
  }
  return {
    runs: runs.length,
    distance_m: distance,
    moving_s: moving,
    ...(distance > 0 ? { avg_pace_s_per_km: (moving / distance) * 1000 } : {}),
    ...(elevation !== undefined ? { elevation_gain_m: elevation } : {}),
  };
}

/** The first day of the period of `kind` holding `date`. */
export function periodStart(kind: PeriodKind, date: string): string {
  if (kind === 'week') return weekStart(date);
  if (kind === 'month') return monthStart(date);
  return `${date.slice(0, 4)}-01-01`;
}

/** The first day of the next period after the one starting `start`. */
export function nextPeriod(kind: PeriodKind, start: string): string {
  if (kind === 'week') return addDays(start, 7);
  if (kind === 'month') return monthStart(addDays(start, 31));
  return `${Number(start.slice(0, 4)) + 1}-01-01`;
}

/**
 * Totals for every period of `kind` from `from`'s period (default: the first run's) to today's,
 * oldest first. Empty without runs.
 */
export function periodTotals(kind: PeriodKind, runs: readonly RunLike[], today: string, from?: string): PeriodTotals[] {
  const first = from ?? runs.reduce<string | undefined>((min, r) => (min === undefined || r.date < min ? r.date : min), undefined);
  if (first === undefined) return [];
  const byPeriod = new Map<string, RunLike[]>();
  for (const run of runs) {
    const key = periodStart(kind, run.date);
    const list = byPeriod.get(key);
    if (list) list.push(run);
    else byPeriod.set(key, [run]);
  }
  const out: PeriodTotals[] = [];
  const last = periodStart(kind, today);
  for (let start = periodStart(kind, first); start <= last; start = nextPeriod(kind, start)) {
    out.push({ kind, start, end: addDays(nextPeriod(kind, start), -1), ...totals(byPeriod.get(start) ?? []) });
  }
  return out;
}

/**
 * The last `count` weeks up to this week (the hub's opening view; owner, 2026-10-24), or from the
 * first run's week when the runs start later.
 */
export function recentWeeks(runs: readonly RunLike[], today: string, count = 26): PeriodTotals[] {
  const from = addDays(weekStart(today), -7 * (count - 1));
  const first = runs.reduce<string | undefined>((min, r) => (min === undefined || r.date < min ? r.date : min), undefined);
  if (first === undefined) return [];
  return periodTotals('week', runs, today, first > from ? first : from);
}

export interface Summary {
  week: PeriodTotals[];
  month: PeriodTotals[];
  year: PeriodTotals[];
  allTime: Totals & { first?: string; last?: string };
}

/** Everything the training hub shows: recent weeks, every month and year, and all time. */
export function trainingSummary(runs: readonly RunLike[], today: string, weeks = 26): Summary {
  const dates = runs.map((r) => r.date).sort();
  return {
    week: recentWeeks(runs, today, weeks),
    month: periodTotals('month', runs, today),
    year: periodTotals('year', runs, today),
    allTime: { ...totals(runs), ...(dates.length ? { first: dates[0], last: dates.at(-1) } : {}) },
  };
}

/** Years with at least one run, newest first. */
export function runYears(runs: readonly Pick<Run, 'date'>[]): number[] {
  return [...new Set(runs.map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => b - a);
}

export interface MonthGroup<T> {
  /** YYYY-MM */
  month: string;
  runs: T[];
  totals: Totals;
}

/**
 * Runs newest first, grouped by month (FR-046). Within a day, the longer run comes first (runs
 * carry no start time, FR-011), then by ID so the order is stable.
 */
export function groupByMonth<T extends RunLike & Pick<Run, 'id'>>(runs: readonly T[]): MonthGroup<T>[] {
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date) || b.distance_m - a.distance_m || a.id.localeCompare(b.id));
  const groups: MonthGroup<T>[] = [];
  for (const run of sorted) {
    const month = run.date.slice(0, 7);
    const group = groups.at(-1);
    if (group?.month === month) group.runs.push(run);
    else groups.push({ month, runs: [run], totals: totals([]) });
  }
  for (const group of groups) group.totals = totals(group.runs);
  return groups;
}
