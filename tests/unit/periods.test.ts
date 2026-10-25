// Training totals by week, month, year and all time (T122 for T113; FR-045, FR-046, FR-058,
// FR-075). "Today" is pinned in every case; runs are fixtures.
import { describe, expect, it } from 'vitest';
import type { Run } from '../../src/sections/running/data/store/index.ts';
import { groupByMonth, periodTotals, recentWeeks, runYears, totals, trainingSummary } from '../../src/sections/running/domain/periods.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

const run = (id: string, km: number, extra: Partial<Run> = {}): Run =>
  runFixture(id, { distance_m: km * 1000, moving_s: km * 300, ...extra }) as unknown as Run;

describe('totals', () => {
  it('weights average pace by distance, not by run', () => {
    // 10 km at 5:00 and 2 km at 7:00: 4,200 s over 12 km is 5:20, not the 6:00 mean of the paces.
    const t = totals([run('2026-10-01-aaaa', 10, { moving_s: 3000 }), run('2026-10-02-bbbb', 2, { moving_s: 840 })]);
    expect(t.avg_pace_s_per_km).toBeCloseTo(320, 6);
    expect(t).toMatchObject({ runs: 2, distance_m: 12_000, moving_s: 3840 });
  });

  it('counts treadmill runs, and sums elevation only where recorded (FR-048, FR-058)', () => {
    const t = totals([run('2026-10-01-aaaa', 10, { elevation_gain_m: 80 }), run('2026-10-02-bbbb', 5, { type: 'indoor', treadmill: true })]);
    expect(t.runs).toBe(2);
    expect(t.distance_m).toBe(15_000);
    expect(t.elevation_gain_m).toBe(80);
    expect(totals([run('2026-10-02-bbbb', 5, { type: 'indoor', treadmill: true })]).elevation_gain_m).toBeUndefined();
  });

  it('has no pace and no elevation without runs', () => {
    expect(totals([])).toEqual({ runs: 0, distance_m: 0, moving_s: 0 });
  });
});

describe('periods in Europe/London', () => {
  const runs = [
    run('2026-10-25-aaaa', 10), // Sun 25 Oct, the clocks go back: still in the week of Mon 19 Oct
    run('2026-10-26-bbbb', 8), // Mon 26 Oct: a new week
    run('2026-10-31-cccc', 5), // Sat 31 Oct
    run('2026-11-01-dddd', 21), // Sun 1 Nov: November, but the week of Mon 26 Oct
    run('2027-01-01-eeee', 6), // a new year on a Friday: the week of Mon 28 Dec 2026
  ];

  it('weeks run Monday to Sunday, across the clocks going back', () => {
    const weeks = periodTotals('week', runs, '2027-01-01');
    expect(weeks[0]).toMatchObject({ start: '2026-10-19', end: '2026-10-25', runs: 1, distance_m: 10_000 });
    expect(weeks[1]).toMatchObject({ start: '2026-10-26', end: '2026-11-01', runs: 3, distance_m: 34_000 });
    expect(weeks.at(-1)).toMatchObject({ start: '2026-12-28', end: '2027-01-03', runs: 1 });
    // Unbroken: weeks with no runs are zero columns between the first run and today.
    expect(weeks).toHaveLength(11);
    expect(weeks[2]).toMatchObject({ start: '2026-11-02', runs: 0, distance_m: 0 });
    expect(weeks[2]!.avg_pace_s_per_km).toBeUndefined();
  });

  it('months and years split on the calendar, not the week', () => {
    const months = periodTotals('month', runs, '2027-01-01');
    expect(months.map((m) => [m.start, m.end, m.runs])).toEqual([
      ['2026-10-01', '2026-10-31', 3],
      ['2026-11-01', '2026-11-30', 1],
      ['2026-12-01', '2026-12-31', 0],
      ['2027-01-01', '2027-01-31', 1],
    ]);
    const years = periodTotals('year', runs, '2027-01-01');
    expect(years.map((y) => [y.start, y.end, y.runs, y.distance_m])).toEqual([
      ['2026-01-01', '2026-12-31', 4, 44_000],
      ['2027-01-01', '2027-12-31', 1, 6_000],
    ]);
  });

  it('ends at today even after a quiet spell, and starts at the first run (nothing invented before it)', () => {
    const months = periodTotals('month', [run('2026-09-10-aaaa', 10)], '2026-12-05');
    expect(months.map((m) => m.start)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']);
    expect(periodTotals('week', [], '2026-12-05')).toEqual([]);
  });
});

describe('the hub', () => {
  it('opens on the last 26 weeks, ending this week', () => {
    const runs = [run('2025-10-07-aaaa', 5), run('2026-10-21-bbbb', 10)];
    const weeks = recentWeeks(runs, '2026-10-24');
    expect(weeks).toHaveLength(26);
    expect(weeks[0]!.start).toBe('2026-04-27');
    expect(weeks.at(-1)).toMatchObject({ start: '2026-10-19', runs: 1 });
  });

  it('starts at the first run when the history is shorter than 26 weeks', () => {
    expect(recentWeeks([run('2026-10-07-aaaa', 5)], '2026-10-24').map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });

  it('months and years cover all history; all-time totals know the first and last runs', () => {
    const runs = [run('2025-10-07-aaaa', 5), run('2026-10-21-bbbb', 10, { type: 'indoor', treadmill: true })];
    const s = trainingSummary(runs, '2026-10-24');
    expect(s.month).toHaveLength(13);
    expect(s.year.map((y) => y.start)).toEqual(['2025-01-01', '2026-01-01']);
    expect(s.allTime).toMatchObject({ runs: 2, distance_m: 15_000, first: '2025-10-07', last: '2026-10-21' });
  });
});

describe('the run list', () => {
  it('groups newest first by month; on a day with several runs the longer comes first', () => {
    const groups = groupByMonth([run('2026-09-30-aaaa', 5), run('2026-10-17-bbbb', 1), run('2026-10-17-cccc', 5), run('2026-10-02-dddd', 8)]);
    expect(groups.map((g) => [g.month, g.runs.map((r) => r.id)])).toEqual([
      ['2026-10', ['2026-10-17-cccc', '2026-10-17-bbbb', '2026-10-02-dddd']],
      ['2026-09', ['2026-09-30-aaaa']],
    ]);
    expect(groups[0]!.totals).toMatchObject({ runs: 3, distance_m: 14_000 });
  });

  it('lists the years with runs, newest first', () => {
    expect(runYears([run('2025-10-07-aaaa', 5), run('2026-01-01-bbbb', 5), run('2026-10-21-cccc', 5)])).toEqual([2026, 2025]);
  });
});
