// validate-data (T038): referential checks and FR-070 messages.
import { afterEach, describe, expect, it } from 'vitest';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { run, runPath, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const TODAY = '2026-10-17';
const errors = () =>
  validateData(repo.root, { today: TODAY })
    .filter((i) => i.severity === 'error')
    .map(formatIssue);
const warnings = () =>
  validateData(repo.root, { today: TODAY })
    .filter((i) => i.severity === 'warning')
    .map(formatIssue);

const SECTION = 'focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets hospice } }\n';
const UPCOMING = '- { id: brighton-2027, name: Brighton Marathon, date: 2027-04-04, distance: marathon, target_time: "3:30:00" }\n';

function owner() {
  repo = tempRepo();
  repo.write('data/running/owner/section.yaml', SECTION);
  repo.write('data/running/owner/upcoming-races.yaml', UPCOMING);
}

describe('validate-data', () => {
  it('passes a consistent repo', () => {
    owner();
    repo.write(
      'data/running/owner/goals.yaml',
      '- { id: brighton-sub-330, type: race_time, title: Sub 3:30, priority: 1, featured: true, linked_race: brighton-2027, target: { distance: marathon, time: "3:30:00" } }\n',
    );
    expect(errors()).toEqual([]);
    expect(warnings()).toEqual([]);
  });

  it('names the file, goal and field for a malformed time', () => {
    owner();
    repo.write(
      'data/running/owner/goals.yaml',
      '- id: 10k-sub-45\n  type: race_time\n  title: 10k\n  priority: 2\n  featured: true\n  target: { distance: 10k, time: "3:7x" }\n',
    );
    expect(errors()).toEqual([
      'data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time: "3:7x" is not a valid time (expected mm:ss or h:mm:ss)',
    ]);
  });

  it('checks references between owner files', () => {
    owner();
    repo.write('data/running/owner/section.yaml', SECTION.replace('brighton-2027', 'london-2027'));
    repo.write('data/running/owner/upcoming-races.yaml', `${UPCOMING}- { id: hove-10k, name: Hove 10k, date: 2026-06-07, distance: 10k, result_ref: hove-10k-2026 }\n`);
    repo.write(
      'data/running/owner/goals.yaml',
      '- { id: g, type: milestone, title: G, priority: 1, featured: true, linked_race: paris-2027 }\n',
    );
    expect(errors()).toEqual([
      'data/running/owner/upcoming-races.yaml  upcoming race "hove-10k"  field result_ref: no race entry data/running/owner/races/hove-10k-2026/race.yaml',
      'data/running/owner/section.yaml  field focus_race.race_id: "london-2027" is not an id in upcoming-races.yaml',
      'data/running/owner/goals.yaml  goal "g"  field linked_race: "paris-2027" is not an id in upcoming-races.yaml',
    ]);
  });

  it('limits featured goals and keeps their priorities unique', () => {
    owner();
    repo.write('data/running/owner/section.yaml', `${SECTION}featured_goal_limit: 2\n`);
    const goal = (id: string, priority: number) => `- { id: ${id}, type: milestone, title: ${id}, priority: ${priority}, featured: true }\n`;
    repo.write('data/running/owner/goals.yaml', goal('a', 1) + goal('b', 1) + goal('c', 3) + goal('a', 4));
    expect(errors()).toEqual([
      'data/running/owner/goals.yaml  goal "b"  field priority: 1 is also the priority of featured goal "a"',
      'data/running/owner/goals.yaml  goal "a"  field id: is used by another goal',
      'data/running/owner/goals.yaml: 4 goals are featured; at most 2 can be (featured_goal_limit in section.yaml)',
    ]);
  });

  it('warns when a goal and its race disagree on the target', () => {
    owner();
    repo.write(
      'data/running/owner/goals.yaml',
      '- { id: b, type: race_time, title: B, priority: 1, featured: true, linked_race: brighton-2027, target: { distance: marathon, time: "3:20:00" } }\n',
    );
    expect(warnings()).toEqual([
      'data/running/owner/goals.yaml  goal "b"  field target.time: "3:20:00" differs from focus race "brighton-2027" target_time "3:30:00" in upcoming-races.yaml; the landing page would show both',
    ]);
  });

  it('warns more plainly for a goal off the landing page, and not for retired or hand-achieved goals (T106)', () => {
    owner();
    repo.write(
      'data/running/owner/goals.yaml',
      [
        '- { id: unfeatured, type: race_time, title: U, priority: 1, featured: false, linked_race: brighton-2027, target: { distance: marathon, time: "3:20:00" } }',
        '- { id: retired, type: race_time, title: R, priority: 2, featured: true, retired: true, linked_race: brighton-2027, target: { distance: marathon, time: "3:45:00" } }',
        '- { id: done, type: race_time, title: D, priority: 3, featured: true, linked_race: brighton-2027, achieved_override: { date: "2026-10-01" }, target: { distance: marathon, time: "3:40:00" } }',
        '- { id: same, type: race_time, title: S, priority: 4, featured: true, linked_race: brighton-2027, target: { distance: marathon, time: "3:30:00" } }',
        '',
      ].join('\n'),
    );
    expect(warnings()).toEqual([
      'data/running/owner/goals.yaml  goal "unfeatured"  field target.time: "3:20:00" differs from upcoming race "brighton-2027" target_time "3:30:00"',
    ]);
  });

  it('rejects a hand-entered race that duplicates a recorded race', () => {
    owner();
    repo.write(runPath('2026-05-17-q2mb'), run('2026-05-17-q2mb', { is_race: true, distance_m: 21_300 }));
    repo.write('data/running/owner/races/hastings-half/race.yaml', 'slug: hastings-half\ndate: 2026-05-17\ndistance: half\n');
    expect(errors()).toEqual([
      'data/running/owner/races/hastings-half/race.yaml  race "hastings-half"  field run_id: matches recorded race run "2026-05-17-q2mb": add run_id: 2026-05-17-q2mb so it shows once',
    ]);
  });

  it('checks linked races, their photos and one entry per run', () => {
    owner();
    repo.write(runPath('2026-05-17-q2mb'), run('2026-05-17-q2mb', { is_race: true }));
    repo.write(
      'data/running/owner/races/hastings-half/race.yaml',
      'slug: hastings-half\nrun_id: 2026-05-17-q2mb\ndate: 2026-05-18\ndistance: half\nphotos:\n  - { file: finish.jpg, description: Finish }\n',
    );
    repo.write('data/running/owner/races/hastings-again/race.yaml', 'slug: hastings-again\nrun_id: 2026-05-17-q2mb\ndate: 2026-05-17\ndistance: half\n');
    repo.write('data/running/owner/races/hastings-again/spare.jpg', 'x');
    expect(errors()).toEqual([
      'data/running/owner/races/hastings-half/race.yaml  race "hastings-half"  field photos[0].file: data/running/owner/races/hastings-half/finish.jpg does not exist',
      'data/running/owner/races/hastings-half/race.yaml  race "hastings-half"  field date: 2026-05-18 differs from the date of run "2026-05-17-q2mb" (2026-05-17); check the run_id',
      'data/running/owner/races/hastings-again/race.yaml  race "hastings-again"  field run_id: is already used by race "hastings-half" (one race entry per run)',
    ]);
    expect(warnings()).toEqual([
      'data/running/owner/races/hastings-again/spare.jpg: is not listed in its race.yaml photos, so it is not shown',
    ]);
  });

  it('rejects provider activity IDs in owner files', () => {
    owner();
    repo.write('data/running/owner/races/r/race.yaml', 'slug: r\ndate: 2026-05-17\ndistance: half\nnote: "see intervals.icu/activities/i12345678"\n');
    expect(errors()).toEqual([
      'data/running/owner/races/r/race.yaml  line 4: "i12345678" looks like an intervals.icu activity ID; refer to runs by the ID in the run page URL',
      'data/running/owner/races/r/race.yaml  line 4: "intervals.icu/activities/" is an intervals.icu activity link; refer to runs by the ID in the run page URL',
    ]);
  });

  it('allows long numeric IDs inside results links', () => {
    owner();
    repo.write('data/running/owner/races/r/race.yaml', 'slug: r\ndate: 2026-05-17\ndistance: half\nresults_url: https://results.example.org/race/1234567890\n');
    expect(errors()).toEqual([]);
  });

  it('checks overrides against published and hidden runs', () => {
    owner();
    const hash = 'a'.repeat(64);
    repo.write(runPath('2026-09-28-q2mb'), run('2026-09-28-q2mb'));
    repo.write('data/running/published/state/manifest.json', {
      schema_version: 1,
      processed_at: '2026-10-17T10:00:00Z',
      runs: {
        '2026-09-28-q2mb': { input_hash: hash, path: 'runs/2026/2026-09-28-q2mb.json' },
        '2026-07-19-zz4k': { input_hash: hash, hidden: true },
      },
      health: {},
    });
    repo.write(
      'data/running/owner/run-overrides.yaml',
      '- { id: 2026-09-28-q2mb, title: Long run }\n- { id: 2026-07-19-zz4k, hide: true }\n- { id: 2026-07-20-abcd, hide: true }\n- { id: 2026-09-28-q2mb, note: again }\n',
    );
    expect(errors()).toEqual([
      'data/running/owner/run-overrides.yaml  override "2026-07-20-abcd"  field id: run "2026-07-20-abcd" does not exist',
      'data/running/owner/run-overrides.yaml  override "2026-09-28-q2mb"  field id: already has an entry (one entry per run)',
    ]);
  });

  it('checks the manual Garmin figures', () => {
    owner();
    repo.write(
      'data/running/owner/manual-metrics.yaml',
      'training_status:\n  - { as_of: 2026-10-12, status: productive }\n  - { as_of: 2026-10-12, status: maintaining }\n  - { as_of: 2026-10-18, status: peaking }\nrace_predictions:\n  - { as_of: 2026-10-17, marathon: "0:00" }\n',
    );
    expect(errors()).toEqual([
      'data/running/owner/manual-metrics.yaml  training status 2 (as of 2026-10-12)  field as_of: 2026-10-12 is used by another training status entry',
      'data/running/owner/manual-metrics.yaml  training status 3 (as of 2026-10-18)  field as_of: 2026-10-18 is in the future',
      'data/running/owner/manual-metrics.yaml  race prediction 1 (as of 2026-10-17)  field marathon: "0:00" is not a valid time (expected mm:ss or h:mm:ss)',
    ]);
  });

  it('keeps GPS to published races and hidden runs unpublished', () => {
    repo = tempRepo();
    const hash = 'a'.repeat(64);
    repo.write(runPath('2026-09-28-q2mb'), run('2026-09-28-q2mb'));
    repo.write('data/running/published/race-tracks/2026-09-28-q2mb.json', {
      schema_version: 1,
      id: '2026-09-28-q2mb',
      points: [[50.8, -0.1, 0, null], [50.81, -0.1, 10, null]],
      trim_ends_m: 0,
      bbox: [50.8, -0.1, 50.81, -0.1],
      source: 'intervals',
    });
    repo.write('data/running/published/state/manifest.json', {
      schema_version: 1,
      processed_at: '2026-10-17T10:00:00Z',
      runs: { '2026-09-28-q2mb': { input_hash: hash, hidden: true } },
      health: {},
    });
    expect(errors()).toEqual([
      'data/running/published/race-tracks/2026-09-28-q2mb.json  race track "2026-09-28-q2mb": has no published race run pointing at it (GPS is published for races only)',
      'data/running/published/runs/2026/2026-09-28-q2mb.json  run "2026-09-28-q2mb": is hidden by the owner but still published',
    ]);
  });

  it('checks published file placement and health ordering', () => {
    repo = tempRepo();
    repo.write('data/running/published/runs/2025/2026-09-28-q2mb.json', run('2026-09-28-q2mb'));
    repo.write('data/running/published/health/vo2max/2026.json', {
      schema_version: 1,
      metric: 'vo2max',
      unit: 'ml/kg/min',
      points: [{ date: '2026-02-01', value: 50 }, { date: '2026-01-31', value: 50 }, { date: '2025-12-31', value: 49 }],
    });
    expect(errors()).toEqual([
      'data/running/published/runs/2025/2026-09-28-q2mb.json  run "2026-09-28-q2mb": should be at data/running/published/runs/2026/2026-09-28-q2mb.json',
      'data/running/published/health/vo2max/2026.json  health series "vo2max"  field points[1].date: "2026-01-31" is not after the previous point (2026-02-01); points must be sorted, one per day',
      'data/running/published/health/vo2max/2026.json  health series "vo2max"  field points[2].date: "2025-12-31" is not in 2026',
      'data/running/published/health/vo2max/2026.json  health series "vo2max"  field points[2].date: "2025-12-31" is not after the previous point (2026-01-31); points must be sorted, one per day',
    ]);
  });
});
