// The landing page's data (T101, US1): the focus race and its training build, this week, the latest
// run and the featured goals, evaluated for `today` (Europe/London). Shared by the page and its
// share image, so both say the same thing. Memoised per build and day.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { featuredGoals, type GoalEvaluation } from '../domain/goals.ts';
import { latestManualMetrics, predictionDistanceFor, type Prediction } from '../domain/manual-metrics.ts';
import { daysRemaining, focusRace, raceDistance, raceResult, raceState, targetLabel, type RaceResult, type RaceState } from '../domain/races.ts';
import { latestRun, trainingBuild, weekSnapshot, type LatestRun, type TrainingBuild, type WeekSnapshot } from '../domain/weeks.ts';
import { loadGoals } from './goals.ts';
import { runningStore, sectionSettings } from './load.ts';
import type { Run, UpcomingRace } from './store/index.ts';

export interface FocusRaceView {
  race: UpcomingRace;
  state: RaceState;
  /** Whole days to race day at build time (0 on the day, negative after). */
  days: number;
  /** "sub-3:25" from the race's target_time; undefined without one. */
  target?: string;
  /** The owner's latest Garmin prediction at the race distance, before and on race day only. */
  prediction?: Prediction;
  /** section.yaml focus_race.charity.name */
  charity: string;
  /** The result once the owner records it (state completed). */
  result?: RaceResult;
  /** Weekly distance since section.yaml build_start, and the longest run (FR-021). */
  build: TrainingBuild<Run>;
}

export interface LandingData {
  today: string;
  /** Undefined until section.yaml names a focus race that upcoming-races.yaml has. */
  focus?: FocusRaceView;
  week: WeekSnapshot;
  /** This week's runs, newest first. */
  weekRuns: Run[];
  /** Last week's runs, newest first. */
  lastWeekRuns: Run[];
  latest?: LatestRun<Run>;
  featured: GoalEvaluation[];
}

const cache = new Map<string, Promise<LandingData>>();

export function loadLanding(today: string = londonToday()): Promise<LandingData> {
  let data = cache.get(today);
  if (!data) {
    data = load(today);
    cache.set(today, data);
  }
  return data;
}

/** Tests swap the store; this drops data loaded from the old one. */
export function clearLandingCache(): void {
  cache.clear();
}

async function load(today: string): Promise<LandingData> {
  const store = runningStore();
  const [owner, runs, settings, goals] = await Promise.all([store.getOwner(), store.listRuns(), sectionSettings(), loadGoals(today)]);
  const week = weekSnapshot(runs, today);
  const inWeek = (w: { start: string; end: string }) => runs.filter((r) => r.date >= w.start && r.date <= w.end);
  const weekRuns = inWeek(week.thisWeek);
  const lastWeekRuns = inWeek(week.lastWeek);
  const latest = latestRun(runs);

  let focus: FocusRaceView | undefined;
  const race = focusRace(owner.section, owner.upcomingRaces);
  if (race && settings.focus_race) {
    const state = raceState(race, today);
    const distance = raceDistance(race);
    const key = distance === undefined ? undefined : predictionDistanceFor(distance);
    const prediction = key && (state === 'upcoming' || state === 'race_day') ? latestManualMetrics(owner.manualMetrics).predictions[key] : undefined;
    const target = race.target_time ? targetLabel(race.target_time) : undefined;
    const result = state === 'completed' ? raceResult(race, owner.races, runs) : undefined;
    focus = {
      race,
      state,
      days: daysRemaining(race, today),
      ...(target ? { target } : {}),
      ...(prediction ? { prediction } : {}),
      charity: settings.focus_race.charity.name,
      ...(result ? { result } : {}),
      build: trainingBuild(runs, settings.focus_race.build_start, today, race.date),
    };
  }

  return {
    today,
    ...(focus ? { focus } : {}),
    week,
    weekRuns,
    lastWeekRuns,
    ...(latest ? { latest } : {}),
    featured: featuredGoals(goals.evaluations, settings.featured_goal_limit),
  };
}
