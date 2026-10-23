// Weeks of running for the landing page (T097; FR-021, FR-023, FR-058, FR-075). Pure: "today" (a
// Europe/London YYYY-MM-DD date) is passed in. Weeks run Monday to Sunday in UK local time; run
// dates are already London dates, so week boundaries hold across BST/GMT changes.
//
// Every published run counts here, treadmill and indoor runs included (FR-058): this is training
// volume, not records, so the PB-eligibility filter (efforts.ts) is not applied.
import { addDays, weekStart } from '../../../shared/format/dates.ts';
import type { Run } from '../../../shared/storage/index.ts';

type RunLike = Pick<Run, 'id' | 'date' | 'distance_m' | 'moving_s'>;

export interface Totals {
  runs: number;
  distance_m: number;
  moving_s: number;
}

export interface WeekTotals extends Totals {
  /** Monday, YYYY-MM-DD. */
  start: string;
  /** Sunday, YYYY-MM-DD. */
  end: string;
}

export interface WeekSnapshot {
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
}

function totals<T extends RunLike>(runs: readonly T[]): Totals {
  return {
    runs: runs.length,
    distance_m: runs.reduce((sum, r) => sum + r.distance_m, 0),
    moving_s: runs.reduce((sum, r) => sum + r.moving_s, 0),
  };
}

function week<T extends RunLike>(runs: readonly T[], start: string): WeekTotals {
  const end = addDays(start, 6);
  return { start, end, ...totals(runs.filter((r) => r.date >= start && r.date <= end)) };
}

/** This week (Monday to Sunday, containing today) against the week before (FR-023). Zero runs give zeros. */
export function weekSnapshot<T extends RunLike>(runs: readonly T[], today: string): WeekSnapshot {
  const start = weekStart(today);
  return { thisWeek: week(runs, start), lastWeek: week(runs, addDays(start, -7)) };
}

export interface BuildWeek {
  /** Monday, YYYY-MM-DD. */
  start: string;
  runs: number;
  distance_m: number;
}

export interface TrainingBuild<T extends RunLike = RunLike> {
  /** section.yaml focus_race.build_start. */
  buildStart: string;
  /**
   * The first date the chart covers: build_start, or the first published run when the site's
   * data starts in a later week (before the full history is imported). Weeks before it would read as zero
   * kilometres that were never run or never recorded, so they are left out rather than invented.
   */
  from: string;
  /** Monday-to-Sunday weeks from the week of `from` to the current week (or race week), oldest first. */
  weeks: BuildWeek[];
  /** The build's runs, newest first. */
  runs: T[];
  /** The longest run in the build; undefined with no runs. */
  longest?: T;
  total: Totals;
}

/**
 * The training build towards the focus race (FR-021): weekly distance from build_start up to
 * today (or race day, if earlier), and the longest run in the build. Runs before build_start or
 * after the end don't count.
 */
export function trainingBuild<T extends RunLike>(runs: readonly T[], buildStart: string, today: string, raceDate?: string): TrainingBuild<T> {
  const end = raceDate !== undefined && raceDate < today ? raceDate : today;
  const firstRun = runs.reduce<string | undefined>((first, r) => (first === undefined || r.date < first ? r.date : first), undefined);
  // Only when the data starts in a later week than the build: a first run later in the build's
  // first week is just a rest day or two.
  const from = firstRun !== undefined && weekStart(firstRun) > weekStart(buildStart) ? firstRun : buildStart;
  const inBuild = runs.filter((r) => r.date >= buildStart && r.date <= end).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const weeks: BuildWeek[] = [];
  if (from <= end) {
    for (let start = weekStart(from); start <= end; start = addDays(start, 7)) {
      const { runs: count, distance_m } = week(inBuild, start);
      weeks.push({ start, runs: count, distance_m });
    }
  }
  const longest = inBuild.reduce<T | undefined>((best, r) => (!best || r.distance_m > best.distance_m ? r : best), undefined);
  return { buildStart, from, weeks, runs: inBuild, ...(longest ? { longest } : {}), total: totals(inBuild) };
}

export interface LatestRun<T extends RunLike = RunLike> {
  run: T;
  /** How many runs share its date (a warm-up, a session and a cool-down, say). */
  sameDay: number;
}

/**
 * The most recent run. Runs carry a date but no start time (FR-011), so on a day with several the
 * longest stands for the day: usually the session itself rather than its warm-up or cool-down.
 */
export function latestRun<T extends RunLike>(runs: readonly T[]): LatestRun<T> | undefined {
  const latest = runs.reduce<string | undefined>((max, r) => (max === undefined || r.date > max ? r.date : max), undefined);
  if (latest === undefined) return undefined;
  const day = runs.filter((r) => r.date === latest);
  const run = day.reduce((best, r) => (r.distance_m > best.distance_m || (r.distance_m === best.distance_m && r.id > best.id) ? r : best));
  return { run, sameDay: day.length };
}
