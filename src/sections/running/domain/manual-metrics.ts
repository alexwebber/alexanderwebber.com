// The owner's manual Garmin figures (T153, FR-069): Garmin training status and race predictions,
// which intervals.icu doesn't supply. They are dated owner entries in manual-metrics.yaml, read
// in Garmin Connect. The latest `as_of` is current and earlier entries are the trend. With no
// entry the figure is "not recorded yet", never a value. Every display shows its "as of" date
// (AsOf.astro) and plain "Garmin" attribution (no device is recorded for them).
//
// Pure functions over the loader's `manualMetrics`; `currentManualMetrics()` reads it from the store.
import { parseTime } from '../../../shared/format/parse.ts';
import { runningStore } from '../data/load.ts';
import type { OwnerData, RacePredictionEntry, TrainingStatusEntry } from '../data/store/index.ts';
import { DISTANCES_M } from './distances.ts';

export type ManualMetrics = OwnerData['manualMetrics'];
export type TrainingStatus = TrainingStatusEntry['status'];

/** The distances Garmin predicts, with their lengths in metres. */
export const PREDICTION_DISTANCES = {
  '5k': DISTANCES_M['5k'],
  '10k': DISTANCES_M['10k'],
  half: DISTANCES_M.half,
  marathon: DISTANCES_M.marathon,
} as const;
export type PredictionDistance = keyof typeof PREDICTION_DISTANCES;

/** Display names for Garmin's training statuses. */
export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  peaking: 'Peaking',
  productive: 'Productive',
  maintaining: 'Maintaining',
  recovery: 'Recovery',
  unproductive: 'Unproductive',
  detraining: 'Detraining',
  overreaching: 'Overreaching',
  strained: 'Strained',
  no_status: 'No status',
};

export interface CurrentTrainingStatus {
  status: TrainingStatus;
  label: string;
  note?: string;
  /** The day the owner read it in Garmin Connect, YYYY-MM-DD. */
  as_of: string;
}

export interface Prediction {
  distance: PredictionDistance;
  /** As the owner entered it, e.g. "3:25:18". */
  time: string;
  seconds: number;
  as_of: string;
}

export interface CurrentManualMetrics {
  /** Undefined: not recorded yet. */
  trainingStatus: CurrentTrainingStatus | undefined;
  /** The latest prediction per distance; a distance with no entry is absent (not recorded yet). */
  predictions: Partial<Record<PredictionDistance, Prediction>>;
}

const byDate = <T extends { as_of: string }>(a: T, b: T) => a.as_of.localeCompare(b.as_of);

/** Training status entries, oldest first (the trend). */
export function trainingStatusHistory(metrics: ManualMetrics): CurrentTrainingStatus[] {
  return [...metrics.training_status].sort(byDate).map((entry) => ({
    status: entry.status,
    label: TRAINING_STATUS_LABELS[entry.status],
    ...(entry.note ? { note: entry.note } : {}),
    as_of: entry.as_of,
  }));
}

/** One distance's predictions, oldest first (the trend). Entries without that distance are skipped. */
export function predictionHistory(metrics: ManualMetrics, distance: PredictionDistance): Prediction[] {
  return [...metrics.race_predictions].sort(byDate).flatMap((entry: RacePredictionEntry) => {
    const time = entry[distance];
    const seconds = time === undefined ? undefined : parseTime(time);
    return time === undefined || seconds === undefined ? [] : [{ distance, time, seconds, as_of: entry.as_of }];
  });
}

/** The current figures: the latest entry per list, and per distance for predictions. */
export function latestManualMetrics(metrics: ManualMetrics): CurrentManualMetrics {
  const predictions: Partial<Record<PredictionDistance, Prediction>> = {};
  for (const distance of Object.keys(PREDICTION_DISTANCES) as PredictionDistance[]) {
    const latest = predictionHistory(metrics, distance).at(-1);
    if (latest) predictions[distance] = latest;
  }
  return { trainingStatus: trainingStatusHistory(metrics).at(-1), predictions };
}

/** The prediction distance a goal distance is (within half a metre), if Garmin predicts it. */
export function predictionDistanceFor(distanceM: number): PredictionDistance | undefined {
  return (Object.entries(PREDICTION_DISTANCES) as [PredictionDistance, number][]).find(([, m]) => Math.abs(m - distanceM) <= 0.5)?.[0];
}

/** The current manual figures from the store. */
export async function currentManualMetrics(): Promise<CurrentManualMetrics> {
  return latestManualMetrics((await runningStore().getOwner()).manualMetrics);
}
