// The race history (T136 for T128; FR-050–FR-052, US4.1, US4.3): recorded races and hand entries,
// each once, newest first, joined only on an explicit run_id, with official details winning. The
// duplicate-race validation error (a hand entry matching a recorded race) and its fix (add run_id)
// are checked end to end with validate-data. Every race here is synthetic.
import { afterEach, describe, expect, it } from 'vitest';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { raceHistory, snapDistance } from '../../src/sections/running/domain/races.ts';
import type { Race, Run } from '../../src/shared/storage/index.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { run as runFixture, runPath, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

const run = (id: string, extra: Record<string, unknown> = {}): Run => runFixture(id, { device: 'Venu X1', ...extra }) as unknown as Run;

// A designated half (US4.3's 1:41:15 on the watch), a designated 5k with no race.yaml, a
// training run, and two races from before the watch (US4.1).
const HALF = run('2026-05-17-k3f7', { is_race: true, title: 'Riverside Half', distance_m: 21_140, elapsed_s: 6075, moving_s: 6060 });
const PARK = run('2026-03-14-m4qd', { is_race: true, title: 'Race · 5.0 km', distance_m: 5030, elapsed_s: 1290 });
const TRAINING = run('2026-09-27-t6nb', { distance_m: 8000, elapsed_s: 2050 });
const RACES: Race[] = [
  { slug: 'riverside-half-2026', run_id: HALF.id, name: 'Riverside Half Marathon', date: '2026-05-17', distance: 'half', official_time: '1:41:07', position: 212, results_url: 'https://example.org/results' },
  { slug: '2019-example-10k', date: '2019-10-13', name: 'Example 10k', distance: '10k', official_time: '52:30' },
  { slug: '2018-coastal-half', date: '2018-04-22', name: 'Coastal Half', distance: 'half', official_time: '1:55:10' },
];

describe('race history (US4.1)', () => {
  it('lists recorded and hand-entered races together, each once, newest first', () => {
    const history = raceHistory([TRAINING, HALF, PARK], RACES);
    expect(history.map((r) => [r.slug, r.date, r.name, r.distance_m, r.time_s, r.official])).toEqual([
      ['riverside-half-2026', '2026-05-17', 'Riverside Half Marathon', 21097.5, 6067, true],
      ['2026-03-14-m4qd', '2026-03-14', 'Race · 5.0 km', 5030, 1290, false],
      ['2019-example-10k', '2019-10-13', 'Example 10k', 10000, 3150, true],
      ['2018-coastal-half', '2018-04-22', 'Coastal Half', 21097.5, 6910, true],
    ]);
    expect(history.filter((r) => r.run).map((r) => r.run!.id)).toEqual([HALF.id, PARK.id]);
  });

  it('lets the official details win and keeps the watch time beside them (US4.3, FR-051)', () => {
    const [half] = raceHistory([HALF], RACES);
    expect(half).toMatchObject({ time_s: 6067, official: true, device_time_s: 6075, position: 212, results_url: 'https://example.org/results', pb_distance_m: 21097.5 });
  });

  it('uses the slug from race.yaml, else the run ID, and the watch time without an official one', () => {
    const history = raceHistory([HALF, PARK], [{ ...RACES[0]!, official_time: undefined }]);
    expect(history.map((r) => r.slug)).toEqual(['riverside-half-2026', PARK.id]);
    expect(history[0]).toMatchObject({ time_s: 6075, official: false });
    expect(history[0]).not.toHaveProperty('device_time_s');
    expect(history[1]).toMatchObject({ name: 'Race · 5.0 km', pb_distance_m: 5000 });
  });

  it('joins a race.yaml to a run only by run_id, never by date or distance', () => {
    const sameDay: Race = { slug: 'riverside-guess', date: '2026-05-17', name: 'Riverside guess', distance: 'half', official_time: '1:41:07' };
    expect(raceHistory([HALF], [sameDay]).map((r) => r.slug)).toEqual([HALF.id, 'riverside-guess']);
  });

  it('leaves out designate: not_race, runs no longer published as races, and runs not yet ingested', () => {
    const notRace: Race = { ...RACES[0]!, designate: 'not_race' };
    expect(raceHistory([{ ...HALF, is_race: false }], [notRace])).toEqual([]);
    expect(raceHistory([{ ...HALF, is_race: false }], [RACES[0]!])).toEqual([]);
    expect(raceHistory([], [RACES[0]!])).toEqual([]);
  });

  it('snaps a race run without race.yaml to the named distance it is within 5% of', () => {
    expect(snapDistance(5030)).toBe(5000);
    expect(snapDistance(21_400)).toBe(21097.5);
    expect(snapDistance(42_700)).toBe(42195);
    expect(snapDistance(8200)).toBeUndefined();
  });
});

describe('duplicate races (FR-052, contracts/data-files.md)', () => {
  let repo: TempRepo;
  afterEach(() => repo?.cleanup());

  it('rejects a hand entry that matches a recorded race, and shows it once when run_id is added', () => {
    repo = tempRepo();
    repo.write(runPath(HALF.id), HALF as unknown as Record<string, unknown>);
    const entry = 'slug: riverside-half-2026\ndate: 2026-05-17\nname: Riverside Half Marathon\ndistance: half\nofficial_time: "1:41:07"\n';
    repo.write('data/running/owner/races/riverside-half-2026/race.yaml', entry);
    const errors = () => validateData(repo.root, { today: '2026-10-24' }).filter((i) => i.severity === 'error').map(formatIssue);
    expect(errors()).toEqual([
      `data/running/owner/races/riverside-half-2026/race.yaml  race "riverside-half-2026"  field run_id: matches recorded race run "${HALF.id}": add run_id: ${HALF.id} so it shows once`,
    ]);
    expect(raceHistory([HALF], [{ slug: 'riverside-half-2026', date: '2026-05-17', name: 'Riverside Half Marathon', distance: 'half', official_time: '1:41:07' }])).toHaveLength(2);

    repo.write('data/running/owner/races/riverside-half-2026/race.yaml', `${entry}run_id: ${HALF.id}\n`);
    expect(errors()).toEqual([]);
    const history = raceHistory([HALF], [{ slug: 'riverside-half-2026', run_id: HALF.id, date: '2026-05-17', name: 'Riverside Half Marathon', distance: 'half', official_time: '1:41:07' }]);
    expect(history.map((r) => [r.slug, r.run?.id, r.time_s])).toEqual([['riverside-half-2026', HALF.id, 6067]]);
  });
});
