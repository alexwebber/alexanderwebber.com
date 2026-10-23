// The Best Effort index (T087; data-model §5): every effort that may count toward race-time goals
// and PBs, per distance, sorted by date.
//
// - Recorded runs: each published `best_efforts` entry that is `plausible`, from a run that is not
//   excluded from records and not indoor/treadmill unless the owner included it (FR-057). The
//   owner's run-overrides.yaml is applied again here on top of the published `flags`, so the
//   index follows the owner file even before the next refresh re-publishes the run.
// - Race results (FR-035): every owner race entry with an official time. For a race linked to a
//   recorded run (`run_id`), the official time replaces that run's device effort at the race
//   distance (official times win, FR-051). A hand-entered race (no `run_id`) counts as it is.
import { parseDistance, parseTime } from '../../../shared/format/parse.ts';
import type { Race, Run, RunOverride } from '../../../shared/storage/index.ts';

/** Best efforts at the same distance match within half a metre (the processor's dedup tolerance). */
export const DISTANCE_TOLERANCE_M = 0.5;

export interface Effort {
  distance_m: number;
  /** Seconds; device efforts keep their tenths. */
  time_s: number;
  /** The run's (or race's) local date, YYYY-MM-DD. */
  date: string;
  source: 'run' | 'race';
  /** The recorded run (opaque public ID); absent for a hand-entered race. */
  run_id?: string;
  /** The watch that recorded it (Garmin attribution, FR-077); absent for a hand-entered race. */
  device?: string;
  /** The owner's race entry, for a race result. */
  race?: { slug: string; name?: string };
  /** A stretch of a longer run (e.g. a 10k inside a tempo run), not a run of about this distance. */
  inLongerRun?: boolean;
}

/** A run more than 5% longer than an effort's distance makes it "in a longer run" (GPS on a real attempt
 *  usually overruns by 1-3%; a 10.7 km tempo run holding a 10k effort is 7% over). */
const LONGER_RUN_RATIO = 1.05;

/** Distance (metres) -> efforts at that distance, oldest first (fastest first within a day). */
export type EffortIndex = ReadonlyMap<number, readonly Effort[]>;

export const sameDistance = (a: number, b: number) => Math.abs(a - b) <= DISTANCE_TOLERANCE_M;

/** Whether a run's efforts count toward PBs and race-time goals. */
export function isRecordEligible(run: Run, override: RunOverride | undefined): boolean {
  const excluded = override?.exclude_from_records ?? run.flags.excluded_from_records ?? false;
  if (excluded) return false;
  const indoor = run.type === 'indoor' || run.treadmill;
  return !indoor || (override?.include_in_records ?? run.flags.include_indoor_in_records ?? false);
}

export function buildEffortIndex(runs: readonly Run[], races: readonly Race[] = [], overrides: readonly RunOverride[] = []): EffortIndex {
  const overrideById = new Map(overrides.map((o) => [o.id, o]));
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const efforts: Effort[] = [];

  // Race results first, so a linked run's device effort at the race distance can give way.
  const officialAt = new Map<string, number[]>(); // run_id -> race distances with an official time
  for (const race of races) {
    if (race.designate === 'not_race' || race.official_time === undefined) continue;
    const distance = parseDistance(race.distance);
    const time = parseTime(race.official_time);
    if (distance === undefined || time === undefined) continue;
    const run = race.run_id ? runsById.get(race.run_id) : undefined;
    if (run) {
      if (!run.is_race || !isRecordEligible(run, overrideById.get(run.id))) continue;
      officialAt.set(run.id, [...(officialAt.get(run.id) ?? []), distance]);
    }
    efforts.push({
      distance_m: distance,
      time_s: time,
      date: race.date,
      source: 'race',
      ...(run ? { run_id: run.id } : {}),
      ...(run?.device ? { device: run.device } : {}),
      race: { slug: race.slug, ...(race.name ? { name: race.name } : {}) },
    });
  }

  for (const run of runs) {
    if (!isRecordEligible(run, overrideById.get(run.id))) continue;
    const official = officialAt.get(run.id) ?? [];
    for (const effort of run.best_efforts) {
      if (!effort.plausible) continue;
      if (official.some((d) => sameDistance(d, effort.distance_m))) continue;
      efforts.push({
        distance_m: effort.distance_m,
        time_s: effort.time_s,
        date: run.date,
        source: 'run',
        run_id: run.id,
        ...(run.device ? { device: run.device } : {}),
        ...(run.distance_m > effort.distance_m * LONGER_RUN_RATIO ? { inLongerRun: true } : {}),
      });
    }
  }

  const index = new Map<number, Effort[]>();
  for (const effort of efforts) {
    const key = [...index.keys()].find((d) => sameDistance(d, effort.distance_m)) ?? effort.distance_m;
    index.set(key, [...(index.get(key) ?? []), effort]);
  }
  for (const list of index.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.time_s - b.time_s);
  return index;
}

/** The efforts at one distance (within half a metre), oldest first. */
export function effortsAt(index: EffortIndex, distanceM: number): readonly Effort[] {
  for (const [d, list] of index) if (sameDistance(d, distanceM)) return list;
  return [];
}

/** The fastest effort at one distance; the earlier one on a tie. */
export function fastestEffort(index: EffortIndex, distanceM: number): Effort | undefined {
  return effortsAt(index, distanceM).reduce<Effort | undefined>((best, e) => (best === undefined || e.time_s < best.time_s ? e : best), undefined);
}
