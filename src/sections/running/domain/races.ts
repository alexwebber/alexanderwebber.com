// Races (T096, T128): upcoming races and the focus race (FR-020, FR-026, FR-056, data-model §5
// "Upcoming race state"), and the race history (FR-050–FR-052), at the end. Pure: "today" (a
// Europe/London YYYY-MM-DD date) is passed in, so tests pin it.
//
// State machine, evaluated at build time (the 00:17 UTC daily deploy keeps it current) and
// corrected client-side by Countdown.astro:
//   upcoming (date > today) -> race_day (date = today) -> awaiting_result (date < today, no
//   result_ref) -> completed (result_ref set: the owner race entry holding the result).
// A race with result_ref is completed whatever its date, and leaves the upcoming list.
import { daysBetween } from '../../../shared/format/dates.ts';
import { parseTime } from '../../../shared/format/parse.ts';
import { formatKm } from '../../../shared/format/units.ts';
import type { Race, Run, SectionSettings, UpcomingRace } from '../data/store/index.ts';
import { DISTANCES_M, parseDistance } from './distances.ts';

export type RaceState = 'upcoming' | 'race_day' | 'awaiting_result' | 'completed';

export function raceState(race: Pick<UpcomingRace, 'date' | 'result_ref'>, today: string): RaceState {
  if (race.result_ref) return 'completed';
  const days = daysBetween(today, race.date);
  return days > 0 ? 'upcoming' : days === 0 ? 'race_day' : 'awaiting_result';
}

/** Whole days from today (Europe/London) to race day; 0 on the day, negative after it. */
export function daysRemaining(race: Pick<UpcomingRace, 'date'>, today: string): number {
  return daysBetween(today, race.date);
}

/**
 * The countdown's words for whole days remaining, as [value, unit]: ["163", "days to go"],
 * ["1", "day to go"], ["Race day", ""], ["Result coming soon", ""]. Countdown.astro's inline
 * script repeats this for the visitor's own date.
 */
export function countdownText(days: number): [string, string] {
  if (days > 1) return [String(days), 'days to go'];
  if (days === 1) return ['1', 'day to go'];
  return days === 0 ? ['Race day', ''] : ['Result coming soon', ''];
}

/** The race's distance in metres, if it names one the site knows. */
export function raceDistance(race: Pick<UpcomingRace, 'distance' | 'distance_m'>): number | undefined {
  const value = race.distance ?? race.distance_m;
  return value === undefined ? undefined : parseDistance(value);
}

/** The focus race section.yaml names (FR-026), or undefined without section.yaml or a match. */
export function focusRace(section: Pick<SectionSettings, 'focus_race'> | undefined, races: readonly UpcomingRace[]): UpcomingRace | undefined {
  const id = section?.focus_race.race_id;
  return id === undefined ? undefined : races.find((race) => race.id === id);
}

/** Races still to come or awaiting a result: the focus race first, then by date (FR-056). */
export function upcomingRaces(races: readonly UpcomingRace[], focusId: string | undefined, today: string): UpcomingRace[] {
  return races
    .filter((race) => raceState(race, today) !== 'completed')
    .sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** "sub-3:25" for 3:25:00, "sub-44:30" for 44:30: whole minutes drop their seconds past an hour. */
export function targetLabel(targetTime: string): string | undefined {
  const seconds = parseTime(targetTime);
  return seconds === undefined ? undefined : subLabel(seconds);
}

/** "sub-3:20", "sub-1:40", "sub-43:00": a target time in seconds as runners say it. */
export function subLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const text = h > 0 ? (s === 0 ? `${h}:${mm}` : `${h}:${mm}:${String(s).padStart(2, '0')}`) : `${m}:${String(s).padStart(2, '0')}`;
  return `sub-${text}`;
}

/** "Brighton" from "Brighton Marathon": the name without a trailing distance word, for short lines. */
export function shortRaceName(name: string): string {
  const short = name.replace(/\s+(?:half\s+marathon|marathon|half|\d+(?:\.\d+)?\s*(?:k|km|mi|miles?))$/i, '').trim();
  return short || name;
}

export interface RaceResult {
  /** Seconds: the official time, else the linked run's elapsed time. */
  time_s?: number;
  official: boolean;
  slug: string;
  run_id?: string;
}

/**
 * The result of a completed race: the owner race entry its result_ref names, with its official
 * time, else the recorded run's elapsed time (FR-051: official times win). Undefined when the
 * entry doesn't exist (validate-data rejects that).
 */
