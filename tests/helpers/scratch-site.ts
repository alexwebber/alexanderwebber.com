// A scratch copy of the site for the build-a-copy drills (tests/e2e/stale.spec.ts,
// tests/e2e/fundraising-none.spec.ts): the real code and data, which a drill then edits and builds.
//
// The copy lives under the test's output folder (test-results/, gitignored) inside the repo, so
// node_modules resolves by walking up, and Astro and Vite keep their caches beside the copy instead
// of sharing the repo's.
import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

export const REPO = resolve(import.meta.dirname, '../..');

/** Copies what a build needs into an empty `root`. */
export function copySite(root: string): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const dir of ['src', 'public', 'schemas', 'data/running']) cpSync(join(REPO, dir), join(root, dir), { recursive: true });
  for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json']) cpSync(join(REPO, file), join(root, file));
}

/** A deploy build of the copy: no test-only preview pages. */
export async function buildSite(root: string): Promise<void> {
  // Without the coding-agent markers, as playwright.config.ts does for preview, so Astro behaves as on CI.
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDECODE: '', AI_AGENT: '' };
  delete env.SHELL_PREVIEW;
  await promisify(execFile)(process.execPath, [join(REPO, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, env, maxBuffer: 64 * 1024 * 1024 });
}

/** Every built HTML file under `dir`, as paths relative to it. */
export function builtHtmlFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return builtHtmlFiles(dir, path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}
