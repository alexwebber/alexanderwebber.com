// A change's or role's dates (spec 004, T027, plus the words compare-cv needs; T058 adds durations
// and <time> values: whenParts, durationText): every form, "now" as the end of as_of's month, and the
// issues, which carry no value.
import { describe, expect, it } from 'vitest';
import { durationText, monthDatetime, monthsCovered, monthText, MONTHS_OUTSIDE_AS_OF, NOT_A_WHEN, parseWhen, shortMonthText, STARTS_AFTER_END, whenParts, whenText } from '../../src/sections/cv/domain/dates.ts';

const AS_OF = '2026-11';
const parsed = (when: string, asOf = AS_OF) => {
  const result = parseWhen(when, asOf);
  expect(result.issues).toEqual([]);
  return result.when!;
};

describe('parseWhen', () => {
  it.each([
    ['2014', 'year', 'point', [2014, 1], [2014, 12], false, false, false],
    ['~2014', 'rough-year', 'point', [2014, 1], [2014, 12], true, false, false],
    ['2013–2016', 'years', 'period', [2013, 1], [2016, 12], false, false, false],
    ['2013–now', 'ongoing', 'period', [2013, 1], [2026, 11], false, true, false],
    ['2026 Oct', 'month', 'point', [2026, 10], [2026, 10], false, false, true],
    ['2026 Feb–May', 'months', 'period', [2026, 2], [2026, 5], false, false, true],
    ['2025–2026 Mar', 'into-latest-year', 'period', [2025, 1], [2026, 3], false, false, true],
  ] as const)('%s', (when, form, kind, start, end, rough, ongoing, months) => {
    expect(parsed(when)).toEqual({ form, kind, start: { year: start[0], month: start[1] }, end: { year: end[0], month: end[1] }, rough, ongoing, months });
  });

  it("ends \"now\" at the end of as_of's month", () => {
    expect(parsed('2013–now', '2026-01').end).toEqual({ year: 2026, month: 1 });
    expect(parsed('2013–now', '2027-12').end).toEqual({ year: 2027, month: 12 });
  });

  it('refuses months outside the as_of year', () => {
    for (const when of ['2025 Oct', '2025 Feb–May', '2024–2025 Mar']) expect(parseWhen(when, AS_OF).issues).toEqual([MONTHS_OUTSIDE_AS_OF]);
  });

  it('refuses a start after its end', () => {
    for (const when of ['2016–2013', '2026 May–Feb', '2027–now']) expect(parseWhen(when, AS_OF).issues).toEqual([STARTS_AFTER_END]);
  });

  it('says a malformed date is not a date form', () => {
    expect(parseWhen('2013-2016', AS_OF)).toEqual({ issues: [NOT_A_WHEN] });
  });

  it('never puts the value in an issue', () => {
    for (const when of ['2025 Oct', '2016–2013', 'Sept 1999']) for (const issue of parseWhen(when, AS_OF).issues) expect(issue).not.toMatch(/\d/);
  });
});

describe('whenText', () => {
  it.each([
    ['2014', '2014'],
    ['~2014', 'About 2014'],
    ['2013–2016', '2013 to 2016'],
    ['2013–now', '2013 to now'],
    ['2026 Oct', 'October 2026'],
    ['2026 Feb–May', 'February to May 2026'],
    ['2026 Jan–Mar', 'January to March 2026'],
    ['2025–2026 Mar', '2025 to March 2026'],
  ])('%s reads "%s"', (when, words) => expect(whenText(parsed(when))).toBe(words));
});

describe('whenParts: the words with each date in a <time>', () => {
  it.each([
    ['2014', [['2014', '2014']]],
    ['~2014', [['About '], ['2014', '2014']]],
    ['2013–2016', [['2013', '2013'], [' to '], ['2016', '2016']]],
    ['2013–now', [['2013', '2013'], [' to now']]],
    ['2026 Oct', [['October 2026', '2026-10']]],
    ['2026 Feb–May', [['February', '2026-02'], [' to '], ['May 2026', '2026-05']]],
    ['2025–2026 Mar', [['2025', '2025'], [' to '], ['March 2026', '2026-03']]],
  ] as const)('%s', (when, parts) => {
    const got = whenParts(parsed(when));
    expect(got).toEqual(parts.map(([text, datetime]) => (datetime ? { text, datetime } : { text })));
    expect(got.map((p) => p.text).join('')).toBe(whenText(parsed(when)));
  });

  it('gives every datetime as YYYY or YYYY-MM', () => {
    for (const when of ['2014', '~2014', '2013–2016', '2013–now', '2026 Oct', '2026 Feb–May', '2025–2026 Mar']) {
      for (const part of whenParts(parsed(when))) if (part.datetime) expect(part.datetime).toMatch(/^\d{4}(-(0[1-9]|1[0-2]))?$/);
    }
  });
});

describe('durationText', () => {
  it.each([
    ['2013–2016', '4 years'],
    ['2013–2013', '1 year'],
    ['2013–now', '13 years 11 months so far'],
    ['2026 Feb–May', '4 months'],
    ['2026 Jan–Jan', '1 month'],
    ['2025–2026 Mar', '1 year 3 months'],
  ])('%s lasts "%s"', (when, words) => expect(durationText(parsed(when))).toBe(words));

  it('gives a point no duration', () => {
    for (const when of ['2014', '~2014', '2026 Oct']) expect(durationText(parsed(when))).toBeUndefined();
  });

  it("counts now to the end of the as_of month", () => {
    expect(durationText(parsed('2026–now', '2026-01'))).toBe('1 month so far');
    expect(monthsCovered(parsed('2025–now', '2026-12'))).toBe(24);
  });
});

describe('month words', () => {
  it("names a month short (the axis's last tick) and long", () => {
    expect(shortMonthText({ year: 2026, month: 11 })).toBe('Nov 2026');
    expect(monthText({ year: 2026, month: 1 })).toBe('January 2026');
    expect(monthDatetime({ year: 2026, month: 3 })).toBe('2026-03');
  });
});
