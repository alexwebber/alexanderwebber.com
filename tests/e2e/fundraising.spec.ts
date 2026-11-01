// The fundraising card in a real browser (T059; US1, FR-004, FR-005, FR-062, FR-065), over the
// test-only previews (SHELL_PREVIEW=1, tests/fixtures/fundraising-preview/): synthetic campaigns
// through the real components, in the states the real one can't show yet. Their "today" is
// 10 Nov 2026. The real card's place on /running/ is in tests/e2e/landing.spec.ts.
import { expect, test, type Page } from '@playwright/test';

const API = '**/running/api/fundraising-freshness';
const CAMPAIGN = 'seaside-2027';
const CHARITY = 'For Example hospice';
const PAGE_URL = 'https://www.justgiving.com/page/example-seaside-2027';
const NOW = '2026-11-10T12:00:00Z'; // PREVIEW_NOW (store.ts)

const STATES = [
  { state: 'active', lead: '£1,250 raised of £2,000', secondary: `37 supporters · ${CHARITY}`, percent: '62' },
  { state: 'no-target', lead: '£1,250 raised', secondary: `37 supporters · ${CHARITY}`, percent: undefined },
  { state: 'zero', lead: '£0 raised of £500', secondary: `No supporters yet · ${CHARITY}`, percent: '0' },
  { state: 'beaten', lead: '£2,160 raised of £2,000', secondary: `Target beaten: 108% · 37 supporters · ${CHARITY}`, percent: '100' },
  { state: 'stale', lead: '£1,250 raised of £2,000', secondary: `37 supporters · ${CHARITY}`, percent: '62' },
];

async function open(page: Page, state: string) {
  const response = await page.goto(`/fundraising-preview/${state}/`);
  expect(response?.status(), state).toBe(200);
}

const card = (page: Page) => page.locator('.fundraising-card');
const updated = (page: Page) => page.locator('[data-fundraising-updated-text]');
const notice = (page: Page) => page.locator('[data-fundraising-stale]');
const donate = (page: Page) => page.getByRole('link', { name: 'Donate on JustGiving' });

/** The live freshness route, answering with one last-read time. */
const live = (page: Page, last_read_at: string) => page.route(API, (route) => route.fulfill({ json: { campaigns: { [CAMPAIGN]: { last_read_at } }, generated_at: last_read_at } }));

for (const { state, lead, secondary, percent } of STATES) {
  test(`${state}: shows its row of contracts/routes.md`, async ({ page }) => {
    await open(page, state);
    await expect(card(page).locator('[data-fundraising-lead]')).toHaveText(lead);
    await expect(card(page).locator('[data-fundraising-secondary]')).toHaveText(secondary);
    if (percent === undefined) await expect(page.getByRole('meter')).toHaveCount(0);
    else await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', percent);
    await expect(donate(page)).toHaveAttribute('href', PAGE_URL);
    await expect(donate(page)).not.toHaveAttribute('target', /./);
    await expect(updated(page)).toHaveText(/^Figures updated \d{1,2} Nov 2026, \d{2}:\d{2}$/);
    await expect(page.locator('[data-last-updated-text]')).toHaveText(/^(Last updated |Not updated yet)/);
    await expect(notice(page)).toBeVisible({ visible: state === 'stale' });
  });

  for (const width of [320, 360]) {
    test(`${state}: fits ${width}px without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }

  test.describe('without JavaScript (FR-062)', () => {
    test.use({ javaScriptEnabled: false });

    test(`${state}: the figures, Donate and the updated line all stay`, async ({ page }) => {
      await open(page, state);
      await expect(card(page).locator('[data-fundraising-lead]')).toHaveText(lead);
      await expect(card(page).locator('[data-fundraising-secondary]')).toHaveText(secondary);
      await expect(donate(page)).toBeVisible();
      await expect(updated(page)).toBeVisible();
      await expect(notice(page)).toBeVisible({ visible: state === 'stale' });
    });
  });
}

test('108%: the bar is full and stays inside its track', async ({ page }) => {
  await open(page, 'beaten');
  const [track, fill] = await Promise.all([page.getByRole('meter').boundingBox(), page.locator('.progress-fill').boundingBox()]);
  expect(fill!.x).toBeGreaterThanOrEqual(track!.x);
  expect(fill!.x + fill!.width).toBeLessThanOrEqual(track!.x + track!.width + 0.5);
  expect(fill!.width).toBeGreaterThan(track!.width * 0.99);
});

test('Donate is at least 44px tall and reads as a button (FR-065)', async ({ page }) => {
  await open(page, 'active');
  expect((await donate(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(donate(page)).toHaveCSS('text-decoration-line', 'none');
});

test('the keyboard reaches Donate with a visible focus ring, and Enter goes to JustGiving', async ({ page }) => {
  await page.route('https://www.justgiving.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Stub</title>' }));
  await open(page, 'active');
  const links = await page.locator('a[href]').count();
  let reached = false;
  for (let i = 0; i < links + 2 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await donate(page).evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  await expect(donate(page)).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(PAGE_URL);
});

test.describe('the live last-read time (FR-004, FR-005)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(NOW));
  });

  test('a newer time replaces the text', async ({ page }) => {
    await live(page, '2026-11-10T10:00:00Z');
    await open(page, 'active');
    await expect(updated(page)).toHaveText('Figures updated 2 hours ago');
    await expect(notice(page)).toBeHidden();
  });

  test('leaves the build-time text alone while it is still current', async ({ page }) => {
    await live(page, '2026-11-10T09:17:03Z');
    const answered = page.waitForResponse(API);
    await open(page, 'active');
    await answered;
    await expect(updated(page)).toHaveText('Figures updated 10 Nov 2026, 09:17');
  });

  test('never shows an older time than the build', async ({ page }) => {
    await live(page, '2026-11-09T09:17:03Z');
    const answered = page.waitForResponse(API);
    await open(page, 'active');
    await answered;
    await expect(updated(page)).toHaveText('Figures updated 10 Nov 2026, 09:17');
    await expect(notice(page)).toBeHidden();
  });

  test('a fresh time clears a notice that was stale at build', async ({ page }) => {
    await live(page, '2026-11-10T10:00:00Z');
    await open(page, 'stale');
    await expect(updated(page)).toHaveText('Figures updated 2 hours ago');
    await expect(notice(page)).toBeHidden();
  });

  test('the notice comes on as the build ages, with the text left alone', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));
    await live(page, '2026-11-10T09:17:03Z');
    await open(page, 'active');
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('may be out of date');
    await expect(updated(page)).toHaveText('Figures updated 10 Nov 2026, 09:17');
  });

  test('a response without this campaign changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { campaigns: {}, generated_at: NOW } }));
    const answered = page.waitForResponse(API);
    await open(page, 'stale');
    await answered;
    await expect(updated(page)).toHaveText('Figures updated 8 Nov 2026, 09:17');
    await expect(notice(page)).toBeVisible();
  });

  test('a 503 changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ status: 503, headers: { 'cache-control': 'no-store' }, body: '{"error":"unavailable"}' }));
    const answered = page.waitForResponse(API);
    await open(page, 'stale');
    await answered;
    await expect(updated(page)).toHaveText('Figures updated 8 Nov 2026, 09:17');
    await expect(notice(page)).toBeVisible();
  });

  test('going offline changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.abort());
    await open(page, 'active');
    await expect(updated(page)).toHaveText('Figures updated 10 Nov 2026, 09:17');
    await expect(notice(page)).toBeHidden();
  });
});
