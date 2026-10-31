// Build-time RunningStore over the JSON/YAML files in data/running/ (T037). Every file is
// validated against schemas/ on first use; any problem throws DataValidationError, which fails
// the build with the FR-070 file/entry/field message. Loaded once per store and memoised.
import { DataValidationError } from '../../../../shared/storage/index.ts';
import { loadRunningData, type RunningData } from './files.ts';
import type {
  CampaignFigures,
  DateRange,
  HealthMetric,
  HealthPoint,
  OwnerData,
  RaceTrack,
  RefreshRecord,
  Run,
  RunningStore,
} from './running-store.ts';

interface Indexed {
  data: RunningData;
  runs: Run[];
  runsById: Map<string, Run>;
  tracksById: Map<string, RaceTrack>;
  health: Map<HealthMetric, HealthPoint[]>;
  owner: OwnerData;
}

export class JsonFileStore implements RunningStore {
  readonly #root: string;
  readonly #schemaRoot: string;
  #indexed: Indexed | undefined;

  /**
   * `root` is the repository root (holding data/ and schemas/). `schemaRoot` holds schemas/ when
   * it lives elsewhere (a fixture data tree validated against the repository's schemas).
   */
  constructor(root: string = process.cwd(), schemaRoot: string = root) {
    this.#root = root;
    this.#schemaRoot = schemaRoot;
  }

  #load(): Indexed {
    if (this.#indexed) return this.#indexed;
    const { data, issues } = loadRunningData(this.#root, this.#schemaRoot);
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) throw new DataValidationError(errors);

    const health = new Map<HealthMetric, HealthPoint[]>();
    for (const { value } of data.health) {
      const points = health.get(value.metric) ?? [];
      points.push(...value.points);
      health.set(value.metric, points);
    }
    for (const points of health.values()) points.sort((a, b) => a.date.localeCompare(b.date));

    const runs = data.runs.map((r) => r.value);
    this.#indexed = {
      data,
      runs,
      runsById: new Map(runs.map((run) => [run.id, run])),
      tracksById: new Map(data.raceTracks.map((t) => [t.value.id, t.value])),
      health,
      owner: {
        section: data.section?.value,
        goals: data.goals?.value ?? [],
        upcomingRaces: data.upcomingRaces?.value ?? [],
        races: data.races.map((r) => r.value),
        overrides: data.overrides?.value ?? [],
        exclusions: data.exclusions?.value ?? [],
        lab: data.lab.map((l) => l.value),
        manualMetrics: {
          training_status: data.manualMetrics?.value.training_status ?? [],
          race_predictions: data.manualMetrics?.value.race_predictions ?? [],
        },
        campaigns: data.campaigns?.value ?? [],
      },
    };
    return this.#indexed;
  }

  async listRuns(): Promise<Run[]> {
    return [...this.#load().runs];
  }

  async getRun(runId: string): Promise<Run | undefined> {
    return this.#load().runsById.get(runId);
  }

  async getRaceTrack(runId: string): Promise<RaceTrack | undefined> {
    return this.#load().tracksById.get(runId);
  }

  async getHealthSeries(metric: HealthMetric, range: DateRange = {}): Promise<HealthPoint[]> {
    const points = this.#load().health.get(metric) ?? [];
    return points.filter(
      (p) => (range.from === undefined || p.date >= range.from) && (range.to === undefined || p.date <= range.to),
    );
  }

  async getRefreshRecord(): Promise<RefreshRecord | undefined> {
    return this.#load().data.refresh?.value;
  }

  async getCampaignFigures(): Promise<CampaignFigures[]> {
    return this.#load().data.fundraising.map((f) => f.value);
  }

  async getOwner(): Promise<OwnerData> {
    return this.#load().owner;
  }
}
