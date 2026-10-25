// The Training area's data (T120, US3): every published run, the period totals for `today`
// (Europe/London) and the years that have runs. Shared by the hub and the year pages, and
// memoised per store and day, so thousands of runs are summed once, not once per page.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { runDevices } from '../domain/attribution.ts';
import { runYears, trainingSummary, type Summary } from '../domain/periods.ts';
import { runningStore } from './load.ts';
import { perStoreAndDay } from './memo.ts';
import { loadRaces } from './races.ts';
import type { Run, RunningStore } from './store/index.ts';

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

export function loadTraining(today: string = londonToday(), store: RunningStore = runningStore()): Promise<TrainingData> {
  return load(today, store);
}

const load = perStoreAndDay(async (today, store): Promise<TrainingData> => {
  const runs = [...(await store.listRuns())].sort((a, b) => b.date.localeCompare(a.date) || b.distance_m - a.distance_m || a.id.localeCompare(b.id));
  return {
    today,
    runs,
    summary: trainingSummary(runs, today),
    years: runYears(runs),
    races: runs.filter((r) => r.is_race),
    devices: runDevices(runs),
    raceSlugs: (await loadRaces(today, store)).slugByRun,
  };
});

/** A year's runs, newest first. */
export function runsInYear(data: TrainingData, year: number): Run[] {
  const prefix = `${year}-`;
  return data.runs.filter((r) => r.date.startsWith(prefix));
}
