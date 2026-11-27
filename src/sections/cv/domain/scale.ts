// The career scale (specs/004-interactive-cv/data-model.md *Derived values* **Career scale**;
// research.md R7): pure, no dependency. Time runs from the start of the earliest `when` to the end of
// Page.as_of's month. The years before the latest year share the first four fifths of the width,
// linearly; the latest year runs month by month (January to as_of's month) over the last fifth. The
// two parts meet at the start of the latest year, so a bar crossing the join is one unbroken span.
//
// Positions are taken at month edges: the start of a month, or its end (the next month's start), so
// a point in 2014 spans x(Jan 2014 start) to x(Dec 2014 end) and draws at its middle.
import { monthDatetime, monthIndex, shortMonthText, type ParsedWhen, type YearMonth } from './dates.ts';

/** The share of the width the years before the latest year take; the latest year has the rest. */
export const JOIN = 0.8;

export interface Tick {
  /** 0..1 across the axis. */
  x: number;
  /** The words shown: "2009", "Nov 2026". */
  label: string;
  /** For <time datetime>. */
  datetime: string;
  /** Which tick it is: the last one is the page's data date (constitution Principle V). */
  kind: 'first' | 'middle' | 'latest' | 'last';
}

export interface CareerScale {
  start: YearMonth;
  asOf: YearMonth;
  /** 0..1 for the start of month `m` (edge 'start') or its end ('end'). */
  x(m: YearMonth, edge?: 'start' | 'end'): number;
  /** A `when`'s span: [x of its first month's start, x of its last month's end]. */
  span(when: Pick<ParsedWhen, 'start' | 'end'>): [number, number];
  /** The axis row: the first year, a middle year, the latest year and its last month (as_of). */
  ticks(): Tick[];
  /** The same scale with 0..1 spanning only `from`'s start to `to`'s end (zoom, slice 3). */
  domain(from: YearMonth, to: YearMonth): CareerScale;
}

/** The scale from the earliest start among `starts` to the end of `asOf`. With no start, it begins at as_of's year. */
export function careerScale(starts: YearMonth[], asOf: YearMonth): CareerScale {
  const earliest = starts.reduce<YearMonth>((min, m) => (monthIndex(m) < monthIndex(min) ? m : min), { year: asOf.year, month: 1 });
  const start = { year: earliest.year, month: 1 };
  const s = monthIndex(start);
  const join = monthIndex({ year: asOf.year, month: 1 });
  const end = monthIndex(asOf) + 1;
  /** Position of a month edge, counted in months since year 0. */
  const at = (t: number): number => {
    const clamped = Math.min(Math.max(t, s), end);
    if (join <= s) return (clamped - s) / (end - s);
    if (clamped <= join) return (JOIN * (clamped - s)) / (join - s);
    return JOIN + ((1 - JOIN) * (clamped - join)) / (end - join);
  };
  return build(start, asOf, at, 0, 1);
}

function build(start: YearMonth, asOf: YearMonth, at: (t: number) => number, lo: number, hi: number): CareerScale {
  const norm = (v: number) => (hi === lo ? 0 : (v - lo) / (hi - lo));
  const x = (m: YearMonth, edge: 'start' | 'end' = 'start') => norm(at(monthIndex(m) + (edge === 'end' ? 1 : 0)));
  const scale: CareerScale = {
    start,
    asOf,
    x,
    span: (when) => [x(when.start, 'start'), x(when.end, 'end')],
    ticks: () => ticks(start, asOf, x),
    domain: (from, to) => build(start, asOf, at, at(monthIndex(from)), at(monthIndex(to) + 1)),
  };
  return scale;
}

function ticks(start: YearMonth, asOf: YearMonth, x: CareerScale['x']): Tick[] {
  const last: Tick = { x: 1, label: shortMonthText(asOf), datetime: monthDatetime(asOf), kind: 'last' };
  if (start.year >= asOf.year) {
    // A career inside one year: its first month and its last.
    return asOf.month > 1 ? [{ x: 0, label: shortMonthText(start), datetime: monthDatetime(start), kind: 'first' }, last] : [last];
  }
  const year = (y: number, kind: Tick['kind']): Tick => ({ x: x({ year: y, month: 1 }), label: `${y}`, datetime: `${y}`, kind });
  const out = [year(start.year, 'first')];
  const middle = Math.round((start.year + asOf.year - 1) / 2);
  if (middle > start.year && middle < asOf.year - 1) out.push(year(middle, 'middle'));
  out.push(year(asOf.year, 'latest'), last);
  return out;
}
