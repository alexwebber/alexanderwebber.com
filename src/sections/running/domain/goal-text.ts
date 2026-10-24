// Words and figures for goal cards (T090): units per FR-075 (kg, %, h:mm:ss, UK dates). Pure, so
// the Goals page, the landing page's featured goals and the share image say the same thing.
import { formatDate } from '../../../shared/format/dates.ts';
import { formatDuration, formatKm } from '../../../shared/format/units.ts';
import { sameDistance } from './efforts.ts';
import { subLabel } from './races.ts';
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

/** "Half marathon" from "half marathon": a label at the start of a line or cell. */
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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

/**
 * "Sub-43:00 10k", "Sub-3:20 marathon", "93 kg or less", "52.5 or more", or undefined for a
 * milestone. Race targets read as runners say them (owner, 2026-10-23): "sub-3:20" means under
 * 3:20:00, which is how achievement is judged.
 */
export function targetText(evaluation: GoalEvaluation): string | undefined {
  if (evaluation.kind === 'race_time') {
    const label = subLabel(evaluation.target_s);
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${distanceLabel(evaluation.distance_m)}`;
  }
  if (evaluation.kind === 'value') return `${formatMetric(evaluation.metric, evaluation.target)} or ${evaluation.direction === 'at_most' ? 'less' : 'more'}`;
  return undefined;
}

/** "163 days left", "1 day left", "Deadline today", "Deadline passed". */
export function deadlineText(daysToDeadline: number): string {
  if (daysToDeadline < 0) return 'Deadline passed';
  if (daysToDeadline === 0) return 'Deadline today';
  return `${daysToDeadline} ${daysToDeadline === 1 ? 'day' : 'days'} left`;
}

/**
 * "3:00 to go", "Under a second to go" (a time that rounds to the target, which doesn't count as
 * under it) or "Beaten by 0:16" (a race-time goal's gap, FR-039).
 */
export function gapText(evaluation: RaceTimeEvaluation): string | undefined {
  const gap = evaluation.gap_s;
  if (gap === undefined) return undefined;
  if (gap === 0) return 'Under a second to go';
  return gap > 0 ? `${formatDuration(gap)} to go` : `Beaten by ${formatDuration(-gap)}`;
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

/** A card's short target: "sub-3:20" for a race time, "93 kg" for a value. */
export function shortTargetText(evaluation: RaceTimeEvaluation | ValueEvaluation): string {
  return evaluation.kind === 'race_time' ? subLabel(evaluation.target_s) : formatMetric(evaluation.metric, evaluation.target);
}

/** "127.6 kg on 2 Jun 2025", or "37" for an undated start; undefined without a start. */
export function startText(evaluation: ValueEvaluation): string | undefined {
  if (evaluation.start === undefined) return undefined;
  const value = formatMetric(evaluation.metric, evaluation.start, true);
  return evaluation.startDate ? `${value} on ${formatDate(evaluation.startDate)}` : value;
}

/**
 * The change since the owner's all-time reference reading, from the current value:
 * "32.1 kg down since 31 Jan 2023 (133.2 kg)". Undefined without both, or with no change.
 */
export function allTimeText(evaluation: ValueEvaluation): string | undefined {
  const { allTimeStart: from, current } = evaluation;
  if (!from || !current) return undefined;
  return changeSinceText(evaluation.metric, from, current.value);
}

/**
 * The change since the goal's dated start, from the current value: "26.5 kg down since 2 Jun 2025
 * (127.6 kg)" (the health page's weight header, owner 2026-10-24). Undefined for an undated start,
 * with no data, or with no change.
 */
export function startChangeText(evaluation: ValueEvaluation): string | undefined {
  const { start, startDate, current } = evaluation;
  if (start === undefined || !startDate || !current) return undefined;
  return changeSinceText(evaluation.metric, { date: startDate, value: start }, current.value);
}

/** "<amount> down|up since <date> (<from value>)", or undefined with no change (to one decimal). */
export function changeSinceText(metric: ValueMetric, from: { date: string; value: number }, now: number): string | undefined {
  const change = Math.round((now - from.value) * 10) / 10;
  if (change === 0) return undefined;
  const amount = formatMetric(metric, Math.abs(change), true);
  return `${amount} ${change < 0 ? 'down' : 'up'} since ${formatDate(from.date)} (${formatMetric(metric, from.value, true)})`;
}

/** What the progress bar says, in words (its value text, and the line under it). */
export function progressText(evaluation: RaceTimeEvaluation | ValueEvaluation): string | undefined {
  if (evaluation.fraction === undefined) return undefined;
  const percent = Math.round(evaluation.fraction * 100);
  if (evaluation.kind === 'race_time') {
    const fastest = formatDuration(evaluation.fastest!.time_s);
    const gap = evaluation.gap_s!;
    const target = subLabel(evaluation.target_s);
    if (gap < 0) return `Fastest ${fastest}: ${target} by ${formatDuration(-gap)}`;
    const off = gap === 0 ? 'under a second' : formatDuration(gap);
    return `Fastest ${fastest}, ${off} off ${target} (${percent}% of the target pace)`;
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
