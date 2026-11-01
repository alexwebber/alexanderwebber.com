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
// It also covers fundraising's SC-003 (T103; specs/002-fundraising/quickstart.md §7): JustGiving
// unreadable for 7 days. The scratch copy gets a campaign file for the focus race whose last read
// was 7 days ago, written whatever the real data holds, with made-up figures. On the landing and
// fundraising pages the figures, "Figures updated …", the fundraising notice and Donate are in the
// built HTML, stay with the fundraising route failing and with JS off, and each freshness only
// moves its own notice (FR-003, FR-004, FR-005). The 24-hour alert is a pytest case
// (ingest/tests/unit/test_fundraising.py), and the 12-hour threshold a Vitest one.
//
// The scratch site is tests/helpers/scratch-site.ts's copy. `astro check` isn't run: it type-checks code, which the
// stale data can't change, and the PR checks already run it.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { checkBoundaries } from '../../scripts/check-boundaries.ts';
import { scanImages } from '../../scripts/scan-images.ts';
import { scanPrivacy } from '../../scripts/scan-privacy.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { addDays, formatDateTime, londonDate } from '../../src/shared/format/dates.ts';
import { buildSite, copySite } from '../helpers/scratch-site.ts';

const DAY_MS = 86_400_000;
// Whole minutes, as refresh.json carries them; the page shows hours and minutes.
const staleAt = new Date(Math.floor((Date.now() - 7 * DAY_MS) / 60_000) * 60_000);
const staleIso = staleAt.toISOString().replace(/\.\d+Z$/, 'Z');
const buildTimeText = `Last updated ${formatDateTime(staleAt)}`;
const figuresTimeText = `Figures updated ${formatDateTime(staleAt)}`;
// Made-up figures, so the checks don't depend on what the bot has published.
const FIGURES = { raised: '£1,234', target: '£2,000', supporters: '37 supporters' };
const JUSTGIVING = 'https://www.justgiving.com/**';

let root: string;
let server: Server;
let baseUrl: string;
let gate: { dataErrors: string[]; images: number; boundaries: number; privacy: number };
/** The focus race's campaign in the scratch copy. */
let campaign: { id: string; page_url: string };

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
  copySite(root);

  const refreshFile = join(root, 'data/running/published/state/refresh.json');
  const refresh = JSON.parse(readFileSync(refreshFile, 'utf8'));
  refresh.generated_at = staleIso;
  refresh.sources.intervals.last_success_at_build = staleIso;
  refresh.sources.intervals.last_data_change_at = staleIso;
  writeFileSync(refreshFile, JSON.stringify(refresh));

  // Fundraising: the focus race's campaign, read last 7 days ago. A campaign marked finished has
  // no notice by design, so the drill unmarks it; with no campaign for the focus race it fails here.
  const owner = join(root, 'data/running/owner');
  const focusRace = parse(readFileSync(join(owner, 'section.yaml'), 'utf8')).focus_race.race_id as string;
  const campaignsFile = join(owner, 'campaigns.yaml');
  const campaigns = (parse(readFileSync(campaignsFile, 'utf8')) ?? []) as { id: string; race_id: string; page_url: string; finished?: boolean }[];
  const entry = campaigns.find((c) => c.race_id === focusRace);
  if (!entry) throw new Error(`campaigns.yaml has no campaign for the focus race "${focusRace}"`);
  delete entry.finished;
  writeFileSync(campaignsFile, stringify(campaigns));
  campaign = entry;
  const staleDay = londonDate(staleAt);
  const fundraisingDir = join(root, 'data/running/published/fundraising');
  mkdirSync(fundraisingDir, { recursive: true });
  writeFileSync(
    join(fundraisingDir, `${entry.id}.json`),
    JSON.stringify({
      schema_version: 1,
      campaign_id: entry.id,
      last_read_at: staleIso,
      points: [
        { date: addDays(staleDay, -1), raised_pence: 98_000, supporters: 30, target_pence: 200_000 },
        { date: staleDay, raised_pence: 123_456, supporters: 37, target_pence: 200_000 },
      ],
    }),
  );

  const issues = validateData(root);
  await buildSite(root);
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
    '/running/fundraising/',
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

// --- Fundraising (T103, specs/002-fundraising/quickstart.md §7) -----------------------------------

