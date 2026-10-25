// Parsing of owner-entered times (YAML, data-model §4).

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
