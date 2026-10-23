// Upcoming races and the focus race (T096; FR-020, FR-026, FR-056, data-model §5 "Upcoming race
// state"). Pure: "today" (a Europe/London YYYY-MM-DD date) is passed in, so tests pin it.
//
// State machine, evaluated at build time (the 00:17 UTC daily deploy keeps it current) and
// corrected client-side by Countdown.astro:
//   upcoming (date > today) -> race_day (date = today) -> awaiting_result (date < today, no
//   result_ref) -> completed (result_ref set: the owner race entry holding the result).
// A race with result_ref is completed whatever its date, and leaves the upcoming list.
import { daysBetween } from '../../../shared/format/dates.ts';
import { parseDistance, parseTime } from '../../../shared/format/parse.ts';
import type { Race, Run, SectionSettings, UpcomingRace } from '../../../shared/storage/index.ts';

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
