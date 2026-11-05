// The journey schemas' contract (specs/003-journey-story/data-model.md §3, §6-§8; FR-010, FR-060,
// FR-075, FR-077): every figure category's text pattern accepting and refusing made-up values, `when`
// in each form, the figure and photo limits, no digit in the share text, `ref` with `source`, and no
// `video` yet. The shared fixtures run in schemas.test.ts and ingest's pytest. All text is made up.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNNING_SCHEMAS } from '../../src/sections/running/data/store/schemas.ts';
import { SchemaSet } from '../../src/shared/storage/schemas.ts';
import { REPO_ROOT } from '../helpers/temp-repo.ts';

const schemas = new SchemaSet(join(REPO_ROOT, 'schemas'), RUNNING_SCHEMAS);
const APPROVED = { date: '2001-04-01', sha256: 'a'.repeat(64) };
const chapter = (extra: Record<string, unknown> = {}) => ({
  id: 'chapter-a',
  name: 'Lorem ipsum',
  when: '2001-03',
  prose: 'Lorem ipsum {{fig-a}} dolor.\n',
  takeaway: 'Sit amet.',
  approved: APPROVED,
  ...extra,
});
const ownerFigure = (category: string, text: string, extra: Record<string, unknown> = {}) => ({
  id: 'fig-a',
  category,
  label: 'Lorem',
  as_of: '2001-03',
  text,
  source: 'owner',
  ...(category === 'calories' ? { garmin: 'Garmin' } : {}),
  ...extra,
});
const chapterProblems = (extra: Record<string, unknown>) => schemas.validate('owner/journey-chapter', chapter(extra));
const figureOk = (category: string, text: string) => chapterProblems({ figures: [ownerFigure(category, text)] });

const TEXT: Record<string, [ok: string[], refused: string[]]> = {
  weight: [['12.3 kg', '80 kg'], ['12.3', '12.3kg', '12.3 lb', '12.3 kg ', 'kg']],
  body_fat: [['12.3%', '20%'], ['12.3', '12.3 %', '12.3 percent']],
  vo2_max: [['12', '12.5'], ['12 ml/kg/min', 'twelve']],
  fitness: [['45', '45.2'], ['45 load']],
  resting_hr: [['48 bpm'], ['48', '48bpm', '48.5 bpm']],
  hrv: [['52 ms'], ['52', '52ms']],
  race_prediction: [['44:59', '1:23:45'], ['44', '1:23:4', '1:60:00']],
  race_time: [['44:59', '3:29:59'], ['44 min']],
  best_effort: [['4:59', '19:59'], ['4.59']],
  run_distance: [['5 km', '42.2 km'], ['5', '5km', '3.1 mi']],
  run_pace: [['5:30 /km'], ['5:30', '5:30/km', '8:51 /mi']],
  training_total: [['1,234 km', '1234 km', '123.4 km', '12:30'], ['1,234', '1,23 km', '12 hours', '765 mi']],
  training_status: [['Productive', 'Maintaining'], ['Productive 2', '3']],
  calories: [['1,234 calories', '950 calories', '1,000 to 2,000 calories'], ['1234 calories', '1,234 kcal', '1,234 calories a day', '1,234', '1,234 kg']],
};

describe('journey-chapter: figure text by category (FR-077)', () => {
  for (const [category, [ok, refused]] of Object.entries(TEXT)) {
    it(`${category}: accepts ${ok.join(', ')} and refuses the rest`, () => {
      for (const text of ok) expect(figureOk(category, text), text).toEqual([]);
      for (const text of refused) expect(figureOk(category, text).map((p) => p.path.join('.')), text).toContain('figures.0.text');
    });
  }

  it('refuses a category outside the approved list (a new one needs a schema change)', () => {
    expect(figureOk('steps', '10,000').map((p) => p.path.join('.'))).toContain('figures.0.category');
  });

  it('keeps calories an owner figure credited to Garmin', () => {
    const fields = (extra: Record<string, unknown>) => chapterProblems({ figures: [{ ...ownerFigure('calories', '1,234 calories'), ...extra }] }).map((p) => p.path.join('.'));
    expect(fields({ garmin: undefined })).toEqual(['figures.0.garmin']);
    expect(fields({ garmin: 'derived' })).toEqual(['figures.0.garmin']);
    expect(fields({ source: 'stored', ref: { run: '2001-03-15-abcd' } })).toContain('figures.0.source');
    expect(chapterProblems({ figures: [{ ...ownerFigure('training_total', '12 km'), source: 'stored', ref: { run: '2001-03-15-abcd' } }] }).map((p) => p.path.join('.'))).toContain('figures.0.source');
  });
});

