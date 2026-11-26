// CvStore over made-up files (spec 004, T029; research.md R2, R3): no CV without page.yaml, a full
// set loads, and an unexpected file, a missing approval, an edit after approval in each kind and a
// PDF swapped under the same name are each refused naming file, kind and id.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { CvStore } from '../../src/sections/cv/data/store/index.ts';
import { DataValidationError, type DataIssue } from '../../src/shared/storage/index.ts';
import { minimalPdf, smallExport, writeCv } from '../helpers/cv.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
beforeEach(() => {
  repo = tempRepo();
});
afterEach(() => repo.cleanup());

const load = () => new CvStore(repo.root).load();
function refusal(): DataIssue[] {
  try {
    load();
  } catch (error) {
    expect(error).toBeInstanceOf(DataValidationError);
    return (error as DataValidationError).issues;
  }
  throw new Error('the store loaded');
}
const read = (file: string) => parse(readFileSync(join(repo.root, file), 'utf8'), { version: '1.2', schema: 'core' });
const write = (file: string, value: unknown) => writeFileSync(join(repo.root, file), stringify(value, { lineWidth: 0 }));

describe('CvStore', () => {
  it('has no CV without data/cv/, or without page.yaml whatever else is there', () => {
    expect(load()).toBeUndefined();
    writeCv(repo.root, smallExport());
    repo.write('data/cv/page.yaml', '');
    // An empty page.yaml is still a page.yaml: it fails, rather than meaning "no CV".
    expect(() => new CvStore(repo.root).load()).toThrow(DataValidationError);
  });

  it('has no CV when page.yaml is absent, even with the other files present', () => {
    writeCv(repo.root, smallExport());
    rmSync(join(repo.root, 'data/cv/page.yaml'));
    expect(load()).toBeUndefined();
  });

  it('loads a full made-up set', () => {
    writeCv(repo.root, smallExport());
    const data = load()!;
    expect(data.page.name).toBe('Ada Example');
    expect(data.blocks.map((b) => b.kind)).toEqual(['pitch', 'value']);
    expect(data.timeline.changes).toHaveLength(3);
    expect(data.downloads.map((d) => d.path)).toEqual(['data/cv/downloads/alexander-webber-cv.pdf', 'data/cv/downloads/alexander-webber-cv-visual.pdf']);
  });

  it('refuses an unexpected file', () => {
    writeCv(repo.root, smallExport());
    repo.write('data/cv/notes.txt', 'made up');
    expect(refusal()).toEqual([expect.objectContaining({ file: 'data/cv/notes.txt', message: expect.stringContaining('not an expected CV file') })]);
  });

  it('refuses a PDF that downloads.yaml does not list', () => {
    const exp = smallExport();
    exp.downloads = exp.downloads.slice(0, 1);
    writeCv(repo.root, exp);
    repo.write('data/cv/downloads/alexander-webber-cv-visual.pdf', 'made up');
    expect(refusal()).toEqual([expect.objectContaining({ file: 'data/cv/downloads/alexander-webber-cv-visual.pdf', message: 'is not listed in downloads.yaml' })]);
  });

  it('refuses a missing approval, naming the item', () => {
    writeCv(repo.root, smallExport());
    const timeline = read('data/cv/timeline.yaml');
    delete timeline.changes[1].approved;
    write('data/cv/timeline.yaml', timeline);
    expect(refusal()).toEqual([{ file: 'data/cv/timeline.yaml', entry: 'change change-b', field: 'approved', message: 'has no approval', severity: 'error' }]);
  });

  const edits: [string, string, (doc: any) => void, string][] = [
    ['page', 'data/cv/page.yaml', (d) => (d.headline += 'x'), 'page'],
    ['block', 'data/cv/blocks.yaml', (d) => (d.blocks[1].stories[0].text += 'x'), 'block value'],
    ['theme', 'data/cv/timeline.yaml', (d) => (d.themes[0].line += 'x'), 'theme theme-a'],
    ['thread', 'data/cv/timeline.yaml', (d) => (d.threads[0].name += 'x'), 'thread thread-a'],
    ['role', 'data/cv/timeline.yaml', (d) => (d.roles[0].card += 'x'), 'role role-a'],
    ['change', 'data/cv/timeline.yaml', (d) => (d.changes[0].card += 'x'), 'change change-a'],
    ['next item', 'data/cv/timeline.yaml', (d) => (d.next[0].title += 'x'), 'next item next-a'],
    ['download', 'data/cv/downloads.yaml', (d) => (d.downloads[0].title += 'x'), 'download plain'],
  ];
  for (const [kind, file, edit, entry] of edits) {
    it(`refuses a ${kind} edited after approval`, () => {
      writeCv(repo.root, smallExport());
      const doc = read(file);
      edit(doc);
      write(file, doc);
      expect(refusal()).toEqual([{ file, entry, field: '', message: "approval doesn't match", severity: 'error' }]);
    });
  }

  it('refuses a PDF swapped under the same name', () => {
    writeCv(repo.root, smallExport());
    writeFileSync(join(repo.root, 'data/cv/downloads/alexander-webber-cv.pdf'), minimalPdf({ text: 'A different made-up CV' }));
    expect(refusal()).toEqual([{ file: 'data/cv/downloads.yaml', entry: 'download plain', field: '', message: "approval doesn't match", severity: 'error' }]);
  });

  it('hides a listed PDF that is missing, with a warning only', () => {
    writeCv(repo.root, smallExport(), {});
    const data = load()!;
    expect(data.downloads).toEqual([]);
  });

  it('never quotes a value in a schema message', () => {
    writeCv(repo.root, smallExport());
    const timeline = read('data/cv/timeline.yaml');
    timeline.changes[0].when = '2013-2016 sentinelword';
    write('data/cv/timeline.yaml', timeline);
    const issues = refusal();
    expect(issues.map((i) => i.message).join('\n')).not.toContain('sentinelword');
    expect(issues).toContainEqual(expect.objectContaining({ entry: 'change change-a', field: 'when' }));
  });
});
