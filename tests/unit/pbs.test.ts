// The personal-best table (T136 for T129; FR-053, FR-057, US4.2, US4.3, US4.7). "Today" is
// pinned. Every race and run here is synthetic.
import { describe, expect, it } from 'vitest';
import type { Race, Run, RunOverride, UpcomingRace } from '../../src/sections/running/data/store/index.ts';
import { buildEffortIndex } from '../../src/sections/running/domain/efforts.ts';
import { PB_DISTANCES, personalBests, racePbSlugs, type PbInput } from '../../src/sections/running/domain/pbs.ts';
import { raceHistory } from '../../src/sections/running/domain/races.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

const TODAY = '2026-10-24';
const effort = (distance_m: number, time_s: number, plausible = true) => ({ distance_m, label: String(distance_m), time_s, plausible });
const run = (id: string, extra: Record<string, unknown> = {}): Run => runFixture(id, { device: 'Venu X1', ...extra }) as unknown as Run;

const HALF = run('2026-05-17-k3f7', { is_race: true, title: 'Riverside Half', distance_m: 21_140, elapsed_s: 6075, best_efforts: [effort(5000, 1415), effort(10_000, 2855), effort(21_097.5, 6062)] });
const TEN = run('2026-10-18-p2rt', { is_race: true, title: 'Harbour 10k', distance_m: 10_060, elapsed_s: 2671, best_efforts: [effort(5000, 1318), effort(10_000, 2655)] });
const PARK = run('2026-03-14-m4qd', { is_race: true, title: 'Race · 5.0 km', distance_m: 5030, elapsed_s: 1290, best_efforts: [effort(5000, 1282)] });
const TEMPO = run('2026-09-27-t6nb', { distance_m: 8000, elapsed_s: 2050, best_efforts: [effort(5000, 1250.4)] });
const RACES: Race[] = [
  { slug: 'riverside-half-2026', run_id: HALF.id, name: 'Riverside Half Marathon', date: '2026-05-17', distance: 'half', official_time: '1:41:07' },
  { slug: 'harbour-10k-2026', run_id: TEN.id, name: 'Harbour 10k', date: '2026-10-18', distance: '10k', official_time: '44:30' },
  { slug: '2019-example-10k', date: '2019-10-13', name: 'Example 10k', distance: '10k', official_time: '52:30' },
];
const BRIGHTON: UpcomingRace = { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon', target_time: '3:20:00' };

function table(runs: Run[], races: Race[] = RACES, extra: Partial<PbInput> & { overrides?: RunOverride[] } = {}) {
  return personalBests({
    history: raceHistory(runs, races),
    efforts: buildEffortIndex(runs, races, extra.overrides),
    upcoming: [BRIGHTON],
    today: TODAY,
    highlightDays: 14,
    ...extra,
  });
}
const row = (rows: ReturnType<typeof table>, metres: number) => rows.find((r) => r.distance_m === metres)!;

describe('PB table (US4.2)', () => {
  it('has a row for each standard distance: 5k, 10k, half marathon and marathon', () => {
    expect(PB_DISTANCES).toEqual([5000, 10_000, 21_097.5, 42_195]);
    expect(table([]).map((r) => r.distance_m)).toEqual([5000, 10_000, 21_097.5, 42_195]);
  });

  it('shows the fastest race result with its race, plus a faster effort from any run', () => {
    const rows = table([HALF, TEN, PARK, TEMPO]);
    const five = row(rows, 5000);
    expect([five.race?.entry.slug, five.race?.time_s, five.race?.entry.official]).toEqual([PARK.id, 1290, false]);
    expect([five.effort?.run_id, five.effort?.time_s, five.effort?.inLongerRun]).toEqual([TEMPO.id, 1250.4, true]);
    const ten = row(rows, 10_000);
    expect([ten.race?.entry.name, ten.race?.time_s, ten.race?.entry.date]).toEqual(['Harbour 10k', 2670, '2026-10-18']);
    expect(ten.effort).toBeUndefined(); // the half's 10k (47:35) and the 10k race's own device effort don't beat 44:30
    expect(row(rows, 21_097.5).race?.entry.slug).toBe('riverside-half-2026');
  });

  it('uses the official 1:41:07 over the device 1:41:15 (US4.3)', () => {
    const half = row(table([HALF]), 21_097.5);
    expect(half.race?.time_s).toBe(6067);
    expect(half.race?.entry.device_time_s).toBe(6075);
    expect(half.effort).toBeUndefined(); // the device's own half (6062 s) is replaced by the official time
  });

  it("doesn't set a race's own stretch against its watch time", () => {
    const five = row(table([PARK]), 5000); // the 5k segment inside the 5.03 km race (21:22) isn't a separate PB
    expect([five.race?.time_s, five.effort]).toEqual([1290, undefined]);
  });

  it('only shows an any-run effort that is faster to the second', () => {
    const close = run('2026-09-20-aaaa', { distance_m: 5300, best_efforts: [effort(5000, 1289.6)] });
    expect(row(table([PARK, close]), 5000).effort).toBeUndefined(); // 21:29.6 shows as 21:30
    const faster = run('2026-09-20-aaaa', { distance_m: 5300, best_efforts: [effort(5000, 1289.4)] });
    expect(row(table([PARK, faster]), 5000).effort?.run_id).toBe(faster.id);
  });

  it('reads as not yet run, pointing at the next race over the distance, with nothing there', () => {
    const marathon = row(table([HALF, TEMPO]), 42_195);
    expect(marathon).toEqual({ distance_m: 42_195, recent: false, upcoming: BRIGHTON });
    expect(row(table([HALF]), 5000).upcoming).toBeUndefined(); // a 5k effort from the half
  });

  it('adds a row for any other named distance raced', () => {
    const tenMile = run('2026-04-12-tenm', { is_race: true, distance_m: 16_200, elapsed_s: 4300 });
    const rows = table([tenMile], [{ slug: 'ten-miles', run_id: tenMile.id, date: '2026-04-12', name: 'Ten Mile', distance: '10mi' }]);
    expect(rows.map((r) => r.distance_m)).toEqual([5000, 10_000, 16_093.44, 21_097.5, 42_195]);
    expect(row(rows, 16_093.44).race?.time_s).toBe(4300);
  });
});

describe('eligibility (FR-057)', () => {
  it('leaves out treadmill races and efforts unless the owner includes the run', () => {
    const indoor = run('2026-02-01-w5yz', { is_race: true, treadmill: true, type: 'indoor', distance_m: 5000, elapsed_s: 1210, best_efforts: [effort(5000, 1209)] });
    const races: Race[] = [{ slug: 'indoor-5k', run_id: indoor.id, date: '2026-02-01', distance: '5k', official_time: '20:10' }];
    expect(row(table([indoor, PARK], races), 5000).race?.entry.slug).toBe(PARK.id);
    const included = row(table([indoor, PARK], races, { overrides: [{ id: indoor.id, include_in_records: true }] }), 5000);
    expect([included.race?.entry.slug, included.race?.time_s]).toEqual(['indoor-5k', 1210]);
  });

  it('leaves out excluded runs and an implausible device time', () => {
    expect(row(table([PARK], [], { overrides: [{ id: PARK.id, exclude_from_records: true }] }), 5000).race).toBeUndefined();
    const glitch = run('2026-03-14-m4qd', { is_race: true, distance_m: 5030, elapsed_s: 700, best_efforts: [effort(5000, 690, false)] });
    expect(row(table([glitch], []), 5000).race).toBeUndefined();
  });

  it('counts hand-entered results', () => {
    expect(row(table([], [RACES[2]!]), 10_000).race?.entry.slug).toBe('2019-example-10k');
  });
});

describe('recent highlight (US4.7)', () => {
  it('marks a best set within recent_highlight_days.pb days, and only then', () => {
    const rows = table([HALF, TEN, PARK, TEMPO]);
    expect(row(rows, 10_000).recent).toBe(true); // 18 Oct, 6 days ago
    expect(row(rows, 5000).recent).toBe(false); // 27 Sep, 27 days ago
    const on = (today: string, highlightDays: number) => row(personalBests({ history: raceHistory([TEN], RACES), efforts: buildEffortIndex([TEN], RACES), today, highlightDays }), 10_000).recent;
    expect([on('2026-10-18', 14), on('2026-11-01', 14), on('2026-11-02', 14), on('2026-11-01', 7)]).toEqual([true, true, false, false]);
  });

  it('badges the races holding a race PB in the history, "New" while recent', () => {
    const slugs = racePbSlugs(table([HALF, TEN, PARK, TEMPO]));
    expect([...slugs]).toEqual([
      [PARK.id, false],
      ['harbour-10k-2026', true],
      ['riverside-half-2026', false],
    ]);
  });
});
