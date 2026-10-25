// This week, the training build and the latest run (T108 for T097; FR-021, FR-023, FR-058, FR-075).
// "Today" is pinned in every case; runs are fixtures.
import { describe, expect, it } from 'vitest';
import type { Run } from '../../src/sections/running/data/store/index.ts';
import { latestRun, trainingBuild, weekSnapshot } from '../../src/sections/running/domain/weeks.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

const run = (id: string, km: number, extra: Partial<Run> = {}): Run =>
  runFixture(id, { distance_m: km * 1000, moving_s: km * 300, ...extra }) as unknown as Run;
const treadmill = (id: string, km: number) => run(id, km, { type: 'indoor', treadmill: true });

describe('this week (Monday to Sunday)', () => {
  // Wed 21 Oct 2026: this week is Mon 19 to Sun 25 Oct; last week Mon 12 to Sun 18 Oct.
  const runs = [run('2026-10-25-aaaa', 30), run('2026-10-21-bbbb', 10), run('2026-10-19-cccc', 8), run('2026-10-18-dddd', 21), run('2026-10-12-eeee', 5), run('2026-10-11-ffff', 12)];

  it('counts runs, distance and moving time against last week (US1.5)', () => {
    const { thisWeek, lastWeek } = weekSnapshot(runs, '2026-10-21');
    expect(thisWeek).toEqual({ start: '2026-10-19', end: '2026-10-25', runs: 3, distance_m: 48_000, moving_s: 14_400 });
    expect(lastWeek).toEqual({ start: '2026-10-12', end: '2026-10-18', runs: 2, distance_m: 26_000, moving_s: 7_800 });
  });

  it('starts weeks on Monday across the clocks going back (Sun 25 Oct 2026) and forward (Sun 28 Mar 2027)', () => {
    expect(weekSnapshot([], '2026-10-25').thisWeek.start).toBe('2026-10-19'); // Sunday stays in its week
    expect(weekSnapshot([], '2026-10-26').thisWeek.start).toBe('2026-10-26');
    expect(weekSnapshot([], '2027-03-28').thisWeek).toMatchObject({ start: '2027-03-22', end: '2027-03-28' });
    expect(weekSnapshot([], '2027-03-29').lastWeek).toMatchObject({ start: '2027-03-22', end: '2027-03-28' });
  });

  it('shows a week with no runs as zeros, with last week for comparison', () => {
    const { thisWeek, lastWeek } = weekSnapshot([run('2026-10-14-aaaa', 10)], '2026-10-21');
    expect(thisWeek).toMatchObject({ runs: 0, distance_m: 0, moving_s: 0 });
    expect(lastWeek).toMatchObject({ runs: 1, distance_m: 10_000 });
  });

  it('counts treadmill runs (FR-058)', () => {
    expect(weekSnapshot([treadmill('2026-10-20-tttt', 5), run('2026-10-19-aaaa', 10)], '2026-10-21').thisWeek).toMatchObject({ runs: 2, distance_m: 15_000 });
  });
});

describe('training build (FR-021)', () => {
  const runs = [
    run('2026-12-02-aaaa', 12),
    treadmill('2026-11-30-tttt', 6),
    run('2026-11-22-bbbb', 18),
    run('2026-11-17-cccc', 8),
    run('2026-11-10-dddd', 25), // before build_start: not in the build
  ];

  it('totals weekly distance from build_start to today, treadmill runs included, with the longest run', () => {
    const build = trainingBuild(runs, '2026-11-16', '2026-12-03', '2027-04-04');
    expect(build.from).toBe('2026-11-16');
    expect(build.weeks).toEqual([
      { start: '2026-11-16', runs: 2, distance_m: 26_000 },
      { start: '2026-11-23', runs: 0, distance_m: 0 },
      { start: '2026-11-30', runs: 2, distance_m: 18_000 },
    ]);
    expect(build.longest?.id).toBe('2026-11-22-bbbb');
    expect(build.runs.map((r) => r.id)).toEqual(['2026-12-02-aaaa', '2026-11-30-tttt', '2026-11-22-bbbb', '2026-11-17-cccc']);
    expect(build.total).toEqual({ runs: 4, distance_m: 44_000, moving_s: 13_200 });
  });

  it('starts at the first published run when the site has no runs before it, rather than drawing zeros', () => {
    const build = trainingBuild([run('2026-10-03-aaaa', 5), run('2026-10-19-bbbb', 21)], '2026-09-05', '2026-10-23', '2027-04-04');
    expect(build.from).toBe('2026-10-03');
    expect(build.weeks.map((w) => w.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
    expect(build.total.distance_m).toBe(26_000);
  });

  it('has no weeks before the build starts or with no runs at all', () => {
    expect(trainingBuild(runs, '2027-01-04', '2026-12-03').weeks).toEqual([]);
    expect(trainingBuild([], '2026-11-16', '2026-12-03')).toMatchObject({ weeks: [{ start: '2026-11-16', runs: 0, distance_m: 0 }, { start: '2026-11-23' }, { start: '2026-11-30' }], runs: [] });
  });

  it('ends on race day', () => {
    const build = trainingBuild([...runs, run('2027-04-04-race', 42.2), run('2027-04-10-rest', 5)], '2026-11-16', '2027-04-12', '2027-04-04');
    expect(build.weeks.at(-1)?.start).toBe('2027-03-29');
    expect(build.longest?.id).toBe('2027-04-04-race');
    expect(build.runs.some((r) => r.id === '2027-04-10-rest')).toBe(false);
  });
});

describe('latest run', () => {
  it('is the most recent date; on a day of several, the longest run of that day', () => {
    const latest = latestRun([run('2026-10-17-wxyj', 0.8), run('2026-10-17-ofka', 5), run('2026-10-17-iaae', 1.2), run('2026-10-16-qopj', 12.6)]);
    expect(latest).toMatchObject({ run: { id: '2026-10-17-ofka' }, sameDay: 3 });
    expect(latestRun([run('2026-10-23-bv7w', 10)])).toMatchObject({ run: { id: '2026-10-23-bv7w' }, sameDay: 1 });
    expect(latestRun([])).toBeUndefined();
  });

  it('can be a treadmill run', () => {
    expect(latestRun([treadmill('2026-10-22-l2xp', 4.7), run('2026-10-21-5qtf', 14.9)])?.run.treadmill).toBe(true);
  });
});
