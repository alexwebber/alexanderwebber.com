// Scales, ticks and path geometry for the build-time charts (T074). Pure functions, no DOM.
//
// Chart geometry: the plot is an SVG with viewBox 0 0 1000 1000 and preserveAspectRatio="none",
// stretched over the plot area, with non-scaling strokes; labels and markers are HTML placed by
// percentage over it. So text and dots stay their real size at any width from 320px up, with no
// client JS to measure anything.
import { addDays, daysBetween, formatDayMonth, formatMonth } from '../format/dates.ts';

/** Plot coordinate space (both axes). */
export const PLOT = 1000;

export interface Scale {
  (value: number): number;
  domain: [number, number];
}

/** Maps [d0, d1] linearly onto [r0, r1]. A zero-width domain maps everything to the middle. */
export function linearScale([d0, d1]: [number, number], [r0, r1]: [number, number]): Scale {
  const span = d1 - d0;
  const scale = ((value: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))) as Scale;
  scale.domain = [d0, d1];
  return scale;
}

/** A "nice" step (1, 2, 2.5 or 5 x 10^n) giving about `count` intervals over `span`. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || count < 1) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export interface Ticks {
  /** Rounded-out domain, so the first and last ticks sit on the plot's edges. */
  domain: [number, number];
  values: number[];
  step: number;
}

/**
 * Clean ticks covering [min, max]. `zero` keeps 0 in the domain (bars must grow from zero);
 * otherwise the domain hugs the data, which suits trends like weight. A flat series is padded so
 * its line sits mid-plot.
 */
export function niceTicks(min: number, max: number, { count = 4, zero = false } = {}): Ticks {
  let lo = zero ? Math.min(0, min) : min;
  let hi = zero ? Math.max(0, max) : max;
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.05;
    lo = zero && lo >= 0 ? 0 : lo - pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const values: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(round(v, step));
  return { domain: [round(start, step), round(end, step)], values, step };
}

/** Removes floating-point noise at the precision the step implies (0.1 + 0.2 -> 0.3). */
function round(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(decimals));
}

/** Day number of a YYYY-MM-DD date, for a date axis. */
export function dayNumber(date: string): number {
  return daysBetween('1970-01-01', date);
}

export interface DateTick {
  date: string;
  label: string;
}

/**
 * Month-start ticks between two dates, thinned to at most `max` labels ("Jan 2026"). Spans under
 * about two months fall back to the two end dates.
 */
export function monthTicks(from: string, to: string, max = 4): DateTick[] {
  const months: string[] = [];
  let month = `${from.slice(0, 7)}-01`;
  if (month < from) month = nextMonth(month);
  for (; month <= to; month = nextMonth(month)) months.push(month);
  if (months.length < 2) return [from, to].filter((d, i, all) => all.indexOf(d) === i).map((date) => ({ date, label: formatDayMonth(date) }));
  const every = Math.ceil(months.length / max);
  return months.filter((_, i) => i % every === 0).map((date) => ({ date, label: formatMonth(date) }));
}

function nextMonth(month: string): string {
  return addDays(month, 32).slice(0, 8) + '01';
}

export interface Point {
  x: number;
  y: number | null;
}

/**
 * An SVG path through the points in plot space. Null values break the line (gaps in a series
 * stay gaps, never interpolated or drawn as zero).
 */
export function linePath(points: readonly Point[], x: (value: number) => number, y: (value: number) => number): string {
  let path = '';
  let pen = false;
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y)) {
      pen = false;
      continue;
    }
    path += `${pen ? 'L' : 'M'}${fmt(x(p.x))} ${fmt(y(p.y))}`;
    pen = true;
  }
  return path;
}

/** Percent of the plot, for placing HTML over it. */
export function percent(plotValue: number): string {
  return `${fmt((plotValue / PLOT) * 100)}%`;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
