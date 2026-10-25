// Running pace for display (FR-075). The generic units (km, h:mm:ss, kg) are in shared/format.
import { formatDuration } from '../../../shared/format/units.ts';

/** "4:28 /km" (seconds per km in). */
export function formatPace(secondsPerKm: number): string {
  return `${formatDuration(secondsPerKm)} /km`;
}
