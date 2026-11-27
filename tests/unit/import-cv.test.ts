// scripts/import-cv.ts over made-up exports (spec 004, T031; contracts/content-files.md): typical
// imports and loads with every hash matching, --dry-run writes nothing, each refusal planted alone
// exits non-zero naming file, kind, id and reason and leaves data/cv/ untouched, a newer PDF replaces
// the old at the same name, and the output is counts and file names only.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importCv } from '../../scripts/import-cv.ts';
import { CvStore, type CvExport } from '../../src/sections/cv/data/store/index.ts';
import { minimalPdf, smallExport, smallPdfs, writeExport } from '../helpers/cv.ts';
import { REPO_ROOT, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
let exportsDir: string;
beforeEach(() => {
  repo = tempRepo();
  exportsDir = mkdtempSync(join(tmpdir(), 'aw-cv-export-'));
});
afterEach(() => {
  repo.cleanup();
  rmSync(exportsDir, { recursive: true, force: true });
});

const RULES = '2026-12-01';
const typical = join(REPO_ROOT, 'tests/fixtures/cv-export/typical/export.json');
const run = (from: string, extra: { dryRun?: boolean; rulesChecked?: string } = {}) => importCv({ from, rulesChecked: extra.rulesChecked ?? RULES, dryRun: extra.dryRun, root: repo.root });
/** The files under data/cv/ with their bytes, to show a refused import changed nothing. */
function snapshot(): Map<string, string> {
  const dir = join(repo.root, 'data/cv');
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const path = join(dir, f);
    try {
      out.set(f, readFileSync(path, 'base64'));
    } catch {
      // a folder
    }
  }
  return out;
}

