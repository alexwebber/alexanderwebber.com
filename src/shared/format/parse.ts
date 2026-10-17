// Parsing of owner-entered values (YAML): times and distances (data-model §4).

/** Metres for each distance name the owner may use. */
export const DISTANCES_M = {
  '1k': 1000,
  '1mi': 1609.344,
  '3k': 3000,
  '5k': 5000,
  '10k': 10000,
  '15k': 15000,
  '10mi': 16093.44,
  '20k': 20000,
  half: 21097.5,
  '30k': 30000,
  marathon: 42195,
} as const;
export type DistanceName = keyof typeof DISTANCES_M;

const MAX_TIME_S = 24 * 3600;

/**
 * Seconds for an owner time string, `h:mm:ss` or `mm:ss` (e.g. "3:30:00", "44:59").
 * Returns undefined when the text is not a valid time or is out of range (zero, or a day or more).
 */
export function parseTime(text: string): number | undefined {
  const match = /^(?:(\d{1,2}):([0-5]\d):([0-5]\d)|(\d{1,3}):([0-5]\d))$/.exec(text);
  if (!match) return undefined;
  const seconds = match[1] !== undefined
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : Number(match[4]) * 60 + Number(match[5]);
  return seconds > 0 && seconds < MAX_TIME_S ? seconds : undefined;
}

export function isDistanceName(value: unknown): value is DistanceName {
  return typeof value === 'string' && Object.hasOwn(DISTANCES_M, value);
}

/** Metres for a distance name or a number of metres. Undefined when neither. */
export function parseDistance(value: string | number): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  return isDistanceName(value) ? DISTANCES_M[value] : undefined;
}