export function raceResult(race: Pick<UpcomingRace, 'result_ref'>, races: readonly Race[], runs: readonly Run[]): RaceResult | undefined {
  const entry = race.result_ref ? races.find((r) => r.slug === race.result_ref) : undefined;
  if (!entry) return undefined;
  const official = entry.official_time === undefined ? undefined : parseTime(entry.official_time);
  const run = entry.run_id ? runs.find((r) => r.id === entry.run_id) : undefined;
  const time_s = official ?? run?.elapsed_s;
  return {
    ...(time_s !== undefined ? { time_s } : {}),
    official: official !== undefined,
    slug: entry.slug,
    ...(entry.run_id ? { run_id: entry.run_id } : {}),
  };
}

// --- Race history (T128; FR-050–FR-052, data-model §5 "Race (linked)") ---

/** A race run without a race.yaml takes the named distance it is within this much of (GPS overrun). */
const SNAP_RATIO = 0.05;

export interface RaceHistoryEntry {
  /** The race page: /running/races/<slug>/. The owner's slug, else the run ID. */
  slug: string;
  date: string;
  /** The official name (race.yaml), else the run's published title. */
  name: string;
  /** Metres shown: the official distance, else the named one, else what the watch measured. */
  distance_m: number;
  /** The named distance it counts at in the PB table (5k, half, ...); undefined when it has none. */
  pb_distance_m?: number;
  /** Seconds: the official time (FR-051: it wins), else the recorded run's elapsed time. */
  time_s?: number;
  official: boolean;
  /** The watch's time when an official time replaces it (US4.3: 1:41:07 official, 1:41:15 device). */
  device_time_s?: number;
  position?: number;
  results_url?: string;
  note?: string;
  /** The recorded run, for a race recorded by the watch; absent for a hand-entered race. */
  run?: Run;
  /** The owner's race.yaml, when there is one. */
  entry?: Race;
}

/** The named distance (DISTANCES_M) within SNAP_RATIO of `metres`, nearest first. */
export function snapDistance(metres: number): number | undefined {
  let best: number | undefined;
  for (const named of Object.values(DISTANCES_M)) {
    const off = Math.abs(metres - named) / named;
    if (off <= SNAP_RATIO && (best === undefined || off < Math.abs(metres - best) / best)) best = named;
  }
  return best;
}

/**
 * Every race once, newest first (FR-052). Races come from recorded runs the processor published as
 * races (the intervals.icu flag, a race.yaml linked by run_id, or run-overrides.yaml is_race; FR-050)
 * and from hand-entered race.yaml entries. A race.yaml joins a run only through its explicit
 * run_id, never by date or distance (validate-data rejects a hand entry that duplicates a recorded
 * race). Linked details win over device values (FR-051). A race.yaml whose run isn't published yet,
 * or which says designate: not_race, shows nothing.
 */
export function raceHistory(runs: readonly Run[], races: readonly Race[]): RaceHistoryEntry[] {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const linked = new Set(races.flatMap((race) => (race.run_id ? [race.run_id] : [])));
  const out: RaceHistoryEntry[] = [];

  for (const entry of races) {
    if (entry.designate === 'not_race') continue;
    const run = entry.run_id ? runsById.get(entry.run_id) : undefined;
    if (entry.run_id && (!run || !run.is_race)) continue;
    const named = parseDistance(entry.distance);
    const official = entry.official_time === undefined ? undefined : parseTime(entry.official_time);
    const distance = entry.official_distance_m ?? named ?? run?.distance_m;
    if (distance === undefined) continue; // the schema only allows named distances or metres
    const time = official ?? run?.elapsed_s;
    out.push({
      slug: entry.slug,
      date: entry.date,
      name: entry.name ?? run?.title ?? `Race · ${formatKm(distance)}`,
      distance_m: distance,
      ...(named !== undefined ? { pb_distance_m: named } : {}),
      ...(time !== undefined ? { time_s: time } : {}),
      official: official !== undefined,
      ...(official !== undefined && run ? { device_time_s: run.elapsed_s } : {}),
      ...(entry.position !== undefined ? { position: entry.position } : {}),
      ...(entry.results_url ? { results_url: entry.results_url } : {}),
      ...(entry.note ? { note: entry.note } : {}),
      ...(run ? { run } : {}),
      entry,
    });
  }

  for (const run of runs) {
    if (!run.is_race || linked.has(run.id)) continue;
    const snapped = snapDistance(run.distance_m);
    out.push({
      slug: run.id,
      date: run.date,
      name: run.title,
      distance_m: run.distance_m,
      ...(snapped !== undefined ? { pb_distance_m: snapped } : {}),
      time_s: run.elapsed_s,
      official: false,
      run,
    });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
