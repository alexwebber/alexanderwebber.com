// The SC-003 resilience drill (T145): intervals.icu access broken for 7 days. The drill copies the
// repo's real data into a scratch site whose refresh.json says the last successful fetch was 7
// days ago, then checks:
// - the gate still passes on it (validate-data, scan-images, check-boundaries, astro build,
//   scan-privacy), so no site update fails because the provider is down;
// - every built Running page carries its last-updated time and the stale notice in the HTML, so
//   it holds without JS;
// - in a browser, a failing freshness endpoint (the Worker's 503 when its record is missing)
//   keeps the build-time text and notice, the live value shows "7 days ago", and the notice goes
//   once a fresh value arrives.
// The GitHub issue that opens within 24 h is covered by ingest/tests/contract/test_alerts.py.
//
// The scratch site lives under this test's output folder (test-results/, gitignored) inside the
// repo, so node_modules resolves by walking up, and Astro and Vite keep their caches beside the
// copy instead of sharing the repo's. `astro check` isn't run: it type-checks code, which the
// stale data can't change, and the PR checks already run it.
import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { checkBoundaries } from '../../scripts/check-boundaries.ts';
import { scanImages } from '../../scripts/scan-images.ts';
import { scanPrivacy } from '../../scripts/scan-privacy.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { formatDateTime } from '../../src/shared/format/dates.ts';

const REPO = resolve(import.meta.dirname, '../..');
const DAY_MS = 86_400_000;
// Whole minutes, as refresh.json carries them; the page shows hours and minutes.
const staleAt = new Date(Math.floor((Date.now() - 7 * DAY_MS) / 60_000) * 60_000);
const staleIso = staleAt.toISOString().replace(/\.\d+Z$/, 'Z');
const buildTimeText = `Last updated ${formatDateTime(staleAt)}`;

let root: string;
let server: Server;
let baseUrl: string;
let gate: { dataErrors: string[]; images: number; boundaries: number; privacy: number };

/** Every built page under dist/running/, as site paths. */
function builtPages(dir = join(root, 'dist', 'running'), path = '/running/'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return builtPages(join(dir, entry.name), `${path}${entry.name}/`);
    return entry.name === 'index.html' ? [path] : [];
  });
}

const TYPES: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  // Playwright runs beforeAll once per project, and the drill checks built HTML and gate results,
  // which don't depend on the viewport, so it builds once.
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('stale-site');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const dir of ['src', 'public', 'schemas', 'data/running']) cpSync(join(REPO, dir), join(root, dir), { recursive: true });
  for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json']) cpSync(join(REPO, file), join(root, file));

  const refreshFile = join(root, 'data/running/published/state/refresh.json');
  const refresh = JSON.parse(readFileSync(refreshFile, 'utf8'));
  refresh.generated_at = staleIso;
  refresh.sources.intervals.last_success_at_build = staleIso;
  refresh.sources.intervals.last_data_change_at = staleIso;
  writeFileSync(refreshFile, JSON.stringify(refresh));

  const issues = validateData(root);
  // A deploy build: no test-only preview pages.
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDECODE: '', AI_AGENT: '' };
  delete env.SHELL_PREVIEW;
  await promisify(execFile)(process.execPath, [join(REPO, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, env, maxBuffer: 64 * 1024 * 1024 });
  gate = {
    dataErrors: issues.filter((i) => i.severity === 'error').map((i) => `${i.file}: ${i.message}`),
    images: (await scanImages(root)).length,
    boundaries: checkBoundaries(root).length,
    privacy: (await scanPrivacy(root)).length,
  };

  const dist = join(root, 'dist');
  server = createServer((request, response) => {
    let file = join(dist, decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname));
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const body = readFileSync(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      // No Worker here, so /running/api/freshness is a 404 unless a test routes it.
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  if (root) rmSync(root, { recursive: true, force: true });
});

test('SC-003: the gate passes on data that is 7 days stale', () => {
  expect(gate.dataErrors).toEqual([]);
  expect(gate.images).toBe(0);
  expect(gate.boundaries).toBe(0);
  expect(gate.privacy).toBe(0);
});

test('SC-003: every Running page is built with its last-updated time and the stale notice', () => {
  const pages = builtPages();
  expect(pages.length).toBeGreaterThan(5);
  for (const path of pages) {
    const html = readFileSync(join(root, 'dist', path, 'index.html'), 'utf8');
    expect(html, path).toContain(`data-success-ms="${staleAt.getTime()}"`);
    expect(html, path).toContain(buildTimeText);
    const notice = html.match(/<p[^>]*data-stale-notice[^>]*>/)?.[0];
    expect(notice, path).toBeDefined();
    expect(notice, path).not.toMatch(/\shidden(?=[\s=>])/);
  }
});

/** One page of each type that exists in the real data (no race pages until the first race). */
function pageTypes(): string[] {
  const pages = builtPages();
  const first = (prefix: string) => pages.find((p) => p.startsWith(prefix) && p !== prefix);
  return [
    '/running/',
    '/running/goals/',
    '/running/training/',
    first('/running/training/'),
    first('/running/runs/'),
    '/running/races/',
    first('/running/races/'),
    '/running/health/',
  ].filter((p): p is string => p !== undefined && pages.includes(p));
}

const notice = (page: Page) => page.locator('[data-stale-notice]');
const lastUpdated = (page: Page) => page.locator('[data-last-updated-text]');

test('SC-003: a failing freshness endpoint keeps the build-time text and notice on every page type', async ({ page }) => {
  await page.route('**/running/api/freshness', (route) => route.fulfill({ status: 503, headers: { 'cache-control': 'no-store' }, body: '' }));
  for (const path of pageTypes()) {
    const answered = page.waitForResponse('**/running/api/freshness');
    const response = await page.goto(baseUrl + path);
    expect(response?.status(), path).toBe(200);
    await answered;
    await expect(lastUpdated(page), path).toHaveText(buildTimeText);
    await expect(notice(page), path).toBeVisible();
    await expect(notice(page), path).toContainText('may be out of date');
  }
});

test('SC-003: without JS every page type still shows the build-time text and notice', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of pageTypes()) {
    await page.goto(baseUrl + path);
    await expect(lastUpdated(page), path).toHaveText(buildTimeText);
    await expect(notice(page), path).toBeVisible();
  }
  await context.close();
});

test('SC-003: the live value says 7 days ago, and the notice goes once a fresh value arrives', async ({ page }) => {
  let live = staleIso;
  await page.route('**/running/api/freshness', (route) => route.fulfill({ json: { intervals: { last_success_at: live }, generated_at: live } }));
  await page.goto(`${baseUrl}/running/`);
  await expect(lastUpdated(page)).toHaveText('Last updated 7 days ago');
  await expect(notice(page)).toBeVisible();

  live = new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
  await page.goto(`${baseUrl}/running/health/`);
  await expect(lastUpdated(page)).toHaveText('Last updated 1 hour ago');
  await expect(notice(page)).toBeHidden();
});
