// The personal-best table (T129; FR-053, FR-057, US4.2, US4.3, US4.7, data-model §5 "Personal
// Best"). Pure: "today" (Europe/London) is passed in.
//
// One row per standard distance (5k, 10k, half marathon, marathon; owner, 2026-10-24), plus any
// other named distance the owner has raced (FR-053). Each row has:
// - the fastest race result: the official time where there is one (it beats the device time,
//   FR-051), else the recorded run's elapsed time; hand-entered races count. A recorded race only
//   counts when its run is record-eligible (not excluded, not a treadmill run unless the owner
//   included it, FR-057) and its effort at that distance isn't implausible;
// - the fastest effort at that distance from any run, where it is faster than the race result
//   (to the second). A race run's own stretch at its race distance isn't one: it is that race. These come from the goals' Best Effort index (efforts.ts), so the same rules
//   apply: plausible only, timer time, treadmill only with include_in_records, and "in a longer
//   run" when the run was more than 5% longer than the distance;
// - `recent`: the row's best time was set within `recent_highlight_days.pb` days (US4.7);
// - `upcoming`: with nothing at the distance yet, the next upcoming race over it (the marathon
//   row points at Brighton until there is a marathon effort).
import { daysBetween } from '../../../shared/format/dates.ts';
import { DISTANCES_M } from '../../../shared/format/parse.ts';
import type { RunOverride, UpcomingRace } from '../../../shared/storage/index.ts';
import { effortsAt, isRecordEligible, sameDistance, type Effort, type EffortIndex } from './efforts.ts';
import { raceDistance, type RaceHistoryEntry } from './races.ts';

export const PB_DISTANCES: readonly number[] = [DISTANCES_M['5k'], DISTANCES_M['10k'], DISTANCES_M.half, DISTANCES_M.marathon];

export interface RacePb {
  entry: RaceHistoryEntry;
  /** Seconds: the official time, else the run's elapsed time. */
  time_s: number;
}

export interface PbRow {
  distance_m: number;
  /** The fastest race result at the distance, if any. */
  race?: RacePb;
  /** The fastest any-run effort, only when faster than `race` (or with no race result). */
  effort?: Effort;
  /** The row's best (the faster of the two): its date and time. */
  best?: { date: string; time_s: number };
  /** The best was set within the highlight window (US4.7). */
  recent: boolean;
  /** With nothing at the distance yet: the next upcoming race over it. */
  upcoming?: UpcomingRace;
}

export interface PbInput {
  history: readonly RaceHistoryEntry[];
  efforts: EffortIndex;
  overrides?: readonly RunOverride[];
  /** Upcoming races in display order (focus race first, then by date). */
  upcoming?: readonly UpcomingRace[];
  today: string;
  /** section.yaml recent_highlight_days.pb */
  highlightDays: number;
}

/** The faster of two results; the earlier one on a tie. */
const faster = <T extends { time_s?: number; date: string }>(a: T | undefined, b: T): T =>
  a === undefined || b.time_s! < a.time_s! || (b.time_s === a.time_s && b.date < a.date) ? b : a;

function counts(entry: RaceHistoryEntry, overrides: ReadonlyMap<string, RunOverride>): boolean {
  if (entry.time_s === undefined || entry.pb_distance_m === undefined) return false;
  const run = entry.run;
  if (!run) return true; // hand-entered
  if (!isRecordEligible(run, overrides.get(run.id))) return false;
  if (entry.official) return true;
  const effort = run.best_efforts.find((e) => sameDistance(e.distance_m, entry.pb_distance_m!));
  return effort?.plausible !== false;
}

export function personalBests({ history, efforts, overrides = [], upcoming = [], today, highlightDays }: PbInput): PbRow[] {
  const byId = new Map(overrides.map((o) => [o.id, o]));
  const raced = history.filter((entry) => counts(entry, byId));
  const distances = [...PB_DISTANCES];
  for (const entry of raced) {
    if (!distances.some((d) => sameDistance(d, entry.pb_distance_m!))) distances.push(entry.pb_distance_m!);
  }
  distances.sort((a, b) => a - b);

  return distances.map((distance) => {
    const races = raced.filter((entry) => sameDistance(entry.pb_distance_m!, distance));
    const race = races.reduce<RaceHistoryEntry | undefined>(faster, undefined);
    // A race's own stretch at its distance is that race's result, not another effort.
    const raceRuns = new Set(races.flatMap((entry) => (entry.run ? [entry.run.id] : [])));
    let effort: Effort | undefined;
    for (const e of effortsAt(efforts, distance)) {
      if (e.source === 'run' && !raceRuns.has(e.run_id!)) effort = faster(effort, e);
    }
    if (race && effort && Math.round(effort.time_s) >= race.time_s!) effort = undefined;

    const best = effort ?? race;
    const age = best ? daysBetween(best.date, today) : undefined;
    const next = best ? undefined : upcoming.find((u) => {
      const d = raceDistance(u);
      return d !== undefined && sameDistance(d, distance);
    });
    return {
      distance_m: distance,
      ...(race ? { race: { entry: race, time_s: race.time_s! } } : {}),
      ...(effort ? { effort } : {}),
      ...(best ? { best: { date: best.date, time_s: best.time_s! } } : {}),
      recent: age !== undefined && age >= 0 && age <= highlightDays,
      ...(next ? { upcoming: next } : {}),
    };
  });
}

/** The races holding a race PB (the race history's "PB" badge), each with whether it is the row's
 *  recent best (a "New" PB). */
export function racePbSlugs(rows: readonly PbRow[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const row of rows) {
    if (row.race) out.set(row.race.entry.slug, row.recent && !row.effort);
  }
  return out;
}
