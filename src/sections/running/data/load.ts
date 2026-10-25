// The Running section's data loader (T076): every Running page and component reads data through
// here, never through files. It wraps the shared RunningStore (contracts/storage.md), which
// validates every file against schemas/ on first use and throws DataValidationError (failing the
// build with the FR-070 file/entry/field message) on any problem. Results are memoised per store.
import sectionSchema from '../../../../schemas/owner/section.schema.json' with { type: 'json' };
import { perStore } from './memo.ts';
import { JsonFileStore, type RunningStore, type SectionSettings } from './store/index.ts';

let store: RunningStore | undefined;

/** The store every Running page reads from (data/running/ under the repo root). */
export function runningStore(): RunningStore {
  store ??= new JsonFileStore();
  return store;
}

/** Tests swap in a store over fixtures; `undefined` restores the default. */
export function setRunningStore(next: RunningStore | undefined): void {
  store = next;
}

/**
 * section.yaml's defaults, read from its schema: the one source. ajv fills the same ones into
 * section.yaml when it exists; these stand in before it does.
 */
export const SECTION_DEFAULTS = {
  stale_after_hours: sectionSchema.properties.stale_after_hours.default,
  featured_goal_limit: sectionSchema.properties.featured_goal_limit.default,
  recent_highlight_days: sectionSchema.properties.recent_highlight_days.default,
};

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
export function sectionSettings(from: RunningStore = runningStore()): Promise<Settings> {
  return settings(from);
}

const settings = perStore(async (from): Promise<Settings> => {
  const { section } = await from.getOwner();
  return {
    stale_after_hours: section?.stale_after_hours ?? SECTION_DEFAULTS.stale_after_hours,
    featured_goal_limit: section?.featured_goal_limit ?? SECTION_DEFAULTS.featured_goal_limit,
    recent_highlight_days: { ...SECTION_DEFAULTS.recent_highlight_days, ...section?.recent_highlight_days },
    focus_race: section?.focus_race,
    story_link: section?.story_link,
    garmin_devices: { ...section?.garmin_devices },
  };
});

export interface Freshness {
  /** The last successful fetch as known at build time (refresh.json); undefined before the first publish. */
  lastSuccessAt: string | undefined;
  staleAfterHours: number;
}

/** What LastUpdated shows without JS (FR-005/006). */
export function buildFreshness(from: RunningStore = runningStore()): Promise<Freshness> {
  return freshness(from);
}

const freshness = perStore(async (from): Promise<Freshness> => {
  const [refresh, s] = await Promise.all([from.getRefreshRecord(), sectionSettings(from)]);
  return { lastSuccessAt: refresh?.sources.intervals.last_success_at_build, staleAfterHours: s.stale_after_hours };
});
