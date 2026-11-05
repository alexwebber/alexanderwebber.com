// validate-data's journey checks (specs/003-journey-story/contracts/content-files.md, research.md
// R18): the loader's approval rules and every validate.ts rule, each refused case planted alone and
// asserted by file, entry, field and severity; the approval hash's edges; and the sentinel test
// (FR-035, SC-003): no message carries a word of the story. All text here is made up.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { main as approveMain } from '../../scripts/approve-story.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { journeySha256, loadRunningData } from '../../src/sections/running/data/store/files.ts';
import { JsonFileStore } from '../../src/sections/running/data/store/index.ts';
import { DataValidationError, formatIssue } from '../../src/shared/storage/errors.ts';
import {
  approve,
  chapter,
  chapterFile,
  CLOSING,
  closing,
  lorem,
  NOTE,
  note,
  PAGE,
  page,
  writeApproved,
  writePhoto,
  writeStory,
  yaml,
  type Value,
} from '../helpers/journey.ts';
import { REPO_ROOT, run, runPath, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => {
  repo?.cleanup();
  vi.restoreAllMocks();
});

const TODAY = '2026-11-10';
const OWNER = 'data/running/owner';
const SECTION = `${OWNER}/section.yaml`;
const A = chapterFile('chapter-a');
const ENTRY = 'chapter "chapter-a"';
const PHOTO = new Uint8Array([1, 2, 3, 4]);
const OTHER_PHOTO = new Uint8Array([1, 2, 3, 5]);

const all = () => validateData(repo.root, { today: TODAY });
const issues = (severity: 'error' | 'warning') => all().filter((i) => i.severity === severity).map(formatIssue);
const errors = () => issues('error');
const at = (file: string, entry: string, field: string, message: string) => `${[file, entry, field ? `field ${field}` : ''].filter(Boolean).join('  ')}: ${message}`;
const changed = (file = A, entry = ENTRY) => at(file, entry, 'approved.sha256', 'has changed since it was approved; the owner must approve it again');

function setUp(storyLink = '') {
  repo = tempRepo();
  repo.write(SECTION, `focus_race: { race_id: made-up-10k, build_start: 2026-01-05, charity: { name: Example hospice } }\ngarmin_devices: { scale: Index S2 }\n${storyLink}`);
  repo.write(`${OWNER}/upcoming-races.yaml`, '- { id: made-up-10k, name: Made-up 10k, date: 2027-04-04, distance: 10k }\n');
}

/** Stored records for stored figures: health points, two runs, manual metrics and two races. */
function storedData() {
  const series = (metric: string, unit: string, points: [string, number][]) =>
    repo.write(`data/running/published/health/${metric}/2026.json`, { schema_version: 1, metric, unit, points: points.map(([date, value]) => ({ date, value })) });
  series('vo2max', 'ml/kg/min', [['2026-01-10', 52], ['2026-03-15', 53]]);
  series('weight_avg7', 'kg', [['2026-01-10', 80], ['2026-03-15', 79]]);
  series('fitness_ctl', 'load', [['2026-01-10', 40], ['2026-03-15', 45]]);
  repo.write(runPath('2026-03-15-abcd'), run('2026-03-15-abcd', { device: 'Venu X1' }));
  repo.write(runPath('2026-03-16-efgh'), run('2026-03-16-efgh'));
  repo.write(`${OWNER}/manual-metrics.yaml`, 'training_status:\n  - { as_of: 2026-03-15, status: productive }\nrace_predictions:\n  - { as_of: 2026-03-15, 10k: "45:00" }\n');
  repo.write(`${OWNER}/races/lorem-10k/race.yaml`, 'slug: lorem-10k\ndate: 2026-03-20\nname: Lorem 10k\ndistance: 10k\nofficial_time: "45:00"\n');
  repo.write(`${OWNER}/races/ipsum-5k/race.yaml`, 'slug: ipsum-5k\ndate: 2026-03-21\nname: Ipsum 5k\ndistance: 5k\n');
}

/** A chapter with one figure, placed inline in its first paragraph. */
const withFigure = (figure: Value, extra: Value = {}) =>
  chapter('chapter-a', { prose: `${lorem(2, 6)} {{fig-a}} ${lorem(3, 4)}.\n`, figures: [{ id: 'fig-a', label: lorem(8, 1), ...figure }], ...extra });

