// What a run's detail page shows (T116–T119, T160; FR-047, FR-048, FR-013). Pure functions over a
// published run. Anything the watch didn't record is left out, never shown as 0 (FR-048): figures
// come back only when present, and a chart only when its series has values.
//
// Charts plot against distance or elapsed time, never clock time (FR-013): a published run holds
// no time of day at all. Pace plots with faster higher (as on Garmin Connect), on a range cut to
// the 2nd–98th percentile (cadence and power too), so a few seconds of standing still don't
// flatten the line; the summary and table still give the full range.
import { formatDuration, formatKm, formatMetres } from '../../../shared/format/units.ts';
import type { Run } from '../data/store/index.ts';
import { formatPace } from './pace.ts';

export interface Figure {
  key: string;
  label: string;
  value: string;
}

const number = (value: number, decimals = 0) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

/** The summary figures (T116): distance, times, paces, elevation, heart rate, training effect. */
export function summaryFigures(run: Run): Figure[] {
  const figures: Figure[] = [
    { key: 'distance', label: 'Distance', value: formatKm(run.distance_m, 2) },
    { key: 'moving-time', label: 'Moving time', value: formatDuration(run.moving_s) },
    { key: 'elapsed-time', label: 'Elapsed time', value: formatDuration(run.elapsed_s) },
    { key: 'pace', label: 'Average pace', value: formatPace(run.avg_pace_s_per_km) },
  ];
  // Best pace is the fastest kilometre; on a run under a kilometre it is just the average.
  if (run.best_pace_s_per_km < run.avg_pace_s_per_km) {
    figures.push({ key: 'best-pace', label: 'Best pace', value: formatPace(run.best_pace_s_per_km) });
  }
  if (run.elevation_gain_m !== undefined) figures.push({ key: 'elevation-gain', label: 'Elevation gain', value: formatMetres(run.elevation_gain_m) });
  if (run.elevation_loss_m !== undefined) figures.push({ key: 'elevation-loss', label: 'Elevation loss', value: formatMetres(run.elevation_loss_m) });
  if (run.hr) {
    figures.push({ key: 'avg-hr', label: 'Average heart rate', value: `${Math.round(run.hr.avg)} bpm` });
    figures.push({ key: 'max-hr', label: 'Max heart rate', value: `${Math.round(run.hr.max)} bpm` });
  }
  if (run.training_effect) {
    figures.push({ key: 'training-effect', label: 'Training effect', value: `${number(run.training_effect.aerobic, 1)} aerobic, ${number(run.training_effect.anaerobic, 1)} anaerobic` });
  }
  return figures;
}

/** Running dynamics and power (T118), each only when recorded. */
export function dynamicsFigures(run: Run): Figure[] {
  const d = run.dynamics ?? {};
  const figures: Figure[] = [];
  // "spm", never "steps": the privacy scan treats "<number> steps" on a page as step counts.
  if (run.cadence_avg !== undefined) figures.push({ key: 'cadence', label: 'Cadence', value: `${Math.round(run.cadence_avg)} spm` });
  if (run.stride_m_avg !== undefined) figures.push({ key: 'stride', label: 'Stride length', value: `${number(run.stride_m_avg, 2)} m` });
  if (run.power_w_avg !== undefined) figures.push({ key: 'power', label: 'Average power', value: `${Math.round(run.power_w_avg)} W` });
  if (d.gct_ms !== undefined) figures.push({ key: 'gct', label: 'Ground contact time', value: `${Math.round(d.gct_ms)} ms` });
  if (d.gct_balance_pct !== undefined) {
    figures.push({ key: 'gct-balance', label: 'Ground contact balance', value: `${number(d.gct_balance_pct, 1)}% L / ${number(100 - d.gct_balance_pct, 1)}% R` });
  }
  if (d.vert_osc_mm !== undefined) figures.push({ key: 'vertical-oscillation', label: 'Vertical oscillation', value: `${number(d.vert_osc_mm / 10, 1)} cm` });
  if (d.vert_ratio_pct !== undefined) figures.push({ key: 'vertical-ratio', label: 'Vertical ratio', value: `${number(d.vert_ratio_pct, 1)}%` });
  return figures;
}

