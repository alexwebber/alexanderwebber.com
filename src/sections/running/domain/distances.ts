// Named race distances (data-model §4). The table is schemas/distances.json, which ingest reads
// too, and a contract test keeps the schemas' distance names in step with it.
import distances from '../../../../schemas/distances.json' with { type: 'json' };

/** Metres for each distance name the owner may use. */
export const DISTANCES_M: Readonly<typeof distances> = distances;
export type DistanceName = keyof typeof distances;

export function isDistanceName(value: unknown): value is DistanceName {
  return typeof value === 'string' && Object.hasOwn(DISTANCES_M, value);
}

/** Metres for a distance name or a number of metres. Undefined when neither. */
export function parseDistance(value: string | number): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  return isDistanceName(value) ? DISTANCES_M[value] : undefined;
}
