// validateCv over made-up data (spec 004, T030; quickstart.md §2's table; contracts/gate.md): each
// refused case planted alone, with its file, kind, id, rule and severity; then the sentinel test: one
// made-up word in every text field of every file, every refused case run through validateCv,
// CvStore, importCv and compareCv, and the word in no message, warning or output line
// (contracts/content-files.md *Messages*; privacy-pipelines tips).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { compareCv, differenceLine } from '../../scripts/compare-cv.ts';
import { importCv } from '../../scripts/import-cv.ts';
import { CvStore, type CvExport } from '../../src/sections/cv/data/store/index.ts';
import { validateCv } from '../../src/sections/cv/validate.ts';
import { formatIssue, type DataIssue } from '../../src/shared/storage/index.ts';
import { minimalPdf, smallExport, smallPdfs, writeCv, writeExport } from '../helpers/cv.ts';
import { PREVIEW_STATES, previewRoot } from '../fixtures/cv-preview/store.ts';
import { REPO_ROOT, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
beforeEach(() => {
  repo = tempRepo();
});
afterEach(() => repo.cleanup());

type Plant = (exp: CvExport) => void;
/** The issues for smallExport() with one problem planted (in the export, written with real approvals). */
function issuesFor(plant: Plant, pdfs = smallPdfs()): DataIssue[] {
  const exp = smallExport();
  plant(exp);
  writeCv(repo.root, exp, pdfs);
  return validateCv(repo.root);
}
const error = (file: string, entry: string, field: string, message: string): DataIssue => ({ file, entry, field, message, severity: 'error' });
const T = 'data/cv/timeline.yaml';
const B = 'data/cv/blocks.yaml';
const P = 'data/cv/page.yaml';
const D = 'data/cv/downloads.yaml';
const PHONE = '07700 900123';

describe('validateCv', () => {
  it('reports nothing without data/cv/, and nothing for a good made-up CV', () => {
    expect(validateCv(repo.root)).toEqual([]);
    expect(issuesFor(() => {})).toEqual([]);
  });

  it('refuses an item with no approval', () => {
    const exp = smallExport();
    delete (exp.timeline.changes[0] as { approved_on?: string }).approved_on;
    writeCv(repo.root, exp);
    expect(validateCv(repo.root)).toEqual([error(T, 'change change-a', 'approved', 'has no approval')]);
  });

  it('refuses text edited after approval', () => {
    writeCv(repo.root, smallExport());
    const file = join(repo.root, T);
    const doc = parse(readFileSync(file, 'utf8'), { version: '1.2', schema: 'core' });
    doc.changes[2].card = 'A different made-up card.';
    writeFileSync(file, stringify(doc));
    expect(validateCv(repo.root)).toEqual([error(T, 'change change-c', '', "approval doesn't match")]);
  });

  it.each<[string, Plant, DataIssue]>([
    ['a card', (e) => (e.timeline.changes[0]!.card += ` ${PHONE}`), error(T, 'change change-a', 'card', 'has a phone number')],
    ['a block paragraph', (e) => (e.blocks[0]!.paragraphs[0] += ` ${PHONE}`), error(B, 'block pitch', 'paragraphs[0]', 'has a phone number')],
    ['a value story', (e) => (e.blocks[1]!.stories![0]!.text += ` ${PHONE}`), error(B, 'block value', 'stories[0].text', 'has a phone number')],
    ['a role label', (e) => (e.timeline.roles[0]!.label = `Role ${PHONE}`), error(T, 'role role-a', 'label', 'has a phone number')],
    ['the location', (e) => (e.page.location = `Somewhere ${PHONE}`), error(P, 'page', 'location', 'has a phone number')],
  ])('refuses a phone number in %s', (_, plant, expected) => {
    expect(issuesFor(plant)).toEqual([expected]);
  });

  it('refuses a change without a card', () => {
    expect(issuesFor((e) => delete (e.timeline.changes[1] as { card?: string }).card)).toEqual([error(T, 'change change-b', 'card', 'has no card')]);
  });

  it('refuses a thread with one change', () => {
    expect(issuesFor((e) => delete e.timeline.changes[1]!.thread)).toEqual([error(T, 'thread thread-a', '', 'thread has 1 change (needs 2)')]);
  });

  it('refuses a card of 281 characters, and takes one of 280', () => {
    expect(issuesFor((e) => (e.timeline.changes[0]!.card = `${'x'.repeat(279)}.`))).toEqual([]);
    expect(issuesFor((e) => (e.timeline.changes[0]!.card = `${'x'.repeat(280)}.`))).toEqual([error(T, 'change change-a', 'card', 'card is 281 characters (budget 280)')]);
  });

  it('refuses a page title of 61 characters', () => {
    expect(issuesFor((e) => (e.page.title = 'T'.repeat(61)))).toEqual([error(P, 'page', 'title', 'title is 61 characters (budget 60)')]);
  });

  it('refuses a PDF changed after approval', () => {
    writeCv(repo.root, smallExport());
    writeFileSync(join(repo.root, 'data/cv/downloads/alexander-webber-cv-visual.pdf'), minimalPdf({ text: 'Another made-up CV' }));
    expect(validateCv(repo.root)).toEqual([error(D, 'download visual', '', "approval doesn't match")]);
  });

  it.each<[string, Plant, DataIssue]>([
    ['theme', (e) => (e.timeline.changes[2]!.theme = 'theme-z'), error(T, 'change change-c', 'theme', 'names no theme in the file')],
    ['thread', (e) => (e.timeline.changes[2]!.thread = 'thread-z'), error(T, 'change change-c', 'thread', 'names no thread in the file')],
    ['value story', (e) => (e.timeline.changes[2]!.value = 'story-z'), error(T, 'change change-c', 'value', 'names no value story in blocks.yaml')],
  ])('refuses a dangling %s', (_, plant, expected) => {
    expect(issuesFor(plant)).toEqual([expected]);
  });

  it('refuses two pitch blocks, and none', () => {
    expect(issuesFor((e) => e.blocks.push({ ...e.blocks[0]!, id: 'pitch-b' }))).toEqual([error(B, '', '', 'has 2 pitch blocks (needs exactly 1)')]);
    expect(issuesFor((e) => (e.blocks[0]!.kind = 'other'))).toEqual([error(B, '', '', 'has 0 pitch blocks (needs exactly 1)')]);
  });

  it('refuses a duplicate change id', () => {
    expect(issuesFor((e) => (e.timeline.changes[2]!.id = 'change-b'))).toEqual([error(T, 'change change-b', 'id', 'is used by another change')]);
  });

  it('refuses a month outside the as_of year', () => {
    expect(issuesFor((e) => (e.timeline.changes[2]!.when = '2025 Oct'))).toEqual([error(T, 'change change-c', 'when', 'uses months outside the as_of year')]);
  });

  it('refuses two plain downloads', () => {
    const pdfs = smallPdfs();
    const issues = issuesFor((e) => (e.downloads = [e.downloads[0]!, { ...e.downloads[0]! }]), pdfs);
    expect(issues).toEqual([error(D, 'download plain', '', 'lists 2 plain downloads (at most 1)')]);
  });

  it('warns, and only warns, when a listed PDF is missing', () => {
    expect(issuesFor(() => {}, { 'pdfs/alexander-webber-cv.pdf': smallPdfs()['pdfs/alexander-webber-cv.pdf']! })).toEqual([
      { file: D, entry: 'download visual', field: 'file', message: "is listed but isn't in data/cv/downloads/: its download is hidden", severity: 'warning' },
    ]);
  });
});

describe('the sentinel: no message quotes CV text', () => {
  const SENTINEL = 'zqxsentinel';

  /** smallExport() with the sentinel in every text field of every file. */
  function sentinelExport(): CvExport {
    const exp = smallExport();
    const p = exp.page;
    for (const field of ['name', 'headline', 'location', 'title', 'description'] as const) p[field] = `${SENTINEL} ${p[field]}`.slice(0, 60);
    p.email_user = SENTINEL;
    p.email_domain = `${SENTINEL}.example`;
    p.linkedin = `https://www.linkedin.com/in/${SENTINEL}/`;
    for (const block of exp.blocks) {
      block.heading = `${SENTINEL} ${block.heading}`;
      block.paragraphs = block.paragraphs.map((t) => `${SENTINEL} ${t}`) as typeof block.paragraphs;
      for (const story of block.stories ?? []) Object.assign(story, { title: `${SENTINEL} ${story.title}`, text: `${SENTINEL} ${story.text}` });
    }
    const t = exp.timeline;
    for (const theme of t.themes) Object.assign(theme, { name: `${SENTINEL} ${theme.name}`, line: `${SENTINEL} ${theme.line}` });
    for (const thread of t.threads) Object.assign(thread, { name: `${SENTINEL} ${thread.name}`.slice(0, 40), line: `${SENTINEL} ${thread.line}` });
    for (const role of t.roles) Object.assign(role, { label: `${SENTINEL} ${role.label}`.slice(0, 48), card: `${SENTINEL} ${role.card}` });
    for (const change of t.changes) Object.assign(change, { label: `${SENTINEL} ${change.label}`, card: `${SENTINEL} ${change.card}` });
    for (const next of t.next) Object.assign(next, { title: `${SENTINEL} ${next.title}`, card: `${SENTINEL} ${next.card}` });
    for (const download of exp.downloads) download.title = `${SENTINEL} ${download.title}`;
    return exp;
  }

  const cases: [string, Plant][] = [
    ['nothing planted', () => {}],
    ['no approval', (e) => delete (e.timeline.changes[0] as { approved_on?: string }).approved_on],
    ['a phone number in a card', (e) => (e.timeline.changes[0]!.card += ` ${PHONE}`)],
    ['a phone number in a story', (e) => (e.blocks[1]!.stories![0]!.text += ` ${PHONE}`)],
    ['a change without a card', (e) => delete (e.timeline.changes[1] as { card?: string }).card],
    ['a one-change thread', (e) => delete e.timeline.changes[1]!.thread],
    ['a card over budget', (e) => (e.timeline.changes[0]!.card = `${SENTINEL} ${'x'.repeat(290)}`)],
    ['a title over budget', (e) => (e.page.title = `${SENTINEL} ${'x'.repeat(70)}`)],
    ['a dangling theme', (e) => (e.timeline.changes[2]!.theme = 'theme-z')],
    ['two pitch blocks', (e) => e.blocks.push({ ...e.blocks[0]!, id: 'pitch-b' })],
    ['a quote in a malformed value', (e) => (e.page.email_user = `"${SENTINEL}" x`)],
    ['a month outside as_of', (e) => (e.timeline.changes[2]!.when = '2025 Oct')],
    ['a malformed when', (e) => (e.timeline.changes[2]!.when = `2013-2016 ${SENTINEL}`)],
    ['a two-line card', (e) => (e.timeline.changes[2]!.card = `${SENTINEL}\n${SENTINEL}`)],
    ['an unknown key', (e) => Object.assign(e.timeline.changes[2]!, { note: SENTINEL })],
    ['a joined email address', (e) => (e.page.email_user = `${SENTINEL}@example.com`)],
  ];

  for (const [name, plant] of cases) {
    it(`${name}: validateCv, CvStore, importCv and compareCv never print it`, () => {
      const exp = sentinelExport();
      plant(exp);
      const out: string[] = [];

      writeCv(repo.root, exp);
      out.push(...validateCv(repo.root).map(formatIssue));
      try {
        new CvStore(repo.root).load();
      } catch (e) {
        out.push((e as Error).message);
      }
      // A hand edit after approval, too.
      const file = join(repo.root, T);
      writeFileSync(file, readFileSync(file, 'utf8').replace('Change C', `Change C ${SENTINEL}`));
      out.push(...validateCv(repo.root).map(formatIssue));

      const from = writeExport(join(repo.root, 'export'), exp, smallPdfs());
      out.push(...importCv({ from, rulesChecked: '2026-12-01', dryRun: true }).lines);
      out.push(...importCv({ from, rulesChecked: '2026-11-01', dryRun: true }).lines);

      const html = `<title>${SENTINEL} other</title><div data-cv-item="change:change-a"><p data-cv-field="card">${SENTINEL} other</p></div><div data-cv-item="change:change-x"></div>`;
      out.push(...compareCv(html, exp).map(differenceLine));

      expect(out.length).toBeGreaterThan(0);
      for (const text of out) expect(text).not.toContain(SENTINEL);
    });
  }
});

// T060: the previews (tests/fixtures/cv-preview/) pass validation and load, and generate.ts writes
// exactly the committed files.
describe('the CV previews', () => {
  it.each(PREVIEW_STATES)('%s passes validateCv and CvStore with no issue', (state) => {
    expect(validateCv(previewRoot(state), { schemaRoot: REPO_ROOT }).map(formatIssue)).toEqual([]);
    expect(new CvStore(previewRoot(state), REPO_ROOT).load()).toBeDefined();
  });

  it('generate.ts is deterministic: its output equals the committed files', () => {
    const before = snapshotTree(join(REPO_ROOT, 'tests/fixtures/cv-preview/data'));
    execFileSync(process.execPath, [join(REPO_ROOT, 'tests/fixtures/cv-preview/generate.ts')], { cwd: REPO_ROOT, stdio: 'pipe' });
    expect(snapshotTree(join(REPO_ROOT, 'tests/fixtures/cv-preview/data'))).toEqual(before);
    expect(Object.keys(before).length).toBeGreaterThan(10);
  }, 60_000);
});

/** Every file under `dir` by relative path, with its bytes' sha256 (line endings as on disk, normalised to \n). */
function snapshotTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        const bytes = readFileSync(path);
        const body = path.endsWith('.pdf') ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
        out[relative(dir, path).split(sep).join('/')] = createHash('sha256').update(body).digest('hex');
      }
    }
  };
  visit(dir);
  return out;
}
