// A scratch copy of the site for the build-a-copy drills (tests/e2e/stale.spec.ts,
// tests/e2e/fundraising-none.spec.ts, the gate-drill skill): the real code and data, which a drill
// then edits, builds and runs the gate's checks on.
//
// The copy lives under the test's output folder (test-results/, gitignored) inside the repo, or
// under spikes/<x>/out/ for a one-off drill, so node_modules resolves by walking up, and Astro and
// Vite keep their caches beside the copy instead of sharing the repo's.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { checkBoundaries } from '../../scripts/check-boundaries.ts';
import { checkLinks } from '../../scripts/check-links.ts';
import { scanImages } from '../../scripts/scan-images.ts';
import { scanPrivacy } from '../../scripts/scan-privacy.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import type { TempRepo } from './temp-repo.ts';

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

const ANSI = /\x1b\[[0-9;]*m/g;

/** A deploy build's output if it fails (colour codes removed), or undefined if it builds. */
async function tryBuild(root: string): Promise<string | undefined> {
  try {
    await buildSite(root);
    return undefined;
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    return `${stdout}\n${stderr}`.replace(ANSI, '');
  }
}

/** The output of a build that must fail (colour codes removed); throws if it builds. */
export async function buildFailure(root: string): Promise<string> {
  const output = await tryBuild(root);
  if (output === undefined) throw new Error(`the build of ${root} was expected to fail, and it passed`);
  return output;
}

/** The copy as a TempRepo, so the writers in tests/helpers (journey.ts's writeStory and
 * writeApproved, for one) plant files in it. cleanup() removes the copy. */
export function scratchRepo(root: string): TempRepo {
  return {
    root,
    write(path, content) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Every file under `dir` with its sha256, keyed by its path relative to `dir`: compare two to show
 * a failed build left the previous dist/ intact. Empty if `dir` doesn't exist. */
export function snapshotDist(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    out[relative(dir, path).replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return out;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

export interface DistServer {
  /** e.g. http://127.0.0.1:52341, for page.goto(`${base}/running/`). */
  base: string;
  close(): Promise<void>;
}

/**
 * Serves a copy's built dist/ for a browser, as Cloudflare's static assets do: "/a/" serves
 * "/a/index.html", and anything else answers 404 with the site's 404 page. Files are indexed when it
 * starts (build first), so no request reaches the file system with a path of its own (CodeQL
 * js/path-injection). There's no Worker, so /running/api/* is a 404 unless a test routes it.
 */
export async function serveDist(dist: string): Promise<DistServer> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const url = `/${relative(dist, path).replaceAll('\\', '/')}`;
    files.set(url, path);
    if (url.endsWith('/index.html')) files.set(url.slice(0, -'index.html'.length), path);
  }
  const fileFor = (url: string): string | undefined => {
    try {
      return files.get(decodeURIComponent(new URL(url, 'http://x').pathname));
    } catch {
      return undefined; // a malformed escape
    }
  };
  const server = createServer((request, response) => {
    const file = fileFor(request.url ?? '/');
    const body = file ?? files.get('/404.html');
    response.writeHead(file ? 200 : 404, { 'content-type': TYPES[extname(body ?? '.txt')] ?? 'application/octet-stream' });
    response.end(body ? readFileSync(body) : 'Not found');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

/** The gate's steps that runGate runs, in the gate's order (.github/actions/gate/action.yml). */
export const GATE_STEPS = ['validate-data', 'scan-images', 'check-boundaries', 'build', 'check-links', 'scan-privacy'] as const;
export type GateStep = (typeof GATE_STEPS)[number];

export interface GateRun {
  /** The steps that ran, in order; the last is the one that failed, if any. */
  ran: GateStep[];
  /** The first step that failed, where the gate stops; undefined when every step that ran passed. */
  failed?: GateStep;
  /** The failed step's messages as its command line prints them, without `error: `. A failed build
   * gives its whole output (colour codes removed) as one message. */
  messages: string[];
  /** validate-data's warnings, which don't fail the gate. */
  warnings: string[];
}

/**
 * The gate's checks on a scratch copy, in the gate's order, stopping at the first that fails as the
 * gate does, so a drill sees which step stops a fault and what it says. With `build: false` it stops
 * after check-boundaries (seconds, not minutes). Not run: npm ci, gen-types and astro check (the copy
 * shares the repo's node_modules and generated types), and the R2 run-ID map, which only CI has, so
 * scan-privacy runs without provider IDs.
 */
export async function runGate(root: string, options: { build?: boolean; today?: string } = {}): Promise<GateRun> {
  const run: GateRun = { ran: [], messages: [], warnings: [] };
  const step = (name: GateStep, messages: string[]): boolean => {
    run.ran.push(name);
    if (messages.length === 0) return true;
    run.failed = name;
    run.messages = messages;
    return false;
  };

  const issues = validateData(root, { today: options.today });
  run.warnings = issues.filter((i) => i.severity === 'warning').map(formatIssue);
  if (!step('validate-data', issues.filter((i) => i.severity === 'error').map(formatIssue))) return run;
  if (!step('scan-images', (await scanImages(root)).map((f) => `${f.file}: ${f.message}`))) return run;
  if (!step('check-boundaries', checkBoundaries(root).map((v) => `${v.file}: ${v.message}`))) return run;
  if (options.build === false) return run;

  const buildOutput = await tryBuild(root);
  if (!step('build', buildOutput === undefined ? [] : [buildOutput])) return run;
  if (!step('check-links', checkLinks(join(root, 'dist')).map((i) => `${i.file}: ${i.message}`))) return run;
  const privacy = await scanPrivacy(root);
  step('scan-privacy', privacy.map((f) => `${f.line > 0 ? `${f.file}:${f.line}:${f.column}` : f.file}: ${f.rule}: ${f.excerpt}`));
  return run;
}

/** Every built HTML file under `dir`, as paths relative to it. */
export function builtHtmlFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return builtHtmlFiles(dir, path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}
