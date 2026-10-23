// Words and figures for goal cards (T090): units per FR-075 (kg, %, h:mm:ss, UK dates). Pure, so
// the Goals page, the landing page's featured goals and the share image say the same thing.
import { formatDate } from '../../../shared/format/dates.ts';
import { formatDuration, formatKm } from '../../../shared/format/units.ts';
import { sameDistance } from './efforts.ts';
import type { GoalEvaluation, RaceTimeEvaluation, ValueEvaluation, ValueMetric } from './goals.ts';

const NAMED: [number, string][] = [
  [5000, '5k'],
  [10000, '10k'],
  [16093.44, '10 miles'],
  [21097.5, 'half marathon'],
  [42195, 'marathon'],
];

/** "5k", "half marathon", or "8.0 km". */
export function distanceLabel(distanceM: number): string {
  return NAMED.find(([m]) => sameDistance(m, distanceM))?.[1] ?? formatKm(distanceM);
}

const UNITS: Record<ValueMetric, { suffix: string; name: string }> = {
  weight_kg: { suffix: ' kg', name: 'Weight' },
  body_fat_pct: { suffix: '%', name: 'Body fat' },
  vo2max: { suffix: '', name: 'VO2 max' },
  resting_hr: { suffix: ' bpm', name: 'Resting heart rate' },
  hrv: { suffix: ' ms', name: 'HRV' },
};

/**
 * A target ("93 kg", "17.5%", "52.5": whole numbers without decimals, others to one decimal), or
 * with `reading`, a measured value: weight and body fat always to one decimal ("26.0%"), like
 * the scale; the rest as recorded.
 */
export function formatMetric(metric: ValueMetric, value: number, reading = false): string {
  const fixed = reading && (metric === 'weight_kg' || metric === 'body_fat_pct') ? 1 : 0;
  const text = new Intl.NumberFormat('en-GB', { minimumFractionDigits: fixed, maximumFractionDigits: 1 }).format(value);
  return `${text}${UNITS[metric].suffix}`;
}

export function metricName(metric: ValueMetric): string {
  return UNITS[metric].name;
}

/** "Under 43:00 for 10k", "93 kg or less", "52.5 or more", or undefined for a milestone. */
export function targetText(evaluation: GoalEvaluation): string | undefined {
  if (evaluation.kind === 'race_time') return `Under ${formatDuration(evaluation.target_s)} for ${distanceLabel(evaluation.distance_m)}`;
  if (evaluation.kind === 'value') return `${formatMetric(evaluation.metric, evaluation.target)} or ${evaluation.direction === 'at_most' ? 'less' : 'more'}`;
  return undefined;
}

/** "163 days left", "1 day left", "Deadline today", "Deadline passed". */
export function deadlineText(daysToDeadline: number): string {
  if (daysToDeadline < 0) return 'Deadline passed';
  if (daysToDeadline === 0) return 'Deadline today';
  return `${daysToDeadline} ${daysToDeadline === 1 ? 'day' : 'days'} left`;
}

/** "3:00 to go" or "Beaten by 0:16" (a race-time goal's gap, FR-039). */
export function gapText(evaluation: RaceTimeEvaluation): string | undefined {
  if (evaluation.gap_s === undefined) return undefined;
  return evaluation.gap_s > 0 ? `${formatDuration(evaluation.gap_s)} to go` : `Beaten by ${formatDuration(-evaluation.gap_s)}`;
}

/**
 * How far a value goal still has to go from its current value (US1.4): "10.0 kg to go",
 * "3.1% to go", "1 to go"; "Target reached" once it is reached; undefined with no data.
 */
export function toGoText(evaluation: ValueEvaluation): string | undefined {
  if (!evaluation.current) return undefined;
  const remaining = evaluation.direction === 'at_most' ? evaluation.current.value - evaluation.target : evaluation.target - evaluation.current.value;
  if (remaining <= 0) return 'Target reached';
  return `${formatMetric(evaluation.metric, remaining, true)} to go`;
}

/** What the progress bar says, in words (its value text, and the line under it). */
export function progressText(evaluation: RaceTimeEvaluation | ValueEvaluation): string | undefined {
  if (evaluation.fraction === undefined) return undefined;
  const percent = Math.round(evaluation.fraction * 100);
  if (evaluation.kind === 'race_time') {
    const fastest = formatDuration(evaluation.fastest!.time_s);
    const gap = evaluation.gap_s!;
    const target = formatDuration(evaluation.target_s);
    return gap > 0
      ? `Fastest ${fastest}, ${formatDuration(gap)} slower than the ${target} target (${percent}% of the target pace)`
      : `Fastest ${fastest}, ${formatDuration(-gap)} faster than the ${target} target`;
  }
  const from = formatMetric(evaluation.metric, evaluation.start!, true);
  const to = formatMetric(evaluation.metric, evaluation.target);
  const now = formatMetric(evaluation.metric, evaluation.current!.value, true);
  const basis = evaluation.averaged ? '7-day average' : 'Latest';
  return `${basis} ${now}: ${percent}% of the way from ${from} to ${to}`;
}

/** The effort that achieved a race-time goal, in words: "19:44 for 5k on 17 Oct 2026". */
export function effortText(evaluation: RaceTimeEvaluation, effort = evaluation.fastest): string | undefined {
  if (!effort) return undefined;
  return `${formatDuration(effort.time_s)} for ${distanceLabel(effort.distance_m)} on ${formatDate(effort.date)}`;
}