describe('importCv', () => {
  it('imports typical, and the store loads it with every hash matching', () => {
    const result = run(typical);
    expect(result.ok).toBe(true);
    expect(result.lines[0]).toBe('import-cv: page 1, blocks 6, themes 5, threads 5, roles 8, changes 50, next items 3, downloads 2');
    expect(result.lines.slice(1)).toEqual([
      'wrote data/cv/page.yaml',
      'wrote data/cv/blocks.yaml',
      'wrote data/cv/timeline.yaml',
      'wrote data/cv/downloads.yaml',
      'wrote data/cv/downloads/alexander-webber-cv.pdf',
      'wrote data/cv/downloads/alexander-webber-cv-visual.pdf',
    ]);
    const data = new CvStore(repo.root).load()!;
    expect(data.timeline.changes).toHaveLength(50);
    expect(data.page.sharing_rules_confirmed).toBe('2026-11-30');
    expect(data.downloads).toHaveLength(2);
  });

  it('writes nothing on --dry-run', () => {
    const result = run(typical, { dryRun: true });
    expect(result).toEqual({ ok: true, lines: ['import-cv: dry run, nothing written: page 1, blocks 6, themes 5, threads 5, roles 8, changes 50, next items 3, downloads 2'] });
    expect(existsSync(join(repo.root, 'data/cv'))).toBe(false);
  });

  const cases: [string, (e: CvExport) => void, string, string?][] = [
    ['no approved_on on the page', (e) => delete (e.page as { approved_on?: string }).approved_on, 'data/cv/page.yaml: page: has no approval'],
    ['no approved_on on a block', (e) => delete (e.blocks[1] as { approved_on?: string }).approved_on, 'data/cv/blocks.yaml: block value: has no approval'],
    ['no approved_on on a theme', (e) => delete (e.timeline.themes[1] as { approved_on?: string }).approved_on, 'data/cv/timeline.yaml: theme theme-b: has no approval'],
    ['no approved_on on a thread', (e) => delete (e.timeline.threads[0] as { approved_on?: string }).approved_on, 'data/cv/timeline.yaml: thread thread-a: has no approval'],
    ['no approved_on on a role', (e) => delete (e.timeline.roles[0] as { approved_on?: string }).approved_on, 'data/cv/timeline.yaml: role role-a: has no approval'],
    ['no approved_on on a change', (e) => delete (e.timeline.changes[2] as { approved_on?: string }).approved_on, 'data/cv/timeline.yaml: change change-c: has no approval'],
    ['no approved_on on a next item', (e) => delete (e.timeline.next[0] as { approved_on?: string }).approved_on, 'data/cv/timeline.yaml: next item next-a: has no approval'],
    ['no approved_on on a download', (e) => delete (e.downloads[0] as { approved_on?: string }).approved_on, 'data/cv/downloads.yaml: download plain: has no approval'],
    ['a phone number', (e) => (e.timeline.next[0]!.card += ' Ring 020 7946 0018.'), 'data/cv/timeline.yaml: next item next-a: card: has a phone number'],
    ['an over-budget label', (e) => (e.timeline.changes[0]!.label = 'L'.repeat(73)), 'data/cv/timeline.yaml: change change-a: label: label is 73 characters (budget 72)'],
    ['a dangling reference', (e) => (e.timeline.changes[1]!.theme = 'theme-z'), 'data/cv/timeline.yaml: change change-b: theme: names no theme in the file'],
    ['a one-change thread', (e) => delete e.timeline.changes[0]!.thread, 'data/cv/timeline.yaml: thread thread-a: thread has 1 change (needs 2)'],
    ['a change without a card', (e) => delete (e.timeline.changes[0] as { card?: string }).card, 'data/cv/timeline.yaml: change change-a: has no card'],
    ['a role without a card', (e) => delete (e.timeline.roles[0] as { card?: string }).card, 'data/cv/timeline.yaml: role role-a: has no card'],
    ['a month outside as_of', (e) => (e.timeline.changes[2]!.when = '2025 Oct'), 'data/cv/timeline.yaml: change change-c: when: uses months outside the as_of year'],
    ['no sharing_rules_confirmed', (e) => delete (e.page as { sharing_rules_confirmed?: string }).sharing_rules_confirmed, 'data/cv/page.yaml: page: sharing_rules_confirmed: is missing: the export must carry the day the owner last re-confirmed the sharing rules (FR-023)'],
    ['--rules-checked a day early', () => {}, 'data/cv/page.yaml: page: sharing_rules_confirmed: is later than --rules-checked: check the sharing rules with the owner again (FR-023)', '2026-11-29'],
    ['a ninth theme', (e) => (e.timeline.themes = Array.from({ length: 9 }, (_, i) => ({ ...e.timeline.themes[0]!, id: i === 0 ? 'theme-a' : i === 1 ? 'theme-b' : `theme-${i}` }))), 'data/cv/timeline.yaml: themes: must list one to eight themes'],
    ['a PDF that isn\'t there', (e) => (e.downloads[1]!.path = 'pdfs/missing.pdf'), "data/cv/downloads.yaml: download visual: path: isn't a file beside the export"],
    ['a PDF outside the export\'s folder', (e) => (e.downloads[1]!.path = '../alexander-webber-cv.pdf'), "data/cv/downloads.yaml: download visual: path: isn't a file beside the export"],
  ];
  for (const [name, plant, expected, rulesChecked] of cases) {
    it(`refuses ${name}, naming it, and leaves data/cv/ untouched`, () => {
      expect(run(typical).ok).toBe(true);
      const before = snapshot();
      const exp = smallExport();
      plant(exp);
      const from = writeExport(exportsDir, exp, smallPdfs());
      const result = run(from, { rulesChecked });
      expect(result).toEqual({ ok: false, lines: [expected] });
      expect(snapshot()).toEqual(before);
    });
  }

  it('replaces a PDF with a newer version at the same name, and removes one no longer exported', () => {
    const exp = smallExport();
    const first = writeExport(join(exportsDir, 'one'), exp, smallPdfs());
    expect(run(first).ok).toBe(true);
    const newer = minimalPdf({ text: 'A newer made-up plain CV' });
    const second = smallExport();
    second.downloads = second.downloads.slice(0, 1);
    const from = writeExport(join(exportsDir, 'two'), second, { 'pdfs/alexander-webber-cv.pdf': newer });
    const result = run(from);
    expect(result.ok).toBe(true);
    expect(result.lines).toContain('wrote data/cv/downloads/alexander-webber-cv-visual.pdf (removed: no longer in the export)');
    expect(new Uint8Array(readFileSync(join(repo.root, 'data/cv/downloads/alexander-webber-cv.pdf')))).toEqual(newer);
    expect(new CvStore(repo.root).load()!.downloads.map((d) => d.kind)).toEqual(['plain']);
  });

  it('prints counts and file names only, never text', () => {
    const lines = run(typical).lines.join('\n');
    const exp = JSON.parse(readFileSync(typical, 'utf8')) as CvExport;
    for (const text of [exp.page.headline, exp.blocks[0]!.paragraphs[0], exp.timeline.changes[0]!.card, exp.timeline.changes[0]!.label]) expect(lines).not.toContain(text);
  });

  it('imports every preview state', () => {
    for (const state of ['typical', 'stress', 'minimal', 'unlisted-off']) {
      const root = mkdtempSync(join(tmpdir(), `aw-cv-${state}-`));
      try {
        cpSync(join(REPO_ROOT, 'tests/fixtures/cv-export', state), join(root, 'in'), { recursive: true });
        const result = importCv({ from: join(root, 'in/export.json'), rulesChecked: RULES, root });
        expect(result.ok, `${state}: ${result.lines.join('; ')}`).toBe(true);
        expect(new CvStore(root, REPO_ROOT).load()).toBeDefined();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });
});
