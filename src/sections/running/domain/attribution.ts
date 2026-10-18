// Which Garmin devices a view's attribution names (FR-077, T152). Each run carries the watch that
// recorded it (`device`, from intervals.icu); a view over several runs names each watch once,
// newest first. Past MAX_DEVICES the list stops being useful, so it falls back to plain "Garmin",
// which the guidelines allow when the device isn't known.
import type { Run } from '../../../shared/storage/index.ts';

export const MAX_DEVICES = 3;

/** The distinct watches behind `runs` (newest-first input gives newest-first output). */
export function runDevices(runs: readonly Pick<Run, 'device'>[]): string[] {
  const devices = [...new Set(runs.flatMap((run) => (run.device ? [run.device] : [])))];
  return devices.length > MAX_DEVICES ? [] : devices;
}
