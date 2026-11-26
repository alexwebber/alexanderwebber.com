// A change's or role's dates (specs/004-interactive-cv/data-model.md *Common fields* **When**):
// pure functions, no dependency. parseWhen reads the seven forms the schema allows; validate.ts and
// scripts/import-cv.ts refuse its issues, which never carry the value. whenText gives the
// *Shown as* words, which scripts/compare-cv.ts compares against the page (contracts/content-files.md
// *Compared fields*); durations and <time> values come with the page (T041).
//
// The latest year is Page.as_of's year: months are allowed only in it, and "now" is the end of
// as_of's month.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A month: `month` is 1 to 12. */
export interface YearMonth {
  year: number;
  month: number;
}

/** The seven written forms, in data-model.md's order: `2014`, `~2014`, `2013–2016`, `2013–now`, `2026 Oct`, `2026 Feb–May`, `2025–2026 Mar`. */
export type WhenForm = 'year' | 'rough-year' | 'years' | 'ongoing' | 'month' | 'months' | 'into-latest-year';

export interface ParsedWhen {
  form: WhenForm;
  /** A point draws as a dot, a period as a bar. */
  kind: 'point' | 'period';
  /** The first month covered (January for a year). */
  start: YearMonth;
  /** The last month covered (December for a year; as_of's month when ongoing). */
  end: YearMonth;
  /** `~2014`: the year is uncertain. */
  rough: boolean;
  /** `2013–now`. */
  ongoing: boolean;
  /** Written with a month name, so only in the as_of year. */
  months: boolean;
}

export interface WhenResult {
  /** Undefined only when the text isn't one of the seven forms. */
  when?: ParsedWhen;
  /** Problems, worded without the value. */
  issues: string[];
}

export const MONTHS_OUTSIDE_AS_OF = 'uses months outside the as_of year';
export const STARTS_AFTER_END = 'starts after it ends';
export const NOT_A_WHEN = 'is not a date form';

const M = `(${MONTHS.join('|')})`;
const FORMS: [WhenForm, RegExp][] = [
  ['year', /^(\d{4})$/],
  ['rough-year', /^~(\d{4})$/],
  ['years', /^(\d{4})–(\d{4})$/],
  ['ongoing', /^(\d{4})–now$/],
  ['month', new RegExp(`^(\\d{4}) ${M}$`)],
  ['months', new RegExp(`^(\\d{4}) ${M}–${M}$`)],
  ['into-latest-year', new RegExp(`^(\\d{4})–(\\d{4}) ${M}$`)],
];

/** Reads a `when` against the page's `as_of` (`YYYY-MM`). */
export function parseWhen(text: string, asOf: string): WhenResult {
  const asOfMonth = parseAsOf(asOf);
  for (const [form, pattern] of FORMS) {
    const m = pattern.exec(text);
    if (!m) continue;
    const when = build(form, m, asOfMonth);
    const issues: string[] = [];
    if (when.months && when.end.year !== asOfMonth.year) issues.push(MONTHS_OUTSIDE_AS_OF);
    if (monthIndex(when.start) > monthIndex(when.end)) issues.push(STARTS_AFTER_END);
    return { when, issues };
  }
  return { issues: [NOT_A_WHEN] };
}

function build(form: WhenForm, m: RegExpExecArray, asOf: YearMonth): ParsedWhen {
  const y = Number(m[1]);
  const base = { form, rough: false, ongoing: false, months: false };
  const jan = { year: y, month: 1 };
  switch (form) {
    case 'year':
      return { ...base, kind: 'point', start: jan, end: { year: y, month: 12 } };
    case 'rough-year':
      return { ...base, kind: 'point', start: jan, end: { year: y, month: 12 }, rough: true };
    case 'years':
      return { ...base, kind: 'period', start: jan, end: { year: Number(m[2]), month: 12 } };
    case 'ongoing':
      return { ...base, kind: 'period', start: jan, end: asOf, ongoing: true };
    case 'month':
      return { ...base, kind: 'point', start: { year: y, month: monthNumber(m[2]!) }, end: { year: y, month: monthNumber(m[2]!) }, months: true };
    case 'months':
      return { ...base, kind: 'period', start: { year: y, month: monthNumber(m[2]!) }, end: { year: y, month: monthNumber(m[3]!) }, months: true };
    case 'into-latest-year':
      return { ...base, kind: 'period', start: jan, end: { year: Number(m[2]), month: monthNumber(m[3]!) }, months: true };
  }
}

/** `YYYY-MM` as a month. */
export function parseAsOf(asOf: string): YearMonth {
  const [y, m] = asOf.split('-');
  return { year: Number(y), month: Number(m) };
}

/** Months since year 0, so months compare and subtract. */
export const monthIndex = (m: YearMonth): number => m.year * 12 + (m.month - 1);

const monthName = (m: YearMonth): string => MONTH_NAMES[m.month - 1]!;

/** The *Shown as* words: "2014", "About 2014", "2013 to 2016", "2013 to now", "October 2026", "February to May 2026", "2025 to March 2026". */
export function whenText(when: ParsedWhen): string {
  const { start, end } = when;
  switch (when.form) {
    case 'year':
      return `${start.year}`;
    case 'rough-year':
      return `About ${start.year}`;
    case 'years':
      return `${start.year} to ${end.year}`;
    case 'ongoing':
      return `${start.year} to now`;
    case 'month':
      return `${monthName(start)} ${start.year}`;
    case 'months':
      return `${monthName(start)} to ${monthName(end)} ${end.year}`;
    case 'into-latest-year':
      return `${start.year} to ${monthName(end)} ${end.year}`;
  }
}

function monthNumber(name: string): number {
  return MONTHS.indexOf(name as (typeof MONTHS)[number]) + 1;
}
