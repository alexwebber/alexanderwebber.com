// Fundraising's pure rules (T056, T073; FR-005, FR-022, FR-032, FR-042, FR-061, FR-063): amounts and
// percentages round down, a target is only ever "reached" when it is, the staleness edge is exact,
// and the chart holds a total until it changes.
import { afterEach, describe, expect, it } from 'vitest';
import { campaignsWithFigures } from '../../src/sections/running/data/store/index.ts';
import { barValueText, campaignProgress, chartPoints, chartSummary, isStale, poundsText, registeredText, supportersText, targetNote } from '../../src/sections/running/domain/fundraising.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

describe('poundsText (FR-063)', () => {
  it.each([
    [0, '£0'],
    [99, '£0'],
    [100, '£1'],
    [125099, '£1,250'],
    [103075, '£1,030'], // JustGiving's page shows £1,031
    [100000000, '£1,000,000'],
  ])('%d pence reads %s', (pence, text) => {
    expect(poundsText(pence)).toBe(text);
  });
});

describe('campaignProgress (FR-032)', () => {
  it('rounds down, so £1,250 of £2,000 is 62, not 63', () => {
    expect(campaignProgress(125000, 200000)).toEqual({ percent: 62, fraction: 0.62, reached: false, beaten: false });
  });

  it('never shows 99.9% as complete', () => {
    expect(campaignProgress(199800, 200000)).toEqual({ percent: 99, fraction: 0.99, reached: false, beaten: false });
    expect(campaignProgress(199999, 200000)?.percent).toBe(99);
  });

  it('is reached exactly at the target', () => {
    expect(campaignProgress(200000, 200000)).toEqual({ percent: 100, fraction: 1, reached: true, beaten: false });
  });

  it('caps the bar when the target is beaten, and keeps the real percentage', () => {
    expect(campaignProgress(216000, 200000)).toEqual({ percent: 108, fraction: 1, reached: false, beaten: true });
  });

  it('starts empty', () => {
    expect(campaignProgress(0, 50000)).toEqual({ percent: 0, fraction: 0, reached: false, beaten: false });
  });

  it('has no progress at all without a target', () => {
    expect(campaignProgress(125000, undefined)).toBeUndefined();
  });
});

describe('barValueText and targetNote', () => {
  it('gives the bar its value in words (FR-061)', () => {
    expect(barValueText(125000, 200000, campaignProgress(125000, 200000)!)).toBe('£1,250 of £2,000, 62%');
  });

  it('says nothing below the target, or without one', () => {
    expect(targetNote(campaignProgress(199999, 200000))).toBeUndefined();
    expect(targetNote(undefined)).toBeUndefined();
  });

  it('celebrates the target with the percentage', () => {
    expect(targetNote(campaignProgress(200000, 200000))).toBe('Target reached: 100%');
    expect(targetNote(campaignProgress(216000, 200000))).toBe('Target beaten: 108%');
  });
});

describe('supportersText', () => {
  it.each([
    [0, 'No supporters yet'],
    [1, '1 supporter'],
    [2, '2 supporters'],
    [37, '37 supporters'],
    [1234, '1,234 supporters'],
  ])('%d reads %s', (count, text) => {
    expect(supportersText(count)).toBe(text);
  });
});

describe('isStale (FR-005)', () => {
  const read = '2026-11-10T09:00:00Z';

  it('is fresh at exactly the threshold', () => {
    expect(isStale(read, new Date('2026-11-10T21:00:00Z'), 12)).toBe(false);
  });

  it('is stale a second past it', () => {
    expect(isStale(read, new Date('2026-11-10T21:00:01Z'), 12)).toBe(true);
  });

  it('follows the configured threshold', () => {
    expect(isStale(read, new Date('2026-11-10T15:00:01Z'), 6)).toBe(true);
  });
});

describe('registeredText', () => {
  it('names the legal charity when it differs from the campaign\'s', () => {
    expect(registeredText({ name: 'Martlets', registered: { name: 'Southern Hospice Group', number: '256789' } })).toBe('Part of Southern Hospice Group, registered charity 256789');
  });

  it('gives only the number when they match', () => {
    expect(registeredText({ name: 'Example hospice', registered: { name: 'Example hospice', number: '000000' } })).toBe('Registered charity 000000');
  });

  it('says nothing without a registered charity', () => {
    expect(registeredText({ name: 'Example hospice' })).toBeUndefined();
  });
});

