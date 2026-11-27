// A change's or role's dates (spec 004, T027, plus the words compare-cv needs; T058 adds durations
// and <time> values): every form, "now" as the end of as_of's month, and the issues, which carry no
// value.
import { describe, expect, it } from 'vitest';
import { MONTHS_OUTSIDE_AS_OF, NOT_A_WHEN, parseWhen, STARTS_AFTER_END, whenText } from '../../src/sections/cv/domain/dates.ts';

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
