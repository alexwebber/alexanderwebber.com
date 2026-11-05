// The owner data of a fake RunningStore: every owner file absent, with any field overridden. A new
// owner file adds its empty value here, once, instead of in each test's fake store.
import type { OwnerData } from '../../src/sections/running/data/store/index.ts';

export function emptyOwner(overrides: Partial<OwnerData> = {}): OwnerData {
  return {
    section: undefined,
    goals: [],
    upcomingRaces: [],
    races: [],
    overrides: [],
    exclusions: [],
    lab: [],
    manualMetrics: { training_status: [], race_predictions: [] },
    campaigns: [],
    stories: [],
    ...overrides,
  };
}
