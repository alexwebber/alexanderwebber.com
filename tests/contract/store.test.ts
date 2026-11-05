// Contract tests for RunningStore via JsonFileStore (T083, contracts/storage.md).
import { afterEach, describe, expect, it } from 'vitest';
import { storySha256 } from '../../src/sections/running/data/store/files.ts';
import { JsonFileStore } from '../../src/sections/running/data/store/index.ts';
import { DataValidationError } from '../../src/shared/storage/index.ts';
import { approve, chapter, chapterFile, CLOSING, closing, NOTE, note, PAGE, page, writeApproved, writePhoto, yaml } from '../helpers/journey.ts';
import { run, runPath, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const suffix = (n: number) => Array.from({ length: 4 }, (_, i) => BASE32[(n >> (5 * i)) & 31]).join('');

describe('JsonFileStore', () => {
  it('refuses a story whose text changed after approval, as the build\'s first step does (SC-007)', async () => {
    repo = tempRepo();
    repo.write('data/running/owner/stories/a-2027.yaml', `campaign: a-2027\ntext: Changed made-up text.\napproved:\n  date: 2026-11-01\n  text_sha256: ${storySha256('Made-up text.')}\n`);
    await expect(new JsonFileStore(repo.root).getOwner()).rejects.toThrow('field approved.text_sha256: the text has changed since it was approved');
  });

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
    expect(owner.campaigns).toEqual([]);
    expect(owner.stories).toEqual([]);
    expect(owner.journey).toEqual({ chapters: [] });
    expect(await store.getCampaignFigures()).toEqual([]);
  });

  it('loads every journey file of a full made-up story, chapters by folder (spec 003)', async () => {
    repo = tempRepo();
    const photos = { 'lorem.jpg': new Uint8Array([1, 2, 3]) };
    const b = chapter('chapter-b', { when: '2026-01', photos: [{ file: 'lorem.jpg', description: 'Lorem ipsum.', caption: 'Dolor sit.' }] });
    writeApproved(repo, chapterFile('chapter-b'), 'chapter', b, photos);
    writeApproved(repo, chapterFile('chapter-a'), 'chapter', chapter('chapter-a'));
    writeApproved(repo, NOTE, 'note', note());
    writeApproved(repo, PAGE, 'page', page());
    writeApproved(repo, CLOSING, 'closing', closing());
    const { journey } = await new JsonFileStore(repo.root).getOwner();
    expect(journey.chapters.map((c) => [c.id, c.photos?.length ?? 0])).toEqual([['chapter-a', 0], ['chapter-b', 1]]);
    expect(journey.note?.text).toBe(note().text);
    expect(journey.page?.title).toBe(page().title);
    expect(journey.closing?.heading).toBe(closing().heading);
    expect(journey.chapters[1]).toEqual(approve('chapter', b, new Map(Object.entries(photos))));
  });

  it('refuses an unapproved or changed journey file, reporting it (FR-034)', async () => {
    repo = tempRepo();
    writeApproved(repo, chapterFile('chapter-a'), 'chapter', chapter());
    repo.write(NOTE, yaml(note()));
    await expect(new JsonFileStore(repo.root).getOwner()).rejects.toThrow("data/running/owner/journey/note.yaml  note  field approved: needs the owner's approval before it can be published");
    writeApproved(repo, NOTE, 'note', note());
    expect((await new JsonFileStore(repo.root).getOwner()).journey.chapters).toHaveLength(1);
    repo.write(chapterFile('chapter-a'), yaml({ ...approve('chapter', chapter()), name: 'Changed' }));
    await expect(new JsonFileStore(repo.root).getOwner()).rejects.toThrow('chapter "chapter-a"  field approved.sha256: has changed since it was approved; the owner must approve it again');
  });

  it('accepts chapter photos beside their chapter, and nothing else in the journey folder', async () => {
    repo = tempRepo();
    writeApproved(repo, chapterFile('chapter-a'), 'chapter', chapter());
    writePhoto(repo, 'data/running/owner/journey/chapters/chapter-a/unlisted.webp', new Uint8Array([1]));
    expect((await new JsonFileStore(repo.root).getOwner()).journey.chapters).toHaveLength(1);
    repo.write('data/running/owner/journey/draft.md', 'Lorem.');
    await expect(new JsonFileStore(repo.root).getOwner()).rejects.toThrow('journey/draft.md: is not an expected data file');
  });

  it('loads a story, by campaign', async () => {
    repo = tempRepo();
    const story = (id: string, text: string) => `campaign: ${id}\ntext: ${text}\napproved:\n  date: 2026-11-01\n  text_sha256: ${storySha256(text)}\n`;
    repo.write('data/running/owner/stories/b-2027.yaml', story('b-2027', 'Made-up text.'));
    repo.write('data/running/owner/stories/a-2027.yaml', story('a-2027', 'Other made-up text.'));
    const { stories } = await new JsonFileStore(repo.root).getOwner();
    expect(stories.map((s) => [s.campaign, s.text])).toEqual([
      ['a-2027', 'Other made-up text.'],
      ['b-2027', 'Made-up text.'],
    ]);
  });

  it('loads campaigns and their published figures', async () => {
    repo = tempRepo();
    repo.write(
      'data/running/owner/campaigns.yaml',
      '- { id: beta-2027, race_id: beta, charity: { name: Beta }, page_url: https://www.justgiving.com/page/example-beta }\n- { id: alpha-2027, race_id: alpha, charity: { name: Alpha }, page_url: https://www.justgiving.com/page/example-alpha, finished: true }\n',
    );
    const figures = (id: string) => ({
      schema_version: 1,
      campaign_id: id,
      last_read_at: '2026-11-10T09:17:03Z',
      points: [{ date: '2026-11-09', raised_pence: 12500, target_pence: 50000, supporters: 3 }],
    });
    repo.write('data/running/published/fundraising/beta-2027.json', figures('beta-2027'));
    repo.write('data/running/published/fundraising/alpha-2027.json', figures('alpha-2027'));
    const store = new JsonFileStore(repo.root);
    expect((await store.getOwner()).campaigns.map((c) => [c.id, c.finished])).toEqual([
      ['beta-2027', false],
      ['alpha-2027', true],
    ]);
    const loaded = await store.getCampaignFigures();
    expect(loaded.map((f) => f.campaign_id)).toEqual(['alpha-2027', 'beta-2027']);
    expect(loaded[0]?.points[0]?.raised_pence).toBe(12500);
  });

  it('refuses a campaign figures file that fails its schema', async () => {
    repo = tempRepo();
    repo.write('data/running/published/fundraising/a.json', { schema_version: 1, campaign_id: 'a', last_read_at: '2026-11-10T09:17:03Z', points: [] });
    await expect(new JsonFileStore(repo.root).getCampaignFigures()).rejects.toBeInstanceOf(DataValidationError);
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
      'focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets } }\n',
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
