// tests/global-setup.ts: Playwright stops before page tests run against a dist/ that can't show the
// change under test (a missing, deploy or stale build), and runs on a fresh preview build.
import { utimesSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { distProblem } from '../global-setup.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

const HOUR = 3600;
let repo: TempRepo;

afterEach(() => repo?.cleanup());

/** Sets a file's modification time to `seconds` after a fixed moment. */
function age(path: string, seconds: number) {
  const at = 1_800_000_000 + seconds;
  utimesSync(join(repo.root, path), at, at);
}

function previewBuild() {
  repo = tempRepo();
  repo.write('src/pages/index.astro', 'page');
  repo.write('data/running/owner/section.yaml', 'a: 1');
  repo.write('astro.config.mjs', 'config');
  repo.write('dist/index.html', 'built');
  repo.write('dist/shell-preview/index.html', 'preview');
  for (const file of ['src/pages/index.astro', 'data/running/owner/section.yaml', 'astro.config.mjs']) age(file, 0);
  age('dist/index.html', HOUR);
}

describe('distProblem', () => {
  it('accepts a preview build newer than every source file', () => {
    previewBuild();
    expect(distProblem(repo.root)).toBeUndefined();
  });

  it('stops when there is no build', () => {
    repo = tempRepo();
    expect(distProblem(repo.root)).toMatch(/^dist\/ has no build: rebuild with SHELL_PREVIEW=1/);
  });

  it('stops on a deploy build, which has no previews', () => {
    repo = tempRepo();
    repo.write('dist/index.html', 'built');
    expect(distProblem(repo.root)).toMatch(/^dist\/ is a deploy build, without the test-only previews/);
  });

  for (const file of ['src/pages/index.astro', 'data/running/owner/section.yaml', 'astro.config.mjs']) {
    it(`stops when ${file} changed after the build, naming it`, () => {
      previewBuild();
      age(file, 2 * HOUR);
      expect(distProblem(repo.root)).toBe(
        `dist/ is older than ${file}: rebuild with SHELL_PREVIEW=1 npm run build (PowerShell: $env:SHELL_PREVIEW='1'; npm run build)`,
      );
    });
  }
});
