// The Training area's data (T120, US3): every published run, the period totals for `today`
// (Europe/London) and the years that have runs. Shared by the hub and the year pages, and
// memoised per build and day, so thousands of runs are summed once, not once per page.
import { today as londonToday } from '../../../shared/format/dates.ts';
import type { Run } from '../../../shared/storage/index.ts';
import { runDevices } from '../domain/attribution.ts';
import { runYears, trainingSummary, type Summary } from '../domain/periods.ts';
import { runningStore } from './load.ts';
import { loadRaces } from './races.ts';

export interface TrainingData {
  today: string;
  /** Newest first. */
  runs: Run[];
  summary: Summary;
  /** Years with runs, newest first. */
  years: number[];
  /** Races from every year, newest first. */
  races: Run[];
  /** The watches behind all the runs, newest first (FR-077). */
  devices: string[];
  /** Race run ID -> its race page slug (US4), so the run list links races to their pages. */
  raceSlugs: ReadonlyMap<string, string>;
}

const cache = new Map<string, Promise<TrainingData>>();

export function loadTraining(today: string = londonToday()): Promise<TrainingData> {
  let data = cache.get(today);
  if (!data) {
    data = load(today);
    cache.set(today, data);
  }
  return data;
}

/** Tests swap the store; this drops data loaded from the old one. */
export function clearTrainingCache(): void {
  cache.clear();
}

async function load(today: string): Promise<TrainingData> {
  const runs = [...(await runningStore().listRuns())].sort((a, b) => b.date.localeCompare(a.date) || b.distance_m - a.distance_m || a.id.localeCompare(b.id));
  return {
    today,
    runs,
    summary: trainingSummary(runs, today),
    years: runYears(runs),
    races: runs.filter((r) => r.is_race),
    devices: runDevices(runs),
    raceSlugs: (await loadRaces(today)).slugByRun,
  };
}

/** A year's runs, newest first. */
export function runsInYear(data: TrainingData, year: number): Run[] {
  const prefix = `${year}-`;
  return data.runs.filter((r) => r.date.startsWith(prefix));
}
