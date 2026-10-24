// Races and PBs in a real browser (T137; US4.1–US4.7, FR-014, FR-054, FR-055, FR-057, FR-058,
// FR-077). Two halves:
// - the real /running/races/, with invariants that hold whatever is published (no races yet:
//   owner, 2026-10-24);
// - the test-only race preview (SHELL_PREVIEW=1, tests/fixtures/race-preview/), synthetic races
//   through the real components, so race pages, the map and the gallery are tested before there
//   is a real race. Its "today" is 24 Oct 2026, and the browser clock is pinned to it.
// Map tiles are never fetched for real: tiles.openfreemap.org is answered by the test.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page, type Request } from '@playwright/test';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '../..');
const runsDir = join(ROOT, 'data/running/published/runs');
const realRaces = readdirSync(runsDir).flatMap((y) => readdirSync(join(runsDir, y)).map((f) => JSON.parse(readFileSync(join(runsDir, y, f), 'utf8')) as { is_race: boolean })).filter((r) => r.is_race).length + (existsSync(join(ROOT, 'data/running/owner/races')) ? readdirSync(join(ROOT, 'data/running/owner/races')).length : 0);

const PREVIEW = '/race-preview/';
const HALF = '/race-preview/riverside-half-2026/';
const TODAY = new Date('2026-10-24T11:00:00Z');
// A minimal map style, so MapLibre can start without the real tile server.
const STYLE = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e6df' } }] };

async function open(page: Page, path: string) {
  await page.clock.setFixedTime(TODAY);
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
}

test.describe('the real races page', () => {
  test('has its title, share image and nav entry, with upcoming races, the PB table and the history in that order', async ({ page }) => {
    await page.goto('/running/races/');
    await expect(page).toHaveTitle('Races · Running · Alexander Webber');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/\/og\/running-races\.png$/);
    expect((await page.request.get(new URL(image!).pathname)).status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Races' })).toHaveAttribute('aria-current', 'page');
    const tops = await page.locator('[data-upcoming-races], [data-pb-table], [data-race-history]').evaluateAll((els) => els.map((el) => (el.hasAttribute('data-upcoming-races') ? 'upcoming' : el.hasAttribute('data-pb-table') ? 'pbs' : 'history')));
    expect(tops).toEqual(['upcoming', 'pbs', 'history']);
    await expect(page.locator('[data-pb-table] tbody th')).toHaveText(['5k', '10k', 'Half marathon', 'Marathon']);
    if (realRaces === 0) {
      await expect(page.locator('[data-history-empty]')).toHaveText(/^No races yet: .+ will be the first\.$/);
    }
    // Nothing on the page is a third-party request, and no map script is loaded.
    expect(await page.locator('script[src*="RaceMap"], [data-race-map]').count()).toBe(0);
  });

  test('links to the races page from the landing page and the section nav', async ({ page }) => {
    await page.goto('/running/');
    await expect(page.locator('[data-section-links] a[href="/running/races/"]')).toHaveCount(1);
  });
});

