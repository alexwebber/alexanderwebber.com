// The Running section's data loader (T076): every Running page and component reads data through
// here, never through files. It wraps the shared RunningStore (contracts/storage.md), which
// validates every file against schemas/ on first use and throws DataValidationError (failing the
// build with the FR-070 file/entry/field message) on any problem. Results are memoised per build.
import { JsonFileStore, type RunningStore, type SectionSettings } from './store/index.ts';

let store: RunningStore | undefined;
let settings: Promise<Settings> | undefined;
let freshness: Promise<Freshness> | undefined;

/** The store every Running page reads from (data/running/ under the repo root). */
export function runningStore(): RunningStore {
  store ??= new JsonFileStore();
  return store;
}

/** Tests swap in a store over fixtures; `undefined` restores the default. */
export function setRunningStore(next: RunningStore | undefined): void {
  store = next;
  settings = undefined;
  freshness = undefined;
}

/** schemas/owner/section.schema.json defaults; a test keeps them in step with the schema. */
export const SECTION_DEFAULTS = {
  stale_after_hours: 12,
  featured_goal_limit: 6,
  recent_highlight_days: { pb: 14, goal: 14 },
} as const;

export interface Settings {
  stale_after_hours: number;
  featured_goal_limit: number;
  recent_highlight_days: { pb: number; goal: number };
  /** Undefined until section.yaml exists. */
  focus_race: SectionSettings['focus_race'] | undefined;
  story_link: SectionSettings['story_link'];
  /** Devices the data doesn't name itself (FR-077); runs carry their own watch. */
  garmin_devices: { scale?: string };
}

/** section.yaml with every default filled in, also before the file exists. */
export function sectionSettings(): Promise<Settings> {
  settings ??= runningStore()
    .getOwner()
    .then(({ section }) => ({
      stale_after_hours: section?.stale_after_hours ?? SECTION_DEFAULTS.stale_after_hours,
      featured_goal_limit: section?.featured_goal_limit ?? SECTION_DEFAULTS.featured_goal_limit,
      recent_highlight_days: {
        pb: section?.recent_highlight_days?.pb ?? SECTION_DEFAULTS.recent_highlight_days.pb,
        goal: section?.recent_highlight_days?.goal ?? SECTION_DEFAULTS.recent_highlight_days.goal,
      },
      focus_race: section?.focus_race,
      story_link: section?.story_link,
      garmin_devices: { ...section?.garmin_devices },
    }));
  return settings;
}

export interface Freshness {
  /** The last successful fetch as known at build time (refresh.json); undefined before the first publish. */
  lastSuccessAt: string | undefined;
  staleAfterHours: number;
}

/** What LastUpdated shows without JS (FR-005/006). */
export function buildFreshness(): Promise<Freshness> {
  freshness ??= Promise.all([runningStore().getRefreshRecord(), sectionSettings()]).then(([refresh, s]) => ({
    lastSuccessAt: refresh?.sources.intervals.last_success_at_build,
    staleAfterHours: s.stale_after_hours,
  }));
  return freshness;
}
