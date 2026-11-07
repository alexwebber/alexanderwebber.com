// The scratch-copy drill helpers (tests/helpers/scratch-site.ts, the gate-drill skill), over a copy
// of the real code and data without building it: runGate's order and stopping, scratchRepo's writes,
// and snapshotDist. The build path (build, check-links, scan-privacy over dist/) is exercised by the
// drills that use it in tests/e2e/.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chapter, chapterFile, writeStory, yaml } from '../helpers/journey.ts';
import { copySite, GATE_STEPS, REPO, runGate, scratchRepo, snapshotDist } from '../helpers/scratch-site.ts';

let root: string;

beforeAll(() => {
  root = join(mkdtempSync(join(tmpdir(), 'aw-scratch-')), 'site');
  copySite(root);
});

afterAll(() => {
  if (root) rmSync(join(root, '..'), { recursive: true, force: true });
});

describe('runGate', () => {
  it('runs the gate action’s checks, in its order (all but gen-types, which the copy shares)', () => {
    const action = readFileSync(join(REPO, '.github/actions/gate/action.yml'), 'utf8');
    const steps = [...action.matchAll(/npm run ([\w-]+)/g)].map((m) => m[1]).filter((name) => name !== 'gen-types');
    expect(steps).toEqual([...GATE_STEPS]);
  });

  it('passes the real data and code, stopping before the build when asked', async () => {
    const run = await runGate(root, { build: false });
    expect(run.failed).toBeUndefined();
    expect(run.messages).toEqual([]);
    expect(run.ran).toEqual(['validate-data', 'scan-images', 'check-boundaries']);
  });

  it('stops at validate-data on a planted unapproved chapter, naming the file and the approval', async () => {
    // The copy holds the real story from spec 003's content PR on: keep it aside and put it back after,
    // so the steps after this one still see the real data.
    const journey = join(root, 'data/running/owner/journey');
    const kept = join(root, '..', 'journey-kept');
    if (existsSync(journey)) renameSync(journey, kept);
    const repo = scratchRepo(root);
    writeStory(repo);
    repo.write(chapterFile('chapter-a'), yaml(chapter()));
    try {
      const run = await runGate(root, { build: false });
      expect(run.failed).toBe('validate-data');
      expect(run.ran).toEqual(['validate-data']);
      expect(run.messages.join('\n')).toContain(chapterFile('chapter-a'));
      expect(run.messages.join('\n')).toContain('approval');
    } finally {
      rmSync(journey, { recursive: true, force: true });
      if (existsSync(kept)) renameSync(kept, journey);
    }
  });

  it('stops at check-boundaries on a planted cross-section import, after the data steps pass', async () => {
    const file = join(root, 'src/shared/drill-plant.ts');
    writeFileSync(file, "import '../sections/running/integration.ts';\n");
    try {
      const run = await runGate(root, { build: false });
      expect(run.ran).toEqual(['validate-data', 'scan-images', 'check-boundaries']);
      expect(run.failed).toBe('check-boundaries');
      expect(run.messages.join('\n')).toContain('src/shared/drill-plant.ts');
    } finally {
      rmSync(file, { force: true });
    }
  });
});

describe('snapshotDist', () => {
  it('is empty for a missing folder, and changes with a file’s bytes but not its timestamp', () => {
    const dist = join(root, 'snapshot-test');
    expect(snapshotDist(dist)).toEqual({});
    mkdirSync(join(dist, 'running'), { recursive: true });
    writeFileSync(join(dist, 'running', 'index.html'), 'a');
    const before = snapshotDist(dist);
    expect(Object.keys(before)).toEqual(['running/index.html']);
    writeFileSync(join(dist, 'running', 'index.html'), 'a');
    expect(snapshotDist(dist)).toEqual(before);
    writeFileSync(join(dist, 'running', 'index.html'), 'b');
    expect(snapshotDist(dist)).not.toEqual(before);
  });
});
