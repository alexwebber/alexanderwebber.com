// Body-composition 7-day averages for goal evaluation (T088; FR-034, data-model §5).
//
// - Weight: the published `weight_avg7` series already is the trailing 7-day mean (individual
//   weigh-ins are never published, FR-061), so it is used as it is.
// - Body fat: published as recorded (FR-062). Its trailing 7-day mean is computed here at build
//   time from the recorded readings. A day whose window holds no reading has no value (no value is
//   carried forward). The mean is only used to judge goals and their progress; it is never stored
//   and never shown as the headline figure (the latest recorded reading is).
//
// Owner exclusions (health-exclusions.yaml) are already removed from the published series.
import { addDays, daysBetween } from '../../../shared/format/dates.ts';

export interface DatedValue {
  /** YYYY-MM-DD, Europe/London. */
  date: string;
  value: number;
}

export const WINDOW_DAYS = 7;

/**
 * The trailing 7-day mean (the day and the six before it) of `readings`, one point per calendar
 * day from the first reading to `until` (default: the last reading), oldest first. Days with no
 * reading in their window are left out. Means are rounded to one decimal, like the readings.
 * Two readings on one day both count (intervals.icu stores one per day, so that doesn't happen).
 */
export function trailingMean(readings: readonly DatedValue[], until?: string, windowDays = WINDOW_DAYS): DatedValue[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  const last = until ?? sorted.at(-1)!.date;
  const out: DatedValue[] = [];
  let start = 0; // first reading inside the window
  let end = 0; // first reading after the window
  for (let day = sorted[0]!.date; daysBetween(day, last) >= 0; day = addDays(day, 1)) {
    while (end < sorted.length && sorted[end]!.date <= day) end++;
    const from = addDays(day, -(windowDays - 1));
    while (start < end && sorted[start]!.date < from) start++;
    if (end > start) {
      // Summed afresh per day (at most a few readings), so no rounding error builds up.
      const window = sorted.slice(start, end);
      const mean = window.reduce((sum, r) => sum + r.value, 0) / window.length;
      out.push({ date: day, value: Math.round(mean * 10) / 10 });
    }
  }
  return out;
}

/** Body fat's 7-day average series (build-time only). */
export function bodyFatAverage(readings: readonly DatedValue[], until?: string): DatedValue[] {
  return trailingMean(readings, until);
}

/** Weight's 7-day average series: the published `weight_avg7` points as they are. */
export function weightAverage(weightAvg7: readonly DatedValue[]): DatedValue[] {
  return [...weightAvg7].sort((a, b) => a.date.localeCompare(b.date));
}