export interface SplitRow {
  /** "1", "2" ... and for a last part-kilometre the distance it ends at, e.g. "10.07". */
  km: string;
  partial: boolean;
  time_s: number;
  pace_s_per_km: number;
  hr?: number;
  elev_delta_m?: number;
}

/** Per-km splits (T117). The last split is partial when the run doesn't end on a kilometre. */
export function splitRows(run: Run): SplitRow[] {
  return run.splits.map((s) => {
    const partial = s.km * 1000 > run.distance_m + 0.5;
    return {
      km: partial ? number(run.distance_m / 1000, 2) : String(s.km),
      partial,
      time_s: s.time_s,
      pace_s_per_km: s.pace_s_per_km,
      ...(s.hr !== undefined ? { hr: s.hr } : {}),
      ...(s.elev_delta_m !== undefined ? { elev_delta_m: s.elev_delta_m } : {}),
    };
  });
}

/** Garmin's names for its five heart-rate zones, as Garmin Connect shows them (zone 1 first). */
export const GARMIN_ZONE_NAMES = ['Warm Up', 'Easy', 'Aerobic', 'Threshold', 'Maximum'] as const;

export interface ZoneRow {
  zone: number;
  name: string;
  low_bpm: number;
  high_bpm: number;
  seconds: number;
  /** Share of the time in all five zones, 0..1. */
  share: number;
}

/**
 * Garmin's five heart-rate zones (T117, T159), as the watch recorded them. Names come from the zone
 * number, so published data never carries a "name" key (scan-privacy reserves it).
 */
export function zoneRows(run: Run): ZoneRow[] {
  const zones = run.hr_zones ?? [];
  if (zones.length !== 5) return [];
  const total = zones.reduce((sum, z) => sum + z.seconds, 0);
  if (total <= 0) return [];
  return zones.map((z) => ({ zone: z.zone, name: GARMIN_ZONE_NAMES[z.zone - 1] ?? `Zone ${z.zone}`, low_bpm: z.low_bpm, high_bpm: z.high_bpm, seconds: z.seconds, share: z.seconds / total }));
}

export interface EffortRow {
  label: string;
  distance_m: number;
  time_s: number;
  pace_s_per_km: number;
}

/** "Best efforts in this run" (T160): plausible efforts only, shortest first. */
export function effortRows(run: Run): EffortRow[] {
  return run.best_efforts
    .filter((e) => e.plausible)
    .sort((a, b) => a.distance_m - b.distance_m)
    .map((e) => ({ label: e.label, distance_m: e.distance_m, time_s: e.time_s, pace_s_per_km: (e.time_s / e.distance_m) * 1000 }));
}

export type SeriesKey = 'pace' | 'hr' | 'elev' | 'cadence' | 'power';
export type Axis = 'distance' | 'time';

export interface SeriesChart {
  key: SeriesKey;
  title: string;
  /** Formats a value of this series. */
  format: (value: number) => string;
  /** Table column heading. */
  column: string;
  invert: boolean;
  /** y range to draw, when it is cut (pace). */
  domain?: [number, number];
  /** Average of the series, drawn as a dashed reference. */
  average?: number;
  /** The key message in words. */
  summary: string;
  values: readonly (number | null)[];
}

const SERIES: { key: SeriesKey; title: string; column: string; format: (v: number) => string }[] = [
  { key: 'pace', title: 'Pace', column: 'Pace', format: (v) => formatPace(v) },
  { key: 'hr', title: 'Heart rate', column: 'Heart rate', format: (v) => `${Math.round(v)} bpm` },
  { key: 'elev', title: 'Elevation', column: 'Elevation', format: (v) => formatMetres(v) },
  { key: 'cadence', title: 'Cadence', column: 'Cadence', format: (v) => `${Math.round(v)} spm` },
  { key: 'power', title: 'Power', column: 'Power', format: (v) => `${Math.round(v)} W` },
];