/** Writes the chapter approved, then changes it without a new approval. */
function changeAfterApproval(value: Value, change: (approved: Value) => void, photos: Record<string, Uint8Array> = {}) {
  writeStory(repo, { chapter: value, photos });
  const approved = structuredClone(approve('chapter', value, new Map(Object.entries(photos))));
  change(approved);
  repo.write(A, yaml(approved));
}

const withPhoto = () =>
  chapter('chapter-a', { photos: [{ file: 'lorem.jpg', description: `${lorem(20, 5)}.`, caption: `${lorem(21, 4)}.` }] });

describe('journey validation: a valid story', () => {
  it('passes one approved chapter, the note and the page wording', () => {
    setUp();
    writeStory(repo);
    expect(errors()).toEqual([]);
    expect(issues('warning')).toEqual([]);
  });

  it('passes no journey at all, and a note or page wording alone, silently', () => {
    setUp();
    expect(errors()).toEqual([]);
    writeApproved(repo, NOTE, 'note', note());
    writeApproved(repo, PAGE, 'page', page());
    expect(errors()).toEqual([]);
    expect(issues('warning')).toEqual([]);
  });

  it('passes stored figures whose records exist, with their Garmin attribution', () => {
    setUp();
    storedData();
    const figures = [
      { id: 'fig-a', category: 'vo2_max', label: 'Lorem', as_of: '2026-03-15', text: '53', source: 'stored', ref: { health: { metric: 'vo2max', date: '2026-03-15' } }, garmin: 'Garmin' },
      { id: 'fig-b', category: 'weight', label: 'Ipsum', as_of: '2026-03', text: '79 kg', source: 'stored', ref: { health: { metric: 'weight_avg7', date: '2026-03-15' } }, garmin: 'Index S2' },
    ];
    writeStory(repo, { chapter: chapter('chapter-a', { prose: `${lorem(2, 5)} {{fig-a}} ${lorem(3, 3)}.\n\n{{fig-b}}\n`, figures }) });
    expect(errors()).toEqual([]);
    const run1 = { id: 'fig-a', category: 'run_distance', label: 'Lorem', as_of: '2026-03-15', text: '5 km', source: 'stored', ref: { run: '2026-03-15-abcd' }, garmin: 'Venu X1' };
    const run2 = { id: 'fig-b', category: 'race_time', label: 'Ipsum', as_of: '2026-03-16', text: '25:00', source: 'stored', ref: { run: '2026-03-16-efgh' }, garmin: 'Garmin' };
    writeStory(repo, { chapter: chapter('chapter-a', { prose: `${lorem(2, 5)} {{fig-a}} and {{fig-b}}.\n`, figures: [run1, run2] }) });
    expect(errors()).toEqual([]);
    const status = { id: 'fig-a', category: 'training_status', label: 'Lorem', as_of: '2026-03-15', text: 'Productive', source: 'stored', ref: { manual: { kind: 'training_status', as_of: '2026-03-15' } }, garmin: 'Garmin' };
    const race = { id: 'fig-b', category: 'race_time', label: 'Ipsum', as_of: '2026-03-20', text: '45:00', source: 'stored', ref: { race: 'lorem-10k' } };
    writeStory(repo, { chapter: chapter('chapter-a', { prose: `${lorem(2, 5)} {{fig-a}} and {{fig-b}}.\n`, figures: [status, race] }) });
    expect(errors()).toEqual([]);
    const fitness = { id: 'fig-a', category: 'fitness', label: 'Lorem', as_of: '2026-03-15', text: '45', source: 'stored', ref: { health: { metric: 'fitness_ctl', date: '2026-03-15' } }, garmin: 'derived' };
    writeStory(repo, { chapter: withFigure(fitness) });
    expect(errors()).toEqual([]);
  });

  it('passes a chapter with photos, and two chapters on the same start with distinct orders', () => {
    setUp();
    writeStory(repo, { chapter: withPhoto(), photos: { 'lorem.jpg': PHOTO } });
    writeApproved(repo, chapterFile('chapter-b'), 'chapter', chapter('chapter-b', { order: 2 }));
    expect(errors()).toEqual(['data/running/owner/journey/chapters/chapter-b/chapter.yaml  chapter "chapter-b"  field order: starts on the same day as chapter "chapter-a": give each a distinct order']);
    writeStory(repo, { chapter: chapter('chapter-a', { order: 1 }) });
    expect(errors()).toEqual([]);
  });
});