describe('chartPoints (FR-042)', () => {
  const at = (date: string, raised_pence: number) => ({ date, raised_pence });
  const line = (date: string, value: number) => ({ date, value });

  it('has nothing to add for a change on the next day', () => {
    expect(chartPoints([at('2026-11-01', 100), at('2026-11-02', 300)], '2026-11-02')).toEqual([line('2026-11-01', 100), line('2026-11-02', 300)]);
  });

  it('holds a total across a gap of weeks, until the day before it changes', () => {
    expect(chartPoints([at('2026-10-01', 100), at('2026-10-20', 300)], '2026-10-20')).toEqual([line('2026-10-01', 100), line('2026-10-19', 100), line('2026-10-20', 300)]);
  });

  it('shows a drop as honestly as a rise', () => {
    expect(chartPoints([at('2026-10-01', 300), at('2026-10-20', 100)], '2026-10-20')).toEqual([line('2026-10-01', 300), line('2026-10-19', 300), line('2026-10-20', 100)]);
  });

  it('closes on today at the last total', () => {
    expect(chartPoints([at('2026-11-01', 100), at('2026-11-02', 300)], '2026-11-10')).toEqual([line('2026-11-01', 100), line('2026-11-02', 300), line('2026-11-10', 300)]);
  });

  it('adds no closing point when the last total is today\'s', () => {
    expect(chartPoints([at('2026-11-10', 100)], '2026-11-10')).toEqual([line('2026-11-10', 100)]);
  });

  it('adds no step where the total didn\'t move, as when only the target changed', () => {
    expect(chartPoints([at('2026-10-01', 100), at('2026-10-20', 100)], '2026-10-20')).toEqual([line('2026-10-01', 100), line('2026-10-20', 100)]);
  });

  it('never changes the stored points', () => {
    const points = [at('2026-10-01', 100), at('2026-10-20', 300)];
    chartPoints(points, '2026-11-10');
    expect(points).toEqual([at('2026-10-01', 100), at('2026-10-20', 300)]);
  });
});

describe('chartSummary (FR-061)', () => {
  const point = (date: string, raised_pence: number, target_pence?: number) => ({ date, raised_pence, supporters: 1, ...(target_pence !== undefined ? { target_pence } : {}) });

  it('US2.2: the total, since when, and its share of the latest target', () => {
    expect(chartSummary([point('2026-11-10', 1000, 100000), point('2026-12-01', 125000, 200000)])).toBe('£1,250 raised since 10 Nov 2026, 62% of the £2,000 target');
  });

  it('keeps the real percentage past the target', () => {
    expect(chartSummary([point('2026-11-10', 1000, 200000), point('2026-12-01', 216000, 200000)])).toBe('£2,160 raised since 10 Nov 2026, 108% of the £2,000 target');
  });

  it('leaves the target out when the page has none', () => {
    expect(chartSummary([point('2026-11-10', 1000), point('2026-12-01', 125000)])).toBe('£1,250 raised since 10 Nov 2026');
  });
});

describe('campaignsWithFigures (FR-040, research.md R13)', () => {
  let repo: TempRepo;
  afterEach(() => repo?.cleanup());

  const FILE = 'data/running/owner/campaigns.yaml';
  const figures = (id: string) => `data/running/published/fundraising/${id}.json`;
  const list = (...ids: string[]) => ids.map((id) => `- { id: ${id}, race_id: ${id}, charity: { name: Example }, page_url: https://www.justgiving.com/page/${id} }\n`).join('');

  it('finds nothing with no campaigns.yaml', () => {
    repo = tempRepo();
    expect(campaignsWithFigures(repo.root)).toEqual([]);
  });

  it('finds nothing for a campaign with no published file', () => {
    repo = tempRepo();
    repo.write(FILE, list('seaside-2027'));
    expect(campaignsWithFigures(repo.root)).toEqual([]);
  });

  it('finds nothing for a published file with no campaign', () => {
    repo = tempRepo();
    repo.write(figures('seaside-2027'), '{}');
    expect(campaignsWithFigures(repo.root)).toEqual([]);
  });

  it('finds a campaign with its file, and only that one', () => {
    repo = tempRepo();
    repo.write(FILE, list('seaside-2027', 'lakeside-2027'));
    repo.write(figures('lakeside-2027'), '{}');
    expect(campaignsWithFigures(repo.root)).toEqual(['lakeside-2027']);
  });

  it.each([
    ['all comments', '# nothing yet\n'],
    ['not valid YAML', '- { id: [\n'],
    ['not a list', 'id: seaside-2027\n'],
  ])('leaves %s to the build\'s validation, rather than failing as the config loads', (_, content) => {
    repo = tempRepo();
    repo.write(FILE, content);
    expect(campaignsWithFigures(repo.root)).toEqual([]);
  });
});
