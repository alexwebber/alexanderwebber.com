// Contract tests for RunningStore via JsonFileStore (T083, contracts/storage.md).
import { afterEach, describe, expect, it } from 'vitest';
import { JsonFileStore } from '../../src/sections/running/data/store/index.ts';
import { DataValidationError } from '../../src/shared/storage/index.ts';
import { run, runPath, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const suffix = (n: number) => Array.from({ length: 4 }, (_, i) => BASE32[(n >> (5 * i)) & 31]).join('');

describe('JsonFileStore', () => {
  it('is empty, not broken, before any data exists', async () => {
    repo = tempRepo();
    const store = new JsonFileStore(repo.root);
    expect(await store.listRuns()).toEqual([]);
    expect(await store.getRefreshRecord()).toBeUndefined();
    expect(await store.getHealthSeries('vo2max')).toEqual([]);
    const owner = await store.getOwner();
    expect(owner.section).toBeUndefined();
    expect(owner.goals).toEqual([]);
    expect(owner.manualMetrics).toEqual({ training_status: [], race_predictions: [] });
  });

  it('lists runs newest first and finds them by id', async () => {
    repo = tempRepo();
    for (const id of ['2026-10-01-aaaa', '2026-10-11-bbbb', '2025-12-31-cccc', '2026-10-11-aaaa']) {
      repo.write(runPath(id), run(id));
    }
    const store = new JsonFileStore(repo.root);
    expect((await store.listRuns()).map((r) => r.id)).toEqual([
      '2026-10-11-bbbb',
      '2026-10-11-aaaa',
      '2026-10-01-aaaa',
      '2025-12-31-cccc',
    ]);
    expect((await store.getRun('2025-12-31-cccc'))?.date).toBe('2025-12-31');
    expect(await store.getRun('2025-12-31-zzzz')).toBeUndefined();
  });

  it('merges health series across years and filters by range', async () => {
    repo = tempRepo();
    const series = (points: [string, number][]) => ({
      schema_version: 1,
      metric: 'resting_hr',
      unit: 'bpm',
      points: points.map(([date, value]) => ({ date, value })),
    });
    repo.write('data/running/published/health/resting_hr/2026.json', series([['2026-01-02', 49], ['2026-03-01', 47]]));
    repo.write('data/running/published/health/resting_hr/2025.json', series([['2025-12-30', 51]]));
    const store = new JsonFileStore(repo.root);
    expect((await store.getHealthSeries('resting_hr')).map((p) => p.date)).toEqual(['2025-12-30', '2026-01-02', '2026-03-01']);
    expect(await store.getHealthSeries('resting_hr', { from: '2026-01-01', to: '2026-02-28' })).toEqual([
      { date: '2026-01-02', value: 49 },
    ]);
  });

  it('fills owner schema defaults', async () => {
    repo = tempRepo();
    repo.write(
      'data/running/owner/section.yaml',
      'focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets hospice } }\n',
    );
    repo.write('data/running/owner/races/hove-10k/race.yaml', 'slug: hove-10k\ndate: 2026-06-07\ndistance: 10k\n');
    const owner = await new JsonFileStore(repo.root).getOwner();
    expect(owner.section).toMatchObject({ stale_after_hours: 12, featured_goal_limit: 6, recent_highlight_days: { pb: 14, goal: 14 } });
    expect(owner.races[0]).toMatchObject({ hide_map: false, trim_ends_m: 0, photos: [] });
  });

  it('throws DataValidationError naming the file, entry and field', async () => {
    repo = tempRepo();
    repo.write(
      'data/running/owner/goals.yaml',
      '- { id: 10k-sub-45, type: race_time, title: 10k, priority: 2, featured: true, target: { distance: 10k, time: "44:7x" } }\n',
    );
    const error = await new JsonFileStore(repo.root).getOwner().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataValidationError);
    expect(error).toMatchObject({
      file: 'data/running/owner/goals.yaml',
      entry: 'goal "10k-sub-45"',
      field: 'target.time',
      message:
        'data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time: "44:7x" is not a valid time (expected mm:ss or h:mm:ss)',
    });
  });

  it('reports YAML syntax errors and unexpected files', async () => {
    repo = tempRepo();
    repo.write('data/running/owner/upcoming-races.yaml', '- id: a\n  id: b\n');
    repo.write('data/running/owner/goal.yaml', '[]\n');
    const error = (await new JsonFileStore(repo.root).listRuns().catch((e: unknown) => e)) as DataValidationError;
    expect(error.issues.map((i) => [i.file, i.message.split(':')[0]])).toEqual([
      ['data/running/owner/goal.yaml', 'is not an expected data file (check the name and folder)'],
      ['data/running/owner/upcoming-races.yaml', 'is not valid YAML (line 2)'],
    ]);
  });

  it('lists 5,000 runs quickly', { timeout: 60_000 }, async () => {
    repo = tempRepo();
    for (let n = 0; n < 5000; n++) {
      const day = new Date(Date.UTC(2013, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
      const id = `${day}-${suffix(n)}`;
      repo.write(runPath(id), run(id));
    }
    const start = performance.now();
    const runs = await new JsonFileStore(repo.root).listRuns();
    const ms = performance.now() - start;
    expect(runs).toHaveLength(5000);
    expect(runs[0]!.date > runs[4999]!.date).toBe(true);
    expect(ms).toBeLessThan(15_000);
  });
});