describe('journey validation: approval (loader)', () => {
  it('refuses each file without an approval', () => {
    setUp();
    writeStory(repo);
    repo.write(A, yaml(chapter()));
    expect(errors()).toEqual([at(A, ENTRY, 'approved', "needs the owner's approval before it can be published")]);
    writeStory(repo);
    repo.write(NOTE, yaml(note()));
    expect(errors()).toEqual([at(NOTE, 'note', 'approved', "needs the owner's approval before it can be published")]);
    writeStory(repo);
    repo.write(PAGE, yaml(page()));
    expect(errors()).toEqual([at(PAGE, 'page wording', 'approved', "needs the owner's approval before it can be published")]);
    writeStory(repo);
    repo.write(CLOSING, yaml(closing()));
    expect(errors()).toEqual([at(CLOSING, 'closing section', 'approved', "needs the owner's approval before it can be published")]);
  });

  it("holds the loader's missing-approval message equal to each schema's x-error", () => {
    for (const name of ['chapter', 'note', 'page', 'closing']) {
      const schema = JSON.parse(readFileSync(join(REPO_ROOT, `schemas/owner/journey-${name}.schema.json`), 'utf8'));
      expect(schema.properties.approved['x-error']).toBe("needs the owner's approval before it can be published");
    }
  });

  const edits: [string, (v: Value) => void][] = [
    ['name', (v) => (v.name = `${v.name}x`)],
    ['when', (v) => (v.when = '2026-04')],
    ['prose', (v) => (v.prose = String(v.prose).replace('m', 'n'))],
    ['takeaway', (v) => (v.takeaway = `${v.takeaway}x`)],
    ["a figure's text", (v) => ((v.figures as Value[])[0]!.text = '12.4 kg')],
    ['the order', (v) => (v.order = 3)],
  ];
  for (const [what, edit] of edits) {
    it(`refuses a chapter whose ${what} changed by one character after approval`, () => {
      setUp();
      changeAfterApproval(chapter(), edit);
      expect(errors()).toEqual([changed()]);
    });
  }

  it("refuses a changed caption, a changed description, and a photo swapped under the same name", () => {
    setUp();
    changeAfterApproval(withPhoto(), (v) => ((v.photos as Value[])[0]!.caption = 'Changed.'), { 'lorem.jpg': PHOTO });
    expect(errors()).toEqual([changed()]);
    changeAfterApproval(withPhoto(), (v) => ((v.photos as Value[])[0]!.description = 'Changed.'), { 'lorem.jpg': PHOTO });
    expect(errors()).toEqual([changed()]);
    writeStory(repo, { chapter: withPhoto(), photos: { 'lorem.jpg': PHOTO } });
    expect(errors()).toEqual([]);
    writePhoto(repo, `${OWNER}/journey/chapters/chapter-a/lorem.jpg`, OTHER_PHOTO);
    expect(errors()).toEqual([changed()]);
  });

  it('refuses changed note, page wording and closing section', () => {
    setUp();
    writeStory(repo);
    repo.write(NOTE, yaml({ ...approve('note', note()), text: 'Changed.' }));
    repo.write(PAGE, yaml({ ...approve('page', page()), share_text: 'Changed' }));
    repo.write(CLOSING, yaml({ ...approve('closing', closing()), heading: 'Changed' }));
    expect(errors()).toEqual([changed(CLOSING, 'closing section'), changed(NOTE, 'note'), changed(PAGE, 'page wording')]);
  });

  it('reports a listed photo that is missing once, with no hash message', () => {
    setUp();
    writeStory(repo, { chapter: withPhoto(), photos: { 'lorem.jpg': PHOTO } });
    repo.cleanup();
    setUp();
    writeApproved(repo, NOTE, 'note', note());
    writeApproved(repo, PAGE, 'page', page());
    repo.write(A, yaml(approve('chapter', withPhoto(), new Map([['lorem.jpg', PHOTO]]))));
    expect(errors()).toEqual([at(A, ENTRY, 'photos[0].file', "is listed but isn't in the chapter's folder")]);
  });

  it("doesn't move the hash for CRLF line endings, a YAML comment, or a field outside the hashed list", () => {
    setUp();
    writeStory(repo);
    const text = readFileSync(join(repo.root, A), 'utf8');
    repo.write(A, `# A made-up comment.\n${text}`.replace(/\n/g, '\r\n'));
    expect(errors()).toEqual([]);
    const value = chapter();
    expect(journeySha256('chapter', { ...value, video: 'lorem.mp4', approved: { date: '2026-01-01', sha256: 'x' } })).toBe(journeySha256('chapter', value));
    expect(journeySha256('note', { ...note(), extra: 1 })).toBe(journeySha256('note', note()));
  });

  it("hashes each file's own fields, absent optional fields left out", () => {
    const value = chapter();
    expect(journeySha256('chapter', value)).toBe(journeySha256('chapter', { ...value, order: undefined }));
    expect(journeySha256('chapter', value)).not.toBe(journeySha256('chapter', { ...value, order: 1 }));
    expect(journeySha256('page', page())).not.toBe(journeySha256('page', page({ link_label: 'Other' })));
    expect(() => journeySha256('chapter', withPhoto())).toThrow('no bytes');
  });

  it('stops validateData, the store and loadRunningData alike on an unapproved file (FR-034)', async () => {
    setUp();
    writeStory(repo);
    repo.write(A, yaml({ ...approve('chapter', chapter()), takeaway: 'Changed.' }));
    expect(errors()).toEqual([changed()]);
    const loaded = loadRunningData(repo.root);
    expect(loaded.data.journey.chapters).toEqual([]);
    expect(loaded.issues.map(formatIssue)).toEqual([changed()]);
    const error = await new JsonFileStore(repo.root).getOwner().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataValidationError);
    expect((error as DataValidationError).issues.map(formatIssue)).toEqual([changed()]);
  });
});