describe('journey-chapter: refs', () => {
  const stored = (category: string, text: string, ref: unknown) => chapterProblems({ figures: [{ ...ownerFigure(category, text), source: 'stored', ref }] });
  const HEALTH = { health: { metric: 'vo2max', date: '2001-03-15' } };
  const RUN = { run: '2001-03-15-abcd' };
  const MANUAL = { manual: { kind: 'training_status', as_of: '2001-03-15' } };
  const RACE = { race: 'lorem-10k' };

  it('requires a ref with source: stored and refuses one with source: owner', () => {
    expect(chapterProblems({ figures: [{ ...ownerFigure('vo2_max', '12'), source: 'stored' }] }).map((p) => [p.path.join('.'), p.message])).toEqual([['figures.0.ref', 'is required']]);
    expect(chapterProblems({ figures: [{ ...ownerFigure('vo2_max', '12'), ref: HEALTH }] }).map((p) => p.path.join('.'))).toEqual(['figures.0.ref']);
  });

  it('fixes the ref kind per category', () => {
    for (const category of ['weight', 'body_fat', 'vo2_max', 'fitness', 'resting_hr', 'hrv']) {
      const text = TEXT[category]![0][0]!;
      expect(stored(category, text, HEALTH), category).toEqual([]);
      for (const ref of [RUN, MANUAL, RACE]) expect(stored(category, text, ref).length, category).toBeGreaterThan(0);
    }
    for (const category of ['training_status', 'race_prediction']) {
      const text = TEXT[category]![0][0]!;
      expect(stored(category, text, MANUAL), category).toEqual([]);
      for (const ref of [RUN, HEALTH, RACE]) expect(stored(category, text, ref).length, category).toBeGreaterThan(0);
    }
    for (const category of ['run_distance', 'run_pace', 'best_effort']) {
      const text = TEXT[category]![0][0]!;
      expect(stored(category, text, RUN), category).toEqual([]);
      for (const ref of [HEALTH, MANUAL, RACE]) expect(stored(category, text, ref).length, category).toBeGreaterThan(0);
    }
    expect(stored('race_time', '44:59', RUN)).toEqual([]);
    expect(stored('race_time', '44:59', RACE)).toEqual([]);
    expect(stored('race_time', '44:59', HEALTH).length).toBeGreaterThan(0);
  });

  it('refuses a ref that is no record reference', () => {
    expect(stored('vo2_max', '12', { lorem: 'ipsum' }).map((p) => p.path.join('.'))).toContain('figures.0.ref');
    expect(stored('vo2_max', '12', { health: { metric: 'steps', date: '2001-03-15' } }).length).toBeGreaterThan(0);
  });
});

