// Playwright's global setup: stop before any page test runs against a dist/ that can't show the
// change under test. The page tests serve dist/ through `astro preview` (playwright.config.ts), which
// doesn't build, so a stale build or a deploy build (no previews) passes or fails for the wrong
// reason. This happened in two sessions running (2026-11-07); a run then cost minutes before the
// cause showed. CI builds with SHELL_PREVIEW=1 right before the tests (tests.yml), so it always passes.
//
// Checks: dist/ holds the previews (SHELL_PREVIEW=1 adds /shell-preview/), and no file under src/ or
// data/, nor astro.config.mjs, is newer than the build. PW_SKIP_DIST_CHECK=1 skips both, for a run
// that only uses its own scratch build.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');
const REBUILD = 'rebuild with SHELL_PREVIEW=1 npm run build (PowerShell: $env:SHELL_PREVIEW=\'1\'; npm run build)';

/** The newest file under the given paths, by modification time. */
export function newestSource(paths: string[]): { file: string; mtimeMs: number } | undefined {
  let newest: { file: string; mtimeMs: number } | undefined;
  const visit = (path: string) => {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) visit(join(path, entry));
    } else if (!newest || stat.mtimeMs > newest.mtimeMs) {
      newest = { file: path, mtimeMs: stat.mtimeMs };
    }
  };
  for (const path of paths) visit(path);
  return newest;
}

/** Why dist/ under `root` can't serve the page tests, or undefined when it can. */
export function distProblem(root: string): string | undefined {
  const built = join(root, 'dist', 'index.html');
  if (!existsSync(built)) return `dist/ has no build: ${REBUILD}`;
  if (!existsSync(join(root, 'dist', 'shell-preview', 'index.html'))) {
    return `dist/ is a deploy build, without the test-only previews: ${REBUILD}`;
  }
  const source = newestSource(['src', 'data', 'astro.config.mjs'].map((p) => join(root, p)));
  if (source && source.mtimeMs > statSync(built).mtimeMs) {
    return `dist/ is older than ${relative(root, source.file).replaceAll('\\', '/')}: ${REBUILD}`;
  }
  return undefined;
}

export default function globalSetup() {
  if (process.env.PW_SKIP_DIST_CHECK === '1') return;
  const problem = distProblem(REPO);
  if (problem) throw new Error(`${problem}\n(PW_SKIP_DIST_CHECK=1 skips this check for a run that uses only its own scratch build.)`);
}
