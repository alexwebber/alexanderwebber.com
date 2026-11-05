// The process scripts' pure helpers (scripts/process/lib.ts): PR boxes, dated triggers, the
// private-term search and the dist/ comparison.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addedLines,
  checkboxes,
  diffTrees,
  dueTriggers,
  hashTree,
  maskTerm,
  parseTerms,
  parseTriggers,
  summarisePaths,
  termMatchers,
} from '../../scripts/process/lib.ts';

describe('checkboxes', () => {
  it('splits ticked and unticked boxes, outside code fences only', () => {
    const body = ['- [x] **One** done', '- [X] Two', '* [ ] Three, open', '```', '- [ ] in a fence', '```', 'Not a [ ] box'].join('\n');
    expect(checkboxes(body)).toEqual({ ticked: ['**One** done', 'Two'], unticked: ['Three, open'] });
  });

  it('reads CRLF bodies', () => {
    expect(checkboxes('- [ ] A\r\n- [x] B\r\n').unticked).toEqual(['A']);
  });
});

describe('triggers', () => {
  const yaml = ['- due: 2026-11-19', '  task: Later', '- due: 2026-11-05', '  task: >-', '    Today, folded', '    over lines', '- due: 2027-01-01', '  task: Far'].join('\n');

  it('parses dates as strings and folds tasks', () => {
    expect(parseTriggers(yaml)).toEqual([
      { due: '2026-11-19', task: 'Later' },
      { due: '2026-11-05', task: 'Today, folded over lines' },
      { due: '2027-01-01', task: 'Far' },
    ]);
  });

  it('lists what is due and what is coming, in date order', () => {
    const { due, soon } = dueTriggers(parseTriggers(yaml), '2026-11-05', 14);
    expect(due.map((t) => t.task)).toEqual(['Today, folded over lines']);
    expect(soon.map((t) => t.task)).toEqual(['Later']);
  });

  it('refuses a bad entry by number', () => {
    expect(() => parseTriggers('- due: 19 Nov\n  task: x')).toThrow('trigger 1: "due"');
    expect(() => parseTriggers('- due: 2026-11-19')).toThrow('trigger 1: "task"');
    expect(() => parseTriggers('due: 2026-11-19')).toThrow('must be a list');
  });

  it('accepts an empty file', () => {
    expect(parseTriggers('# nothing yet\n')).toEqual([]);
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-11-25', 14)).toBe('2026-12-09');
  });

  it('parses the repo file', () => {
    expect(parseTriggers(readFileSync('process/triggers.yaml', 'utf8')).length).toBeGreaterThan(0);
  });
});

describe('private terms', () => {
  it('skips blanks and comments', () => {
    expect(parseTerms('# names\nAnn\n\n  Two Words  \r\n')).toEqual(['Ann', 'Two Words']);
  });

  it('matches whole words, case-insensitively, with regex characters taken literally', () => {
    const [ann, dotted] = termMatchers(['Ann', 'a.b']);
    expect(ann!.test('ask ann today')).toBe(true);
    expect(ann!.test('ANN.')).toBe(true);
    expect(ann!.test('Annual')).toBe(false);
    expect(ann!.test('Joann')).toBe(false);
    expect(dotted!.test('axb')).toBe(false);
    expect(dotted!.test('see a.b')).toBe(true);
  });

  it('masks all but the first letter', () => {
    expect(maskTerm('Secret')).toBe('S*****');
  });
});

describe('addedLines', () => {
  it('numbers added lines in the new file, across hunks and files', () => {
    const diff = [
      'diff --git a/x.md b/x.md',
      '--- a/x.md',
      '+++ b/x.md',
      '@@ -1,0 +2,2 @@',
      '+two',
      '+three',
      '@@ -9 +10 @@',
      '-old',
      '+ten',
      'diff --git a/new.txt b/new.txt',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1 @@',
      '+first',
    ].join('\n');
    expect(addedLines(diff)).toEqual([
      { file: 'x.md', line: 2, text: 'two' },
      { file: 'x.md', line: 3, text: 'three' },
      { file: 'x.md', line: 10, text: 'ten' },
      { file: 'new.txt', line: 1, text: 'first' },
    ]);
  });
});

describe('dist comparison', () => {
  it('hashes a tree and reports added, removed and changed files', () => {
    const root = mkdtempSync(join(tmpdir(), 'process-lib-'));
    try {
      for (const [dir, files] of [
        ['a', { 'same.html': 'x', 'changed.css': '1', 'gone.js': 'g' }],
        ['b', { 'same.html': 'x', 'changed.css': '2', 'sub/new.png': 'n' }],
      ] as const) {
        for (const [path, text] of Object.entries(files)) {
          mkdirSync(join(root, dir, path, '..'), { recursive: true });
          writeFileSync(join(root, dir, path), text);
        }
      }
      expect(diffTrees(hashTree(join(root, 'a')), hashTree(join(root, 'b')))).toEqual({
        added: ['sub/new.png'],
        removed: ['gone.js'],
        changed: ['changed.css'],
        same: 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists up to the limit, then counts by extension', () => {
    expect(summarisePaths(['a.html', 'b.html', 'c.css'], 3)).toEqual(['a.html', 'b.html', 'c.css']);
    expect(summarisePaths(['a.html', 'b.html', 'c.css'], 1)).toEqual(['a.html', '... and 2 more (all: 2 .html, 1 .css)']);
  });
});