test.describe('races over synthetic data (race preview)', () => {
  test('US4.1: every race once, newest first, recorded and hand-entered together', async ({ page }) => {
    await open(page, PREVIEW);
    const rows = page.locator('[data-race-history] li');
    await expect(rows).toHaveCount(6);
    expect(await rows.evaluateAll((els) => els.map((el) => [el.getAttribute('data-race-slug'), el.getAttribute('data-source')]))).toEqual([
      ['harbour-10k-2026', 'recorded'],
      ['riverside-half-2026', 'recorded'],
      ['2026-03-14-m4qd', 'recorded'],
      ['indoor-5k-2026', 'recorded'],
      ['2019-example-10k', 'hand-entered'],
      ['2018-coastal-half', 'hand-entered'],
    ]);
    await expect(rows.nth(4)).toHaveText(/Example 10k\s*13 Oct 2019\s*10k\s*52:30/);
    await expect(rows.nth(2)).toContainText('21:30 (watch time)');
    await expect(rows.nth(0).getByRole('link')).toHaveAttribute('href', '/race-preview/harbour-10k-2026/');
  });

  test('US4.2, US4.7: the PB table shows race bests with their race, faster any-run efforts, and the new PB', async ({ page }) => {
    await open(page, PREVIEW);
    const row = (d: number) => page.locator(`[data-pb-table] tr[data-pb-distance="${d}"]`);
    await expect(row(5000).locator('[data-pb-race]')).toHaveText(/21:30\s*Race · 5\.0 km, 14 Mar 2026 \(watch time\)/);
    await expect(row(5000).locator('[data-pb-effort]')).toHaveText(/20:50\s*27 Sep 2026 \(in a longer run\)/);
    await expect(row(10000).locator('[data-pb-race]')).toHaveText(/44:30\s*New\s*Harbour 10k, 18 Oct 2026/);
    await expect(row(10000)).toHaveAttribute('data-recent', '');
    await expect(row(21097.5).locator('[data-pb-race]')).toHaveText(/1:41:07\s*Riverside Half Marathon, 17 May 2026/);
    await expect(row(42195)).toHaveText(/Not run yet: Seaside Marathon on 4 Apr 2027 will be the first\./);
    // FR-057: the treadmill race's 20:10 doesn't count.
    await expect(page.locator('[data-pb-table]')).not.toContainText('20:10');
    await expect(page.locator('[data-race-slug="harbour-10k-2026"] [data-pb-badge]')).toHaveText('New PB');
    await expect(page.locator('[data-race-slug="riverside-half-2026"] [data-pb-badge]')).toHaveText('PB');
  });

  test('US4.6: upcoming races show date, distance, days remaining and target, focus race first; completed ones have left', async ({ page }) => {
    await open(page, PREVIEW);
    const races = page.locator('[data-upcoming-race]');
    expect(await races.evaluateAll((els) => els.map((el) => el.getAttribute('data-upcoming-race')))).toEqual(['seaside-2027', 'hilltop-10k']);
    await expect(races.nth(0)).toHaveText(/Focus race\s*Seaside Marathon\s*4 April 2027 · Marathon · Target: sub-3:20\s*162 days to go/);
    await expect(races.nth(1)).toHaveText(/Hilltop 10k\s*6 December 2026 · 10k · Target: sub-43:00\s*43 days to go/);
    await expect(races.nth(0).getByRole('link', { name: 'Seaside Marathon' })).toHaveAttribute('href', 'https://example.org/seaside');
  });

  test('US4.3, US4.4: a race page shows the official result, the route and the full run detail', async ({ page }) => {
    await open(page, HALF);
    await expect(page).toHaveTitle('Riverside Half Marathon, 17 May 2026 · Races · Alexander Webber');
    await expect(page.locator('[data-fact="time"]')).toHaveText(/Official time\s*1:41:07 \(watch: 1:41:15\)/);
    await expect(page.locator('[data-fact="position"] dd')).toHaveText('212');
    await expect(page.getByRole('link', { name: 'Official results' })).toHaveAttribute('href', 'https://example.org/results');
    await expect(page.locator('[data-race-map] svg[role="img"]')).toBeVisible();
    await expect(page.locator('[data-km-marker]')).toHaveCount(10);
    for (const panel of ['[data-run-summary]', '[data-run-charts]', '[data-hr-zones]', '[data-splits]', '[data-run-efforts]', '[data-run-dynamics]']) {
      await expect(page.locator(panel), panel).toHaveCount(1);
    }
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect((await page.request.get(new URL(image!).pathname)).status()).toBe(200);
  });

  test('US4.5: the gallery shows three photos with their descriptions as alt text and lazy loading', async ({ page }) => {
    await open(page, HALF);
    const images = page.locator('[data-photo-gallery] img');
    await expect(images).toHaveCount(3);
    expect(await images.evaluateAll((els) => els.map((el) => [el.getAttribute('alt'), el.getAttribute('loading')]))).toEqual([
      ['A runner crossing a finish line under an orange arch', 'lazy'],
      ['Runners waiting in a start pen', 'lazy'],
      ['A medal on a blue ribbon', 'lazy'],
    ]);
    await expect(page.locator('[data-photo-gallery] figcaption')).toHaveText(['The last 100 metres', 'Medal number three']);
    await expect(page.locator('[data-photo-gallery] source[type="image/avif"]')).toHaveCount(3);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
      expect(await image.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(/\.(avif|webp)$/);
    }
  });

  test('US4.5: no image in dist/ carries any metadata', async () => {
    const dir = join(ROOT, 'dist/_astro');
    const images = readdirSync(dir).filter((f) => /\.(jpe?g|webp|avif|png)$/i.test(f));
    expect(images.length).toBeGreaterThanOrEqual(18); // 3 photos x 3 formats x 2 widths
    for (const file of images) {
      const meta = await sharp(join(dir, file)).metadata();
      expect([file, meta.exif, meta.xmp, meta.iptc]).toEqual([file, undefined, undefined, undefined]);
    }
  });

  test('the static map works without JS, and the map button only appears with JS', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(HALF);
    await expect(page.locator('[data-race-map] svg[role="img"]')).toBeVisible();
    await expect(page.locator('[data-map-load]')).toBeHidden();
    await expect(page.locator('[data-race-map] title')).toHaveText('Route of Riverside Half Marathon');
    await context.close();
  });

  test('MapLibre, the route and map tiles are requested only after "Load interactive map" is clicked', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (r) => requests.push(r));
    await page.route('https://tiles.openfreemap.org/**', (route) =>
      route.request().url().includes('/styles/') ? route.fulfill({ json: STYLE }) : route.fulfill({ status: 404, body: '' }),
    );
    await open(page, HALF);
    await page.waitForLoadState('networkidle');
    const thirdParty = (rs: Request[]) => rs.filter((r) => new URL(r.url()).origin !== new URL(page.url()).origin);
    expect(thirdParty(requests).map((r) => r.url())).toEqual([]);
    expect(requests.filter((r) => /maplibre|route\.json/.test(r.url()))).toEqual([]);

    const before = requests.length;
    await page.getByRole('button', { name: 'Load interactive map' }).click();
    await expect(page.locator('[data-race-map]')).toHaveAttribute('data-map-state', /loaded|failed/, { timeout: 20_000 });
    const after = requests.slice(before).map((r) => r.url());
    expect(after.some((u) => /\/_astro\/maplibre-gl\.[^/]+\.js$/.test(u))).toBe(true);
    expect(after.some((u) => u.endsWith('/race-preview/riverside-half-2026/route.json'))).toBe(true);
    expect(after.some((u) => u.startsWith('https://tiles.openfreemap.org/styles/'))).toBe(true);
  });

  test('if the map server is down, the static route stays and says so (FR-074)', async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
    await open(page, HALF);
    await page.getByRole('button', { name: 'Load interactive map' }).click();
    await expect(page.locator('[data-race-map]')).toHaveAttribute('data-map-state', 'failed', { timeout: 20_000 });
    await expect(page.locator('[data-map-status]')).toHaveText("The interactive map couldn't load. The route above is the full course.");
    await expect(page.locator('[data-race-map] svg[role="img"]')).toBeVisible();
  });

  test('FR-058: a treadmill race is labelled and has no map; a hand-entered race has no map or run detail', async ({ page }) => {
    await open(page, '/race-preview/indoor-5k-2026/');
    await expect(page.locator('.run-labels [data-treadmill]')).toHaveCount(1);
    await expect(page.locator('[data-race-map]')).toHaveCount(0);
    await open(page, '/race-preview/2019-example-10k/');
    await expect(page.locator('[data-race-map], [data-run-summary]')).toHaveCount(0);
    await expect(page.locator('[data-race-result]')).toContainText('Entered by hand');
  });

  test('Garmin attribution sits under the heading and at each Garmin view (T152)', async ({ page }) => {
    await open(page, HALF);
    await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveText('Source: Garmin Venu X1');
    await expect(page.locator('#race-map-title + [data-garmin-attribution]')).toHaveText('Source: Garmin Venu X1');
    await open(page, PREVIEW);
    await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveText('Source: Garmin Venu X1');
    await expect(page.locator('#personal-bests + [data-garmin-attribution]')).toHaveText('Source: Garmin Venu X1');
    await expect(page.locator('#race-history + [data-garmin-attribution]')).toHaveText('Source: Garmin Venu X1');
    await open(page, '/race-preview/2019-example-10k/');
    await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveCount(0);
  });

  for (const width of [360, 320]) {
    test(`the races page and a race page fit ${width}px without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [PREVIEW, HALF]) {
        await open(page, path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, path).toBe(0);
      }
    });
  }
});