describe('journey validation: refused cases (validate.ts)', () => {
  const plant = (value: Value, photos: Record<string, Uint8Array> = {}) => {
    setUp();
    writeStory(repo, { chapter: value, photos });
    return errors();
  };

  it('refuses an id that differs from its folder', () => {
    setUp();
    writeStory(repo);
    writeApproved(repo, chapterFile('chapter-b'), 'chapter', chapter('chapter-c', { when: '2026-04' }));
    expect(errors()).toEqual([at(chapterFile('chapter-b'), 'chapter "chapter-c"', 'id', "does not match the name of its folder (a chapter's id is its folder name, FR-051)")]);
  });

  it('refuses a future when, a future as_of and a future approval date', () => {
    expect(plant(chapter('chapter-a', { when: '2026-12' }))).toEqual([at(A, ENTRY, 'when', 'is in the future')]);
    expect(plant(chapter('chapter-a', { when: '2026-03/2026-12' }))).toEqual([at(A, ENTRY, 'when', 'is in the future')]);
    expect(plant(withFigure({ category: 'weight', as_of: '2026-12', text: '12.3 kg', source: 'owner' }))).toEqual([at(A, ENTRY, 'figures[0].as_of', 'is in the future')]);
    setUp();
    writeStory(repo);
    repo.write(A, yaml(approve('chapter', chapter(), new Map(), '2026-12-01')));
    expect(errors()).toEqual([at(A, ENTRY, 'approved.date', 'is in the future')]);
  });

  it('refuses a period whose start is after its end, and a day that does not exist', () => {
    expect(plant(chapter('chapter-a', { when: '2026-05/2026-03' }))).toEqual([at(A, ENTRY, 'when', 'must start before it ends')]);
    expect(plant(chapter('chapter-a', { when: '2026-02-30' }))).toEqual([at(A, ENTRY, 'when', "names a day that doesn't exist")]);
  });

  it('refuses a same-day tie with no order, naming both chapters', () => {
    setUp();
    writeStory(repo);
    writeApproved(repo, chapterFile('chapter-b'), 'chapter', chapter('chapter-b', { when: '2026-03' }));
    expect(errors()).toEqual([at(chapterFile('chapter-b'), 'chapter "chapter-b"', 'order', 'starts on the same day as chapter "chapter-a": give each a distinct order')]);
  });

  it('refuses a placeholder with no figure, a figure with no placeholder or two, and a repeated figure id', () => {
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-a}} {{fig-x}}.\n` }))).toEqual([
      at(A, ENTRY, 'prose, paragraph 1', "{{fig-x}} names no figure in this chapter's figures"),
    ]);
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)}.\n` }))).toEqual([
      at(A, ENTRY, 'figures[0].id', 'has no {{fig-a}} placeholder in the prose (each figure has exactly one)'),
    ]);
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-a}}.\n\n${lorem(3, 3)} {{fig-a}}.\n` }))).toEqual([
      at(A, ENTRY, 'figures[0].id', 'has 2 {{fig-a}} placeholders in the prose (each figure has exactly one)'),
    ]);
    const figure = (chapter().figures as Value[])[0]!;
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-a}}.

${lorem(3, 3)} {{fig-a}}.
`, figures: [figure, figure] }))).toContain(
      at(A, ENTRY, 'figures[1].id', 'is used by another figure in this chapter'),
    );
  });

  it('refuses a third figure and a fourth photo (schema)', () => {
    const figure = (n: number) => ({ id: `fig-${n}`, category: 'weight', label: 'Lorem', as_of: '2026-03', text: '12.3 kg', source: 'owner' });
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-1}} {{fig-2}} {{fig-3}}.\n`, figures: [figure(1), figure(2), figure(3)] }))).toEqual([
      at(A, ENTRY, 'figures', 'has more than two figures (a chapter carries at most two)'),
    ]);
    const photo = (n: number) => ({ file: `lorem-${n}.jpg`, description: 'Lorem.', caption: 'Ipsum.' });
    const bytes = Object.fromEntries([1, 2, 3, 4].map((n) => [`lorem-${n}.jpg`, PHOTO]));
    expect(plant(chapter('chapter-a', { photos: [photo(1), photo(2), photo(3), photo(4)] }), bytes)).toEqual([
      at(A, ENTRY, 'photos', 'has more than three photos (a chapter carries at most three)'),
    ]);
  });

  it('refuses a photo with no caption (schema)', () => {
    expect(plant(chapter('chapter-a', { photos: [{ file: 'lorem.jpg', description: 'Lorem.' }] }), { 'lorem.jpg': PHOTO })).toEqual([at(A, ENTRY, 'photos[0].caption', 'is required')]);
  });

  it('refuses a lone figure first, an external link and stray markup, by paragraph', () => {
    expect(plant(chapter('chapter-a', { prose: `{{fig-a}}\n\n${lorem(2, 5)}.\n` }))).toEqual([
      at(A, ENTRY, 'prose, paragraph 1', 'is a figure on its own: a chapter opens with prose, so put the figure after a paragraph'),
    ]);
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-a}}.\n\n${lorem(3, 2)} [${lorem(4, 2)}](https://example.org/) ${lorem(5, 2)}.\n` }))).toEqual([
      at(A, ENTRY, 'prose, paragraph 2', "has a link that isn't a path on this site: use [text](/path/) or [text](/path/#anchor), with no scheme, query or spaces"),
    ]);
    expect(plant(chapter('chapter-a', { prose: `${lorem(2, 4)} {{fig-a}}.\n\n${lorem(3, 2)} <b>${lorem(4, 2)}</b>.\n` }))).toEqual([
      at(A, ENTRY, 'prose, paragraph 2', 'has an HTML-like tag (< followed by a letter or /); write plain text'),
    ]);
    expect(plant(chapter('chapter-a', { takeaway: `${lorem(7, 3)} [${lorem(8, 1)}](/running/).` }))).toEqual([
      at(A, ENTRY, 'takeaway, paragraph 1', "has a link, which isn't allowed here: write plain text"),
    ]);
  });

  it('refuses a missing note and missing page wording once any chapter exists', () => {
    setUp();
    writeApproved(repo, A, 'chapter', chapter());
    writeApproved(repo, PAGE, 'page', page());
    expect(errors()).toEqual([at(NOTE, 'note', '', 'is missing: the story needs its approved note before it can be published (FR-008)')]);
    repo.cleanup();
    setUp();
    writeApproved(repo, A, 'chapter', chapter());
    writeApproved(repo, NOTE, 'note', note());
    expect(errors()).toEqual([at(PAGE, 'page wording', '', 'is missing: the story needs its approved page wording before it can be published (FR-039)')]);
  });

  it('refuses markup in the note and a placeholder in the closing section', () => {
    setUp();
    writeStory(repo);
    writeApproved(repo, NOTE, 'note', note({ text: `${lorem(9, 4)} [${lorem(10, 1)}](/running/).` }));
    expect(errors()).toEqual([at(NOTE, 'note', 'text, paragraph 1', "has a link, which isn't allowed here: write plain text")]);
    writeApproved(repo, NOTE, 'note', note());
    writeApproved(repo, CLOSING, 'closing', closing({ text: `${lorem(15, 4)}.\n\n${lorem(16, 3)} {{fig-a}}.\n` }));
    expect(errors()).toEqual([
      at(CLOSING, 'closing section', 'text, paragraph 2', "has a figure placeholder, which isn't allowed here: figures belong in a chapter's prose"),
    ]);
  });

  it('warns about a closing section with no chapter, and only warns', () => {
    setUp();
    writeApproved(repo, CLOSING, 'closing', closing());
    expect(errors()).toEqual([]);
    expect(issues('warning')).toEqual([at(CLOSING, 'closing section', '', 'has no chapter to follow, so it is not shown')]);
  });

  it('refuses a story_link with no chapter, an href other than the story page, and a label that differs', () => {
    const LINK = `story_link: { href: /running/story/, label: ${String(page().link_label)} }\n`;
    setUp(LINK);
    expect(errors()).toEqual([at(SECTION, '', 'story_link.href', "leads to the story page, which doesn't exist until a chapter does")]);
    writeStory(repo);
    expect(errors()).toEqual([]);
    repo.write(SECTION, readFileSync(join(repo.root, SECTION), 'utf8').replace('/running/story/', '/story/'));
    expect(errors()).toEqual([at(SECTION, '', 'story_link.href', 'must be the story page, /running/story/')]);
    repo.write(SECTION, readFileSync(join(repo.root, SECTION), 'utf8').replace('/story/', '/running/story/').replace(`label: ${String(page().link_label)}`, 'label: Other words'));
    expect(errors()).toEqual([at(SECTION, '', 'story_link.label', 'differs from link_label in data/running/owner/journey/page.yaml; they must match')]);
  });

  it('refuses a stored figure with no record, and one dated before the stored data', () => {
    const vo2 = (date: string, asOf = date) => ({ category: 'vo2_max', as_of: asOf, text: '53', source: 'stored', ref: { health: { metric: 'vo2max', date } }, garmin: 'Garmin' });
    setUp();
    storedData();
    writeStory(repo, { chapter: withFigure(vo2('2026-03-16')) });
    expect(errors()).toEqual([
      at(A, ENTRY, 'figures[0].ref.health', 'names no stored record (a published run, a published health point of that metric and date, a manual-metrics.yaml entry of that kind and date, or a race.yaml with an official time)'),
    ]);
    writeStory(repo, { chapter: withFigure(vo2('2025-12-01', '2025-12')) });
    expect(errors()).toEqual([
      at(A, ENTRY, 'figures[0].as_of', 'is before the first stored record of its kind: before then only the owner can supply it (source: owner)'),
    ]);
    writeStory(repo, { chapter: withFigure({ category: 'run_distance', as_of: '2026-03-17', text: '5 km', source: 'stored', ref: { run: '2026-03-17-zzzz' }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([
      at(A, ENTRY, 'figures[0].ref.run', 'names no stored record (a published run, a published health point of that metric and date, a manual-metrics.yaml entry of that kind and date, or a race.yaml with an official time)'),
    ]);
  });

  it("refuses a figure whose category and ref disagree, and a race ref to a race with no official time", () => {
    setUp();
    storedData();
    writeStory(repo, { chapter: withFigure({ category: 'weight', as_of: '2026-03-15', text: '79 kg', source: 'stored', ref: { health: { metric: 'vo2max', date: '2026-03-15' } }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].ref.health.metric', 'must be weight_avg7 for a weight figure')]);
    writeStory(repo, { chapter: withFigure({ category: 'training_status', as_of: '2026-03-15', text: 'Productive', source: 'stored', ref: { manual: { kind: 'race_predictions', as_of: '2026-03-15' } }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].ref.manual.kind', 'must be training_status for a training_status figure')]);
    writeStory(repo, { chapter: withFigure({ category: 'race_time', as_of: '2026-03-21', text: '25:00', source: 'stored', ref: { race: 'ipsum-5k' } }) });
    expect(errors()).toEqual([
      at(A, ENTRY, 'figures[0].ref.race', 'names no stored record (a published run, a published health point of that metric and date, a manual-metrics.yaml entry of that kind and date, or a race.yaml with an official time)'),
    ]);
  });

  it('refuses a missing and a mismatched garmin on a stored figure', () => {
    setUp();
    storedData();
    writeStory(repo, { chapter: withFigure({ category: 'vo2_max', as_of: '2026-03-15', text: '53', source: 'stored', ref: { health: { metric: 'vo2max', date: '2026-03-15' } } }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].garmin', 'is required: its record is Garmin data (expected Garmin)')]);
    writeStory(repo, { chapter: withFigure({ category: 'run_distance', as_of: '2026-03-15', text: '5 km', source: 'stored', ref: { run: '2026-03-15-abcd' }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].garmin', "doesn't match its record (expected Venu X1)")]);
    writeStory(repo, { chapter: withFigure({ category: 'weight', as_of: '2026-03-15', text: '79 kg', source: 'stored', ref: { health: { metric: 'weight_avg7', date: '2026-03-15' } }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].garmin', "doesn't match its record (expected Index S2)")]);
    writeStory(repo, { chapter: withFigure({ category: 'race_time', as_of: '2026-03-20', text: '45:00', source: 'stored', ref: { race: 'lorem-10k' }, garmin: 'Garmin' }) });
    expect(errors()).toEqual([at(A, ENTRY, 'figures[0].garmin', "must be left out: a hand-entered race result isn't Garmin data")]);
  });
});

describe('journey validation: messages quote nothing (FR-035, SC-003)', () => {
  const SENTINEL = 'Quuxsentinel';
  const s = (seed: number, n: number) => `${lorem(seed, n)} ${SENTINEL}`;
  const sentinelChapter = (extra: Value = {}): Value =>
    chapter('chapter-a', {
      name: s(1, 2),
      prose: `${s(2, 6)} {{fig-a}} ${s(3, 3)}.\n\n${s(4, 4)} [${s(5, 1)}](/running/) ${s(6, 2)}.\n`,
      takeaway: `${s(7, 6)}.`,
      figures: [{ id: 'fig-a', category: 'training_status', label: s(8, 1), as_of: '2026-03', text: `Lorem ${SENTINEL}`, source: 'owner' }],
      photos: [{ file: 'lorem.jpg', description: `${s(20, 3)}.`, caption: `${s(21, 3)}.` }],
      ...extra,
    });
  const sentinelNote = (extra: Value = {}) => note({ text: `${s(9, 8)}.`, ...extra });
  const sentinelPage = (extra: Value = {}) => page({ title: s(10, 2), description: `${s(11, 6)}.`, share_text: s(12, 3), link_label: s(13, 2), ...extra });
  const sentinelClosing = (extra: Value = {}) => closing({ heading: s(14, 2), text: `${s(15, 5)}.\n\n${s(16, 4)}.\n`, ...extra });
  const LINK = `story_link: { href: /story/, label: ${SENTINEL} words }\n`;
  const photos = { 'lorem.jpg': PHOTO };

  function story(over: { chapter?: Value; note?: Value; page?: Value; closing?: Value } = {}) {
    setUp(LINK);
    writeApproved(repo, A, 'chapter', over.chapter ?? sentinelChapter(), photos);
    writeApproved(repo, NOTE, 'note', over.note ?? sentinelNote());
    writeApproved(repo, PAGE, 'page', over.page ?? sentinelPage());
    writeApproved(repo, CLOSING, 'closing', over.closing ?? sentinelClosing());
  }

  /** Every refused case, planted over files with the sentinel in every text field. */
  const cases: [string, () => void][] = [
    ['a story_link with the wrong href and a label that differs', () => story()],
    ['no approval', () => (story(), repo.write(A, yaml(sentinelChapter())))],
    ['a changed chapter', () => (story(), repo.write(A, yaml({ ...approve('chapter', sentinelChapter(), new Map(Object.entries(photos))), takeaway: `${SENTINEL}.` })))],
    ['a changed note', () => (story(), repo.write(NOTE, yaml({ ...approve('note', sentinelNote()), text: `${SENTINEL} changed.` })))],
    ['a swapped photo', () => (story(), writePhoto(repo, `${OWNER}/journey/chapters/chapter-a/lorem.jpg`, OTHER_PHOTO))],
    ['a missing photo', () => {
      story();
      const value = sentinelChapter({ photos: [{ file: 'gone.jpg', description: SENTINEL, caption: SENTINEL }] });
      repo.write(A, yaml(approve('chapter', value, new Map([['gone.jpg', PHOTO]]))));
    }],
    ['a two-line name', () => story({ chapter: sentinelChapter({ name: `${SENTINEL}\n${SENTINEL}` }) })],
    ['a long takeaway', () => story({ chapter: sentinelChapter({ takeaway: `${SENTINEL} `.repeat(40).trim() }) })],
    ['a figure text against its pattern', () => story({ chapter: sentinelChapter({ figures: [{ id: 'fig-a', category: 'weight', label: SENTINEL, as_of: '2026-03', text: `${SENTINEL} kg`, source: 'owner' }] }) })],
    ['a two-line caption', () => story({ chapter: sentinelChapter({ photos: [{ file: 'lorem.jpg', description: SENTINEL, caption: `${SENTINEL}\n${SENTINEL}` }] }) })],
    ['a share text with a digit', () => story({ page: sentinelPage({ share_text: `${SENTINEL} 1` }) })],
    ['a long title', () => story({ page: sentinelPage({ title: `${SENTINEL} `.repeat(10).trim() }) })],
    ['a two-paragraph note', () => story({ note: sentinelNote({ text: `${SENTINEL}.\n\n${SENTINEL}.\n` }) })],
    ['a blank closing text', () => story({ closing: sentinelClosing({ text: ' ' }) })],
    ['stray markup and an external link', () => story({ chapter: sentinelChapter({ prose: `${SENTINEL} {{fig-a}} <i>${SENTINEL}</i> {{${SENTINEL}}} [${SENTINEL}](https://example.org/${SENTINEL}) ${SENTINEL}](${SENTINEL}.\n` }) })],
    ['a lone figure first and an unknown placeholder', () => story({ chapter: sentinelChapter({ prose: `{{fig-a}}\n\n${SENTINEL} {{fig-x}}.\n` }) })],
    ['markup in the takeaway and the note', () => story({ chapter: sentinelChapter({ takeaway: `<b>${SENTINEL}</b>` }), note: sentinelNote({ text: `[${SENTINEL}](/running/)` }) })],
    ['a placeholder in the closing section', () => story({ closing: sentinelClosing({ text: `${SENTINEL} {{fig-a}}.` }) })],
    ['a future chapter', () => story({ chapter: sentinelChapter({ when: '2026-12' }) })],
    ['an id that differs from its folder', () => story({ chapter: sentinelChapter({ id: 'chapter-z' }) })],
    ['a provider-like number in the prose', () => story({ chapter: sentinelChapter({ prose: `${SENTINEL} 1234567890 {{fig-a}}.\n` }) })],
    ['no note and no page', () => (story(), repo.cleanup(), setUp(LINK), writeApproved(repo, A, 'chapter', sentinelChapter(), photos))],
  ];

  it('no validation message, store error or approve-story output contains the sentinel', { timeout: 120_000 }, async () => {
    const seen: string[] = [];
    let refused = 0;
    for (const [what, plantCase] of cases) {
      plantCase();
      const found = all();
      if (found.some((i) => i.severity === 'error')) refused++;
      else throw new Error(`${what} was not refused`);
      seen.push(...found.map(formatIssue));
      const store = await new JsonFileStore(repo.root).getOwner().then(() => '', (e: unknown) => String(e));
      seen.push(store);
      for (const target of ['chapter-a', 'note', 'page', 'closing']) {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        approveMain([`--journey=${target}`, '--date=2001-01-01'], repo.root);
        seen.push(...[...log.mock.calls, ...err.mock.calls].flat().map(String));
        log.mockRestore();
        err.mockRestore();
      }
      repo.cleanup();
    }
    expect(refused).toBe(cases.length);
    expect(seen.length).toBeGreaterThan(cases.length);
    expect(seen.filter((line) => line.includes(SENTINEL))).toEqual([]);
  });
});

it('parses the YAML the helpers write as the loader does (strings stay strings)', () => {
  const value = parse(yaml(chapter()), { version: '1.2', schema: 'core' }) as Value;
  expect(value.when).toBe('2026-03');
});