function quantile(sorted: readonly number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** The charts a run has (T119), in display order; a series with no values gives no chart. */
export function seriesCharts(run: Run): SeriesChart[] {
  return SERIES.flatMap((s) => {
    const values = run.series[s.key];
    const present = (values ?? []).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!values || present.length < 2) return [];
    const sorted = [...present].sort((a, b) => a - b);
    const mean = present.reduce((sum, v) => sum + v, 0) / present.length;
    const min = sorted[0]!;
    const max = sorted.at(-1)!;
    let summary: string;
    let domain: [number, number] | undefined;
    let average: number | undefined = mean;
    if (s.key === 'pace') {
      domain = [quantile(sorted, 0.02), quantile(sorted, 0.98)];
      average = run.avg_pace_s_per_km;
      summary = `Average ${formatPace(run.avg_pace_s_per_km)}; mostly between ${formatPace(domain[0])} and ${formatPace(domain[1])}.`;
    } else if (s.key === 'elev') {
      average = undefined;
      const gained = run.elevation_gain_m !== undefined ? `, ${formatMetres(run.elevation_gain_m)} gained` : '';
      summary = `Between ${formatMetres(min)} and ${formatMetres(max)}${gained}.`;
    } else if (s.key === 'hr' && run.hr) {
      average = run.hr.avg;
      summary = `Average ${Math.round(run.hr.avg)} bpm, max ${Math.round(run.hr.max)} bpm.`;
    } else {
      // Cadence and power drop to 0 at a stop; cut like pace, so the running stays readable.
      domain = [quantile(sorted, 0.02), quantile(sorted, 0.98)];
      const avg = s.key === 'cadence' ? run.cadence_avg : s.key === 'power' ? run.power_w_avg : undefined;
      average = avg ?? mean;
      summary = `Average ${s.format(average)}; mostly between ${s.format(domain[0])} and ${s.format(domain[1])}.`;
    }
    return [{ ...s, invert: s.key === 'pace', values, summary, ...(domain ? { domain } : {}), ...(average !== undefined ? { average } : {}) }];
  });
}

/** The x values of a run's series on an axis: kilometres or elapsed seconds. */
export function axisValues(run: Run, axis: Axis): number[] {
  return axis === 'distance' ? run.series.x_dist_m.map((m) => m / 1000) : run.series.x_elapsed_s;
}

/** Where a run's axis ends: its distance in km, or its elapsed time. */
export function axisEnd(run: Run, axis: Axis): number {
  return axis === 'distance' ? run.distance_m / 1000 : run.elapsed_s;
}

/** Tick spacings for the time axis, in minutes. */
const TIME_STEPS_MIN = [1, 2, 5, 10, 15, 20, 30, 60, 90, 120];

/** Elapsed-time ticks (seconds) at a round number of minutes, about `count` intervals. */
export function timeTicks(maxSeconds: number, count = 4): number[] {
  const minutes = maxSeconds / 60;
  const step = TIME_STEPS_MIN.find((m) => minutes / m <= count) ?? 180;
  const out: number[] = [];
  for (let t = 0; t <= maxSeconds + 1e-9; t += step * 60) out.push(t);
  return out;
}

/** "45 min", "1:30" (h:mm) for time-axis labels. */
export function formatAxisTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export interface TableRow {
  /** The bucket's end on the axis: km, or seconds. */
  at: number;
  value: number;
}

/**
 * A series as table rows (the chart's data, FR-071): the mean in each kilometre (distance) or
 * each 5 minutes (time), widened so there are at most `maxRows`. Buckets with no value are
 * left out. `end` is where the axis ends (the run's distance in km, or its elapsed time), since
 * the series' last point is a bucket mean that stops a little short of it.
 */
export function tableRows(xs: readonly number[], values: readonly (number | null)[], axis: Axis, end = xs.length ? Math.max(...xs) : 0, maxRows = 50): TableRow[] {
  let size = axis === 'distance' ? 1 : 300;
  while (end / size > maxRows) size *= 2;
  const sums = new Map<number, { sum: number; n: number }>();
  xs.forEach((x, i) => {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const bucket = Math.min(Math.floor(x / size), Math.max(0, Math.ceil(end / size) - 1));
    const entry = sums.get(bucket) ?? { sum: 0, n: 0 };
    entry.sum += v;
    entry.n += 1;
    sums.set(bucket, entry);
  });
  return [...sums.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, { sum, n }]) => ({ at: Math.min(end, (bucket + 1) * size), value: sum / n }));
}