describe('journey-chapter: fields', () => {
  it('takes when as a day, a month or a period, each end a day or a month', () => {
    for (const when of ['2001-03-15', '2001-03', '2001-03/2001-09', '2001-03-15/2001-04', '2001-11/2002-02-01']) expect(chapterProblems({ when }), when).toEqual([]);
    for (const when of ['2001', '2001-3', '2001-13', '2001-03-32', '2001-03/', '2001-03/2001-04/2001-05', 'March 2001']) {
      expect(chapterProblems({ when }).map((p) => p.path.join('.')), when).toEqual(['when']);
    }
  });

  it('allows at most two figures and three photos', () => {
    const figure = (id: string) => ({ ...ownerFigure('weight', '12.3 kg'), id });
    const photo = (n: number) => ({ file: `lorem-${n}.jpg`, description: 'Lorem.', caption: 'Ipsum.' });
    expect(chapterProblems({ figures: [figure('a'), figure('b')] })).toEqual([]);
    expect(chapterProblems({ figures: [figure('a'), figure('b'), figure('c')] }).map((p) => p.path.join('.'))).toEqual(['figures']);
    expect(chapterProblems({ photos: [photo(1), photo(2), photo(3)] })).toEqual([]);
    expect(chapterProblems({ photos: [photo(1), photo(2), photo(3), photo(4)] }).map((p) => p.path.join('.'))).toEqual(['photos']);
  });

  it('needs a photo file of jpg, webp or avif, with a description and a caption', () => {
    const photo = (extra: Record<string, unknown>) => chapterProblems({ photos: [{ file: 'lorem.jpg', description: 'Lorem.', caption: 'Ipsum.', ...extra }] }).map((p) => p.path.join('.'));
    expect(photo({ file: 'lorem.webp' })).toEqual([]);
    expect(photo({ file: 'lorem.avif' })).toEqual([]);
    expect(photo({ file: 'lorem.png' })).toEqual(['photos.0.file']);
    expect(photo({ file: '../lorem.jpg' })).toEqual(['photos.0.file']);
    expect(photo({ caption: undefined })).toEqual(['photos.0.caption']);
    expect(photo({ description: undefined })).toEqual(['photos.0.description']);
  });

  it('keeps the name on one line and the takeaway to one paragraph of 400 characters', () => {
    expect(chapterProblems({ name: 'Lorem\nipsum' }).map((p) => p.path.join('.'))).toEqual(['name']);
    expect(chapterProblems({ takeaway: 'x'.repeat(400) })).toEqual([]);
    expect(chapterProblems({ takeaway: 'x'.repeat(401) }).map((p) => p.path.join('.'))).toEqual(['takeaway']);
    expect(chapterProblems({ takeaway: 'Lorem.\n\nIpsum.' }).map((p) => p.path.join('.'))).toEqual(['takeaway']);
    expect(chapterProblems({ takeaway: 'Lorem ipsum,\ndolor sit.\n' })).toEqual([]);
  });

  it('needs an approval of a date and 64 lower-case hexadecimal characters', () => {
    expect(chapterProblems({ approved: undefined }).map((p) => [p.path.join('.'), p.message])).toEqual([['approved', 'is required']]);
    expect(chapterProblems({ approved: { ...APPROVED, sha256: 'A'.repeat(64) } }).map((p) => p.path.join('.'))).toEqual(['approved.sha256']);
    expect(chapterProblems({ approved: { date: '2001-04-01' } }).map((p) => p.path.join('.'))).toEqual(['approved.sha256']);
  });

  it('has no video property yet (a later spec adds it with its own approval)', () => {
    expect(chapterProblems({ video: 'lorem.mp4' }).map((p) => [p.path.join('.'), p.message])).toEqual([['video', 'is not a known field (check the spelling)']]);
  });
});

describe('journey-page, journey-note and journey-closing', () => {
  const page = (extra: Record<string, unknown> = {}) =>
    schemas.validate('owner/journey-page', { title: 'Lorem Ipsum', description: 'Lorem ipsum dolor.', share_text: 'Lorem ipsum dolor', link_label: 'Lorem', approved: APPROVED, ...extra }).map((p) => p.path.join('.'));

  it('refuses any digit in the share text, a year included (owner decision 8)', () => {
    expect(page()).toEqual([]);
    for (const share_text of ['Lorem 2001', 'Lorem 1', '0']) expect(page({ share_text }), share_text).toEqual(['share_text']);
  });

  it('limits the title to 70, the description to 160 and the share text to 90 characters', () => {
    expect(page({ title: 'x'.repeat(70), description: 'x'.repeat(160), share_text: 'x'.repeat(90) })).toEqual([]);
    expect(page({ title: 'x'.repeat(71) })).toEqual(['title']);
    expect(page({ description: 'x'.repeat(161) })).toEqual(['description']);
    expect(page({ share_text: 'x'.repeat(91) })).toEqual(['share_text']);
    expect(page({ approved: undefined })).toEqual(['approved']);
  });

  it('keeps the note to one paragraph, and the closing section in paragraphs under a heading', () => {
    const note = (text: string) => schemas.validate('owner/journey-note', { text, approved: APPROVED }).map((p) => p.path.join('.'));
    expect(note('Lorem ipsum dolor sit amet.')).toEqual([]);
    expect(note('Lorem.\n\nIpsum.')).toEqual(['text']);
    const closing = (extra: Record<string, unknown>) =>
      schemas.validate('owner/journey-closing', { heading: 'Lorem', text: 'Lorem.\n\nIpsum.\n', approved: APPROVED, ...extra }).map((p) => p.path.join('.'));
    expect(closing({})).toEqual([]);
    expect(closing({ text: ' ' })).toEqual(['text']);
    expect(closing({ heading: undefined })).toEqual(['heading']);
  });
});
