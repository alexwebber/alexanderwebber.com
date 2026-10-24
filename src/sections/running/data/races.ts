// The Races area's data (T128–T133, US4): the race history, the PB table and the upcoming races,
// evaluated for `today` (Europe/London), plus each race's track. Shared by the races page, the
// race pages, their share images and the run list's race links. Memoised per store and day.
//
// Every function takes the store to read, defaulting to the site's own: the test-only race
// preview (SHELL_PREVIEW=1) passes a store of synthetic races through the same code.
import { today as londonToday } from '../../../shared/format/dates.ts';
import type { RaceTrack, RunningStore, UpcomingRace } from '../../../shared/storage/index.ts';
import { buildEffortIndex } from '../domain/efforts.ts';
import { personalBests, racePbSlugs, type PbRow } from '../domain/pbs.ts';
import { daysRemaining, focusRace, raceHistory, raceState, targetLabel, upcomingRaces, type RaceHistoryEntry, type RaceState } from '../domain/races.ts';
import { runningStore, SECTION_DEFAULTS } from './load.ts';

export interface UpcomingView {
  race: UpcomingRace;
  state: RaceState;
  /** Whole days to race day at build time (0 on the day, negative after). */
  days: number;
  /** "sub-3:20" from target_time. */
  target?: string;
  /** The section's focus race (Brighton), listed first. */
  focus: boolean;
}

export interface RacesData {
  today: string;
  /** Newest first. */
  history: RaceHistoryEntry[];
  pbs: PbRow[];
  /** Slug -> whether its race PB is newly set (the history's "PB" badge). */
  pbSlugs: Map<string, boolean>;
  /** Focus race first, then by date; completed races have left (FR-056). */
  upcoming: UpcomingView[];
  /** Recorded run ID -> its race page slug, for run lists and run pages. */
  slugByRun: Map<string, string>;
  /** Race slug -> its published track (races with a map only). */
  tracks: Map<string, RaceTrack>;
}

const cache = new WeakMap<RunningStore, Map<string, Promise<RacesData>>>();

export function loadRaces(today: string = londonToday(), store: RunningStore = runningStore()): Promise<RacesData> {
  let byDay = cache.get(store);
  if (!byDay) cache.set(store, (byDay = new Map()));
  let data = byDay.get(today);
  if (!data) {
    data = load(today, store);
    byDay.set(today, data);
  }
  return data;
}

async function load(today: string, store: RunningStore): Promise<RacesData> {
  const [owner, runs] = await Promise.all([store.getOwner(), store.listRuns()]);
  const history = raceHistory(runs, owner.races);
  const focusId = focusRace(owner.section, owner.upcomingRaces)?.id;
  const upcoming = upcomingRaces(owner.upcomingRaces, focusId, today);
  const pbs = personalBests({
    history,
    efforts: buildEffortIndex(runs, owner.races, owner.overrides),
    overrides: owner.overrides,
    upcoming,
    today,
    highlightDays: owner.section?.recent_highlight_days?.pb ?? SECTION_DEFAULTS.recent_highlight_days.pb,
  });
  const tracks = new Map<string, RaceTrack>();
  for (const entry of history) {
    const track = entry.run?.track_ref ? await store.getRaceTrack(entry.run.id) : undefined;
    if (track) tracks.set(entry.slug, track);
  }
  return {
    today,
    history,
    pbs,
    pbSlugs: racePbSlugs(pbs),
    upcoming: upcoming.map((race) => {
      const target = race.target_time ? targetLabel(race.target_time) : undefined;
      return { race, state: raceState(race, today), days: daysRemaining(race, today), ...(target ? { target } : {}), focus: race.id === focusId };
    }),
    slugByRun: new Map(history.flatMap((entry) => (entry.run ? [[entry.run.id, entry.slug] as const] : []))),
    tracks,
  };
}