const FUNDRAISING_PAGES = ['/running/', '/running/fundraising/'];
const FUNDRAISING_API = '**/running/api/fundraising-freshness';
const RUNNING_API = '**/running/api/freshness';
const fundraisingNotice = (page: Page) => page.locator('[data-fundraising-stale]');
const figuresUpdated = (page: Page) => page.locator('[data-fundraising-updated-text]');
const donate = (page: Page) => page.getByRole('link', { name: 'Donate on JustGiving' });
const recent = () => new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const answer503 = (route: Route) => route.fulfill({ status: 503, headers: { 'cache-control': 'no-store' }, body: '' });

/** The figures, the updated line and the visible notice, with Donate leading to the campaign's page. */
async function expectStaleFigures(page: Page, path: string) {
  const lead = page.locator('[data-fundraising-lead]');
  await expect(lead, path).toHaveText(`${FIGURES.raised} raised of ${FIGURES.target}`);
  await expect(page.locator('[data-supporters]'), path).toHaveText(FIGURES.supporters);
  await expect(figuresUpdated(page), path).toHaveText(figuresTimeText);
  await expect(fundraisingNotice(page), path).toBeVisible();
  await expect(fundraisingNotice(page), path).toContainText('may be out of date');
  await expect(donate(page), path).toHaveAttribute('href', campaign.page_url);
}

/** Following Donate reaches the JustGiving page (answered here, so nothing leaves the machine). */
async function expectDonateWorks(page: Page, path: string) {
  await page.route(JUSTGIVING, (route) => route.fulfill({ contentType: 'text/html', body: '<title>JustGiving</title>' }));
  await donate(page).click();
  await expect(page, path).toHaveURL(campaign.page_url);
}

test('SC-003 fundraising: the gate passes, and the figures, updated time and notice are in the built HTML', () => {
  // The gate's results are the first test's; this checks the two pages' HTML.
  expect(gate.dataErrors).toEqual([]);
  for (const path of FUNDRAISING_PAGES) {
    const html = readFileSync(join(root, 'dist', path, 'index.html'), 'utf8');
    for (const text of Object.values(FIGURES)) expect(html, path).toContain(text);
    expect(html, path).toContain(figuresTimeText);
    expect(html, path).toContain(`href="${campaign.page_url}"`);
    const fundraising = html.match(/<p[^>]*data-fundraising-stale[^>]*>/)?.[0];
    expect(fundraising, path).toBeDefined();
    expect(fundraising, path).not.toMatch(/\shidden(?=[\s=>])/);
  }
});

test('SC-003 fundraising: with the fundraising route failing, everything stays and Donate works', async ({ page }) => {
  await page.route(FUNDRAISING_API, answer503);
  await page.route(RUNNING_API, answer503);
  for (const path of FUNDRAISING_PAGES) {
    const answered = page.waitForResponse(FUNDRAISING_API);
    await page.goto(baseUrl + path);
    await answered;
    await expectStaleFigures(page, path);
    await expectDonateWorks(page, path);
  }
});

test('SC-003 fundraising: without JS everything stays and Donate works', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of FUNDRAISING_PAGES) {
    await page.goto(baseUrl + path);
    await expectStaleFigures(page, path);
    await expectDonateWorks(page, path);
  }
  await context.close();
});

test('SC-003 fundraising: Running fresh and fundraising stale shows only the fundraising notice', async ({ page }) => {
  await page.route(RUNNING_API, (route) => route.fulfill({ json: { intervals: { last_success_at: recent() }, generated_at: recent() } }));
  await page.route(FUNDRAISING_API, (route) => route.fulfill({ json: { campaigns: { [campaign.id]: { last_read_at: staleIso } }, generated_at: recent() } }));
  for (const path of FUNDRAISING_PAGES) {
    await page.goto(baseUrl + path);
    await expect(lastUpdated(page), path).toHaveText('Last updated 1 hour ago');
    await expect(notice(page), path).toBeHidden();
    await expect(fundraisingNotice(page), path).toBeVisible();
    await expect(figuresUpdated(page), path).toHaveText(figuresTimeText);
  }
});

test('SC-003 fundraising: fundraising fresh and Running stale shows only the Running notice', async ({ page }) => {
  await page.route(RUNNING_API, answer503);
  await page.route(FUNDRAISING_API, (route) => route.fulfill({ json: { campaigns: { [campaign.id]: { last_read_at: recent() } }, generated_at: recent() } }));
  for (const path of FUNDRAISING_PAGES) {
    await page.goto(baseUrl + path);
    await expect(figuresUpdated(page), path).toHaveText('Figures updated 1 hour ago');
    await expect(fundraisingNotice(page), path).toBeHidden();
    await expect(lastUpdated(page), path).toHaveText(buildTimeText);
    await expect(notice(page), path).toBeVisible();
  }
});
