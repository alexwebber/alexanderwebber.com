// The site's read interface over Running data (contracts/storage.md). Section code depends only
// on this, so a future database-backed store is a drop-in replacement for JsonFileStore.
import type {
  BodyCompositionGoal,
  Campaign,
  CampaignFigures,
  CampaignStory,
  Goal,
  HealthExclusion,
  HealthSeries,
  LabMeasurement,
  MetricGoal,
  MilestoneGoal,
  Race,
  RacePredictionEntry,
  RaceTimeGoal,
  RaceTrack,
  RefreshRecord,
  Run,
  RunOverride,
  SectionSettings,
  TrainingStatusEntry,
  UpcomingRace,
} from './generated/index.ts';

export type {
  BodyCompositionGoal,
  Campaign,
  CampaignFigures,
  CampaignStory,
  Goal,
  HealthExclusion,
  HealthSeries,
  LabMeasurement,
  MetricGoal,
  MilestoneGoal,
  Race,
  RacePredictionEntry,
  RaceTimeGoal,
  RaceTrack,
  RefreshRecord,
  Run,
  RunOverride,
  SectionSettings,
  TrainingStatusEntry,
  UpcomingRace,
};

export type HealthMetric = HealthSeries['metric'];
export type HealthPoint = HealthSeries['points'][number];

/** Inclusive YYYY-MM-DD bounds; either may be left open. */
export interface DateRange {
  from?: string;
  to?: string;
}

/** Everything the owner edits by hand, validated, with schema defaults filled in. */
export interface OwnerData {
  /** Undefined until section.yaml exists. */
  section: SectionSettings | undefined;
  goals: Goal[];
  upcomingRaces: UpcomingRace[];
  /** One per races/<slug>/race.yaml, sorted by date, newest first. */
  races: Race[];
  overrides: RunOverride[];
  exclusions: HealthExclusion[];
  /** Sorted by date, oldest first. */
  lab: LabMeasurement[];
  /** Empty lists until manual-metrics.yaml exists ("not recorded yet"). */
  manualMetrics: {
    training_status: TrainingStatusEntry[];
    race_predictions: RacePredictionEntry[];
  };
  /** Empty until campaigns.yaml exists. */
  campaigns: Campaign[];
  /** One per stories/<campaign-id>.yaml, all approved: anything else stops validation. */
  stories: CampaignStory[];
}

export interface RunningStore {
  /** Newest first. */
  listRuns(): Promise<Run[]>;
  /** By opaque public run ID. */
  getRun(runId: string): Promise<Run | undefined>;
  getRaceTrack(runId: string): Promise<RaceTrack | undefined>;
  /** Across all years, oldest first. Empty when the metric has no data. */
  getHealthSeries(metric: HealthMetric, range?: DateRange): Promise<HealthPoint[]>;
  /** Undefined before the first publish. */
  getRefreshRecord(): Promise<RefreshRecord | undefined>;
  /** One per published campaign file. Empty before the first read is published. */
  getCampaignFigures(): Promise<CampaignFigures[]>;
  getOwner(): Promise<OwnerData>;
}
