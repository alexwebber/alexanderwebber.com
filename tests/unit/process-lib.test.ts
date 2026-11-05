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
  parseCandidates,
  parseTerms,
  parseTriggers,
  playwrightCounts,
  suitesFor,
  summarisePaths,
  tail,
  termMatchers,
} from '../../scripts/process/lib.ts';

describe('skill candidates', () => {
  it('parses entries, with next optional', () => {
    const yaml = ['- task: A card', '  times: 6', '  home: project', '  next: 003 Phase 3', '- task: A review', '  times: 1', '  home: playbook'].join('\n');
    expect(parseCandidates(yaml)).toEqual([
      { task: 'A card', times: 6, home: 'project', next: '003 Phase 3' },
      { task: 'A review', times: 1, home: 'playbook' },
    ]);
  });

  it('refuses a bad entry by number', () => {
    expect(() => parseCandidates('- times: 2\n  home: project')).toThrow('candidate 1: "task"');
    expect(() => parseCandidates('- task: x\n  times: 0\n  home: project')).toThrow('candidate 1: "times"');
    expect(() => parseCandidates('- task: x\n  times: 2\n  home: elsewhere')).toThrow('candidate 1: "home"');
    expect(() => parseCandidates('task: x')).toThrow('must be a list');
  });

  it('parses the repo file', () => {
    expect(parseCandidates(readFileSync('process/skill-candidates.yaml', 'utf8')).length).toBeGreaterThan(0);
  });
});

describe('suitesFor', () => {
  it('runs nothing for docs and process notes', () => {
    expect(suitesFor(['DECISIONS.md', 'PROJECT_MEMORY.md', 'specs/003-journey-story/tasks.md', '.claude/skills/x/SKILL.md'])).toEqual([]);
  });

  it('runs everything but pytest for a page change', () => {
    expect(suitesFor(['src/sections/running/pages/index.astro'])).toEqual(['unit', 'astro-check', 'e2e', 'gate']);
  });

  it('adds pytest when a schema changes', () => {
    expect(suitesFor(['schemas/owner/goals.schema.json'])).toEqual(['unit', 'astro-check', 'pytest', 'e2e', 'gate']);
  });

  it('runs unit tests and astro check, not e2e, for a process script', () => {
    expect(suitesFor(['scripts/process/lib.ts'])).toEqual(['unit', 'astro-check', 'gate']);
    expect(suitesFor(['tests/unit/format.test.ts'])).toEqual(['unit', 'astro-check']);
  });

  it('runs unit tests for a workflow and the gate for its action', () => {
    expect(suitesFor(['.github/workflows/refresh.yml'])).toEqual(['unit']);
    expect(suitesFor(['.github/actions/gate/action.yml'])).toEqual(['unit', 'gate']);
  });

  it('runs every suite for a dependency bump', () => {
    expect(suitesFor(['package.json', 'package-lock.json'])).toEqual(['unit', 'astro-check', 'e2e', 'gate']);
  });
});

describe('tail', () => {
  it('keeps the last non-blank lines', () => {
    expect(tail('a\n\nb\r\nc\n\n', 2)).toEqual(['b', 'c']);
  });
});

describe('playwrightCounts', () => {
  it('counts each project through nested suites, flaky as passed', () => {
    const test = (projectName: string, status: string) => ({ projectName, status });
    const report = {
      suites: [
        { specs: [{ tests: [test('desktop', 'expected'), test('mobile-360', 'skipped')] }] },
        {
          suites: [
            { specs: [{ tests: [test('desktop', 'unexpected'), test('mobile-360', 'expected')] }, { tests: [test('mobile-360', 'flaky')] }] },
          ],
        },
      ],
    };
    expect(playwrightCounts(report)).toEqual([
      'desktop: 1 passed, 1 failed, 0 skipped',
      'mobile-360: 2 passed, 0 failed, 1 skipped (1 flaky)',
    ]);
  });

  it('gives nothing for an empty report', () => {
    expect(playwrightCounts({})).toEqual([]);
  });
});

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
