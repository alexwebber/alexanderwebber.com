// The fundraising card and page in a real browser (T059, T076; US1, US2, FR-004, FR-005, FR-040 to
// FR-043, FR-061, FR-062, FR-065):
// - the test-only previews (SHELL_PREVIEW=1, tests/fixtures/fundraising-preview/): synthetic
//   campaigns through the real components, in the states the real one can't show yet. Each preview
//   renders the page, with the landing card above it. Their "today" is 10 Nov 2026;
// - the real /running/fundraising/, with figures taken from the published file, never pinned,
//   because the bot publishes them.
// The real card's place on /running/ is in tests/e2e/landing.spec.ts.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { formatLongDate } from '../../src/shared/format/dates.ts';
import { poundsText } from '../../src/sections/running/domain/fundraising.ts';

const API = '**/running/api/fundraising-freshness';
const CAMPAIGN = 'seaside-2027';
const CHARITY = 'For Example hospice';
const PAGE_URL = 'https://www.justgiving.com/page/example-seaside-2027';
const NOW = '2026-11-10T12:00:00Z'; // PREVIEW_NOW (store.ts)

const STATES = [
  { state: 'active', lead: '£1,250 raised of £2,000', secondary: `37 supporters · ${CHARITY}`, percent: '62' },
  { state: 'first-day', lead: '£1,250 raised of £2,000', secondary: `37 supporters · ${CHARITY}`, percent: '62' },
  { state: 'no-target', lead: '£1,250 raised', secondary: `37 supporters · ${CHARITY}`, percent: undefined },
  { state: 'zero', lead: '£0 raised of £500', secondary: `No supporters yet · ${CHARITY}`, percent: '0' },
  { state: 'beaten', lead: '£2,160 raised of £2,000', secondary: `Target beaten: 108% · 37 supporters · ${CHARITY}`, percent: '100' },
  { state: 'stale', lead: '£1,250 raised of £2,000', secondary: `37 supporters · ${CHARITY}`, percent: '62' },
  { state: 'second-campaign', lead: '£240 raised of £1,000', secondary: '8 supporters · For Example shelter', percent: '24' },
];
const ALL_STATES = [...STATES.map((s) => s.state), 'no-current'];

async function open(page: Page, state: string) {
  const response = await page.goto(`/fundraising-preview/${state}/`);
  expect(response?.status(), state).toBe(200);
}

const card = (page: Page) => page.locator('.fundraising-card');
const campaign = (page: Page) => page.locator('[data-fundraising-current]');
const pastList = (page: Page) => page.locator('[data-past-campaigns]');
const chart = (page: Page) => page.locator('figure.chart-figure');
const updated = (within: Locator) => within.locator('[data-fundraising-updated-text]');
const notice = (within: Locator) => within.locator('[data-fundraising-stale]');
const donate = (within: Locator) => within.getByRole('link', { name: 'Donate on JustGiving' });

/** The live freshness route, answering with one last-read time per campaign. */
const live = (page: Page, last_read_at: string, ids = [CAMPAIGN]) =>
  page.route(API, (route) => route.fulfill({ json: { campaigns: Object.fromEntries(ids.map((id) => [id, { last_read_at }])), generated_at: last_read_at } }));

for (const { state, lead, secondary, percent } of STATES) {
  test(`${state}: the card shows its row of contracts/routes.md`, async ({ page }) => {
    await open(page, state);
    await expect(card(page).locator('[data-fundraising-lead]')).toHaveText(lead);
    await expect(card(page).locator('[data-fundraising-secondary]')).toHaveText(secondary);
    if (percent === undefined) await expect(card(page).getByRole('meter')).toHaveCount(0);
    else await expect(card(page).getByRole('meter')).toHaveAttribute('aria-valuenow', percent);
    await expect(donate(card(page))).toHaveAttribute('href', state === 'second-campaign' ? 'https://www.justgiving.com/page/example-lakeside-2027' : PAGE_URL);
    await expect(donate(card(page))).not.toHaveAttribute('target', /./);
    await expect(card(page).getByRole('link', { name: 'See the fundraising page' })).toHaveAttribute('href', '/running/fundraising/');
    await expect(updated(card(page))).toHaveText(/^Figures updated \d{1,2} Nov 2026, \d{2}:\d{2}$/);
    await expect(page.locator('[data-last-updated-text]')).toHaveText(/^(Last updated |Not updated yet)/);
    await expect(notice(card(page))).toBeVisible({ visible: state === 'stale' });
  });

  test(`${state}: the page shows the same figures, without repeating the charity`, async ({ page }) => {
    await open(page, state);
    await expect(campaign(page).locator('[data-fundraising-lead]')).toHaveText(lead);
    await expect(campaign(page).locator('[data-fundraising-secondary]')).toHaveText(secondary.replace(/ · For .*$/, ''));
    if (percent === undefined) await expect(campaign(page).getByRole('meter')).toHaveCount(0);
    else await expect(campaign(page).getByRole('meter')).toHaveAttribute('aria-valuenow', percent);
    await expect(notice(campaign(page))).toBeVisible({ visible: state === 'stale' });
  });

  test.describe('without JavaScript (FR-062)', () => {
    test.use({ javaScriptEnabled: false });

    test(`${state}: the figures, Donate and the updated line all stay, on card and page`, async ({ page }) => {
      await open(page, state);
      for (const within of [card(page), campaign(page)]) {
        await expect(within.locator('[data-fundraising-lead]')).toHaveText(lead);
        await expect(donate(within)).toBeVisible();
        await expect(updated(within)).toBeVisible();
        await expect(notice(within)).toBeVisible({ visible: state === 'stale' });
      }
      await expect(card(page).locator('[data-fundraising-secondary]')).toHaveText(secondary);
    });
  });
}

for (const state of ALL_STATES) {
  for (const width of [320, 360]) {
    test(`${state}: fits ${width}px without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }
}

test('108%: the bar is full and stays inside its track', async ({ page }) => {
  await open(page, 'beaten');
  const [track, fill] = await Promise.all([card(page).getByRole('meter').boundingBox(), card(page).locator('.progress-fill').boundingBox()]);
  expect(fill!.x).toBeGreaterThanOrEqual(track!.x);
  expect(fill!.x + fill!.width).toBeLessThanOrEqual(track!.x + track!.width + 0.5);
  expect(fill!.width).toBeGreaterThan(track!.width * 0.99);
});

test('Donate is at least 44px tall and reads as a button (FR-065)', async ({ page }) => {
  await open(page, 'active');
  expect((await donate(card(page)).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(donate(card(page))).toHaveCSS('text-decoration-line', 'none');
  expect((await donate(campaign(page)).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('on the page Donate stops at 20rem, and on the card it still spans the card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'active');
  expect((await donate(campaign(page)).boundingBox())!.width).toBeLessThanOrEqual(320);
  const inner = await card(page).evaluate((el) => {
    const style = getComputedStyle(el);
    return el.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
  });
  expect((await donate(card(page)).boundingBox())!.width).toBeCloseTo(inner, 0);
});

test('on a phone the page\'s Donate spans its panel', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, 'active');
  const [box, panel] = await Promise.all([donate(campaign(page)).boundingBox(), campaign(page).boundingBox()]);
  expect(box!.width).toBeGreaterThan(panel!.width * 0.8);
});

test('the keyboard reaches Donate with a visible focus ring, and Enter goes to JustGiving', async ({ page }) => {
  await page.route('https://www.justgiving.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Stub</title>' }));
  await open(page, 'active');
  const links = await page.locator('a[href]').count();
  let reached = false;
  for (let i = 0; i < links + 2 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await donate(card(page)).evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  await expect(donate(card(page))).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(PAGE_URL);
});

test.describe('the page (US2)', () => {
  test('US2.1: race and date, charity with its link, registered charity, then the figures', async ({ page }) => {
    await open(page, 'active');
    await expect(campaign(page).getByRole('heading', { level: 2 })).toHaveText('Seaside Marathon · 4 April 2027');
    await expect(campaign(page).locator('[data-fundraising-for]')).toHaveText(CHARITY);
    await expect(campaign(page).getByRole('link', { name: 'Example hospice' })).toHaveAttribute('href', 'https://example.org/');
    await expect(campaign(page).locator('[data-fundraising-registered]')).toHaveText('Part of Example hospice group, registered charity 000000');
    await expect(card(page).locator('[data-fundraising-registered]')).toHaveCount(0);
    await expect(updated(campaign(page))).toHaveText('Figures updated 10 Nov 2026, 09:17');
  });

  test('the registered line drops "Part of" when the names match, and goes without a number', async ({ page }) => {
    await open(page, 'first-day');
    await expect(page.locator('[data-fundraising-registered]')).toHaveText('Registered charity 000000');
    await open(page, 'no-target');
    await expect(page.locator('[data-fundraising-registered]')).toHaveCount(0);
  });

  test('the charity is plain text when it has no site', async ({ page }) => {
    await open(page, 'zero');
    await expect(campaign(page).locator('[data-fundraising-for]')).toHaveText(CHARITY);
    await expect(campaign(page).locator('[data-fundraising-for] a')).toHaveCount(0);
  });

  test('US2.2: the chart states its message, marks the target and draws the total to today', async ({ page }) => {
    await open(page, 'active');
    await expect(chart(page).getByRole('heading', { level: 2, name: 'The total so far' })).toBeVisible();
    await expect(chart(page).locator('.chart-figure-summary')).toHaveText('£1,250 raised since 12 Oct 2026, 62% of the £2,000 target');
    await expect(chart(page).getByRole('img', { name: /Total raised by day/ })).toBeVisible();
    await expect(chart(page).locator('.chart-target')).toHaveText('Target £2,000');
    await expect(chart(page).locator('.chart-dot')).toHaveAttribute('title', 'Total raised: £1,250, 10 Nov 2026');
  });

  test('the target label sits clear of the last point, even past the target', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, 'beaten');
    const [label, end] = await Promise.all([chart(page).locator('.chart-target span').boundingBox(), chart(page).locator('.chart-dot-label').boundingBox()]);
    expect(label!.x + label!.width).toBeLessThan(end!.x);
    const line = await chart(page).locator('.chart-plot').boundingBox();
    expect(label!.x).toBeLessThan(line!.x + line!.width / 2);
  });

  test('the chart closes on today, when the last change was earlier', async ({ page }) => {
    await open(page, 'beaten');
    await expect(chart(page).locator('.chart-dot')).toHaveAttribute('title', 'Total raised: £2,160, 10 Nov 2026');
  });

  test('without a target: no target line, and the summary says so little', async ({ page }) => {
    await open(page, 'no-target');
    await expect(chart(page).locator('.chart-target')).toHaveCount(0);
    await expect(chart(page).locator('.chart-figure-summary')).toHaveText('£1,250 raised since 12 Oct 2026');
  });

  test('US2.3: figures from one day show no chart', async ({ page }) => {
    await open(page, 'first-day');
    await expect(campaign(page).locator('[data-fundraising-lead]')).toBeVisible();
    await expect(chart(page)).toHaveCount(0);
  });

  test('FR-061: the table opens by keyboard, and holds the real points only', async ({ page }) => {
    await open(page, 'active');
    const summary = chart(page).locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const table = chart(page).getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText(['Date', 'Total raised']);
    await expect(table.locator('tbody tr')).toHaveCount(8);
    await expect(table.locator('tbody tr').first()).toHaveText(/10 Nov 2026\s*£1,250/);
    await expect(table.locator('tbody tr').last()).toHaveText(/12 Oct 2026\s*£0/);
    await page.keyboard.press('Tab');
    await expect(chart(page).locator('.table-scroll')).toBeFocused();
  });

  test('without JavaScript the summary and the table stay (FR-062)', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: baseURL! });
    const page = await context.newPage();
    await open(page, 'active');
    await expect(chart(page).locator('.chart-figure-summary')).toBeVisible();
    await chart(page).locator('summary').click();
    await expect(chart(page).getByRole('table')).toBeVisible();
    await context.close();
  });

  test('US2.5: a finished past campaign sits below, with its final total', async ({ page }) => {
    await open(page, 'second-campaign');
    await expect(campaign(page).getByRole('heading', { level: 2 })).toHaveText('Lakeside Half · 3 October 2027');
    const past = page.locator('[data-past-campaign="seaside-2026"]');
    await expect(past.getByRole('heading', { level: 3 })).toHaveText('Seaside Marathon · 5 April 2026');
    await expect(past).toContainText(CHARITY);
    await expect(past.locator('[data-past-total]')).toHaveText('Final total: £1,620 raised of £1,500');
    await expect(past.locator('[data-past-read]')).toHaveText('Last updated 3 Jul 2026');
    await expect(past.getByRole('link', { name: 'JustGiving page for Seaside Marathon' })).toHaveAttribute('href', 'https://www.justgiving.com/page/example-seaside-2026');
    await expect(past.locator('[data-fundraising-updated]')).toHaveCount(0);
    await expect(past.getByRole('meter')).toHaveCount(0);
    const [top, list] = await Promise.all([chart(page).boundingBox(), pastList(page).boundingBox()]);
    expect(list!.y).toBeGreaterThan(top!.y);
  });

  test('US4.5: with no current campaign the page leads with past campaigns, and no card shows', async ({ page }) => {
    await open(page, 'no-current');
    await expect(campaign(page)).toHaveCount(0);
    await expect(chart(page)).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Donate on JustGiving' })).toHaveCount(0);
    await expect(page.locator('main h2').first()).toHaveText('Past campaigns');
    await expect(page.locator('[data-past-campaign]').evaluateAll((els) => els.map((el) => el.getAttribute('data-past-campaign')))).resolves.toEqual(['harbour-2026', 'seaside-2026']);
  });

  test('an unfinished past campaign stays read: it shows when, and goes stale', async ({ page }) => {
    await open(page, 'no-current');
    const past = page.locator('[data-past-campaign="harbour-2026"]');
    await expect(past.locator('[data-past-total]')).toHaveText('£310 raised');
    await expect(updated(past)).toHaveText('Figures updated 8 Nov 2026, 09:17');
    await expect(notice(past)).toBeVisible();
    await expect(page.locator('[data-past-campaign="seaside-2026"] [data-fundraising-stale]')).toHaveCount(0);
  });
});

test.describe('the live last-read time (FR-004, FR-005)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(NOW));
  });

  test('a newer time replaces the text, on the card and the page', async ({ page }) => {
    await live(page, '2026-11-10T10:00:00Z');
    await open(page, 'active');
    for (const within of [card(page), campaign(page)]) {
      await expect(updated(within)).toHaveText('Figures updated 2 hours ago');
      await expect(notice(within)).toBeHidden();
    }
  });

  test('leaves the build-time text alone while it is still current', async ({ page }) => {
    await live(page, '2026-11-10T09:17:03Z');
    const answered = page.waitForResponse(API);
    await open(page, 'active');
    await answered;
    await expect(updated(card(page))).toHaveText('Figures updated 10 Nov 2026, 09:17');
  });

  test('never shows an older time than the build', async ({ page }) => {
    await live(page, '2026-11-09T09:17:03Z');
    const answered = page.waitForResponse(API);
    await open(page, 'active');
    await answered;
    await expect(updated(card(page))).toHaveText('Figures updated 10 Nov 2026, 09:17');
    await expect(notice(card(page))).toBeHidden();
  });

  test('a fresh time clears a notice that was stale at build', async ({ page }) => {
    await live(page, '2026-11-10T10:00:00Z');
    await open(page, 'stale');
    await expect(updated(card(page))).toHaveText('Figures updated 2 hours ago');
    await expect(notice(card(page))).toBeHidden();
  });

  test('the notice comes on as the build ages, with the text left alone', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));
    await live(page, '2026-11-10T09:17:03Z');
    await open(page, 'active');
    await expect(notice(card(page))).toBeVisible();
    await expect(notice(card(page))).toContainText('may be out of date');
    await expect(updated(card(page))).toHaveText('Figures updated 10 Nov 2026, 09:17');
  });

  test('each block follows its own campaign', async ({ page }) => {
    await live(page, '2026-11-10T10:00:00Z', ['harbour-2026']);
    await open(page, 'no-current');
    const past = page.locator('[data-past-campaign="harbour-2026"]');
    await expect(updated(past)).toHaveText('Figures updated 2 hours ago');
    await expect(notice(past)).toBeHidden();
  });

  test('a response without this campaign changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { campaigns: {}, generated_at: NOW } }));
    const answered = page.waitForResponse(API);
    await open(page, 'stale');
    await answered;
    await expect(updated(card(page))).toHaveText('Figures updated 8 Nov 2026, 09:17');
    await expect(notice(card(page))).toBeVisible();
  });

  test('a 503 changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ status: 503, headers: { 'cache-control': 'no-store' }, body: '{"error":"unavailable"}' }));
    const answered = page.waitForResponse(API);
    await open(page, 'stale');
    await answered;
    await expect(updated(card(page))).toHaveText('Figures updated 8 Nov 2026, 09:17');
    await expect(notice(card(page))).toBeVisible();
  });

  test('going offline changes nothing', async ({ page }) => {
    await page.route(API, (route) => route.abort());
    await open(page, 'active');
    await expect(updated(card(page))).toHaveText('Figures updated 10 Nov 2026, 09:17');
    await expect(notice(card(page))).toBeHidden();
  });
});

// The real page, with expectations from the data the build read (FR-040, SC-006).
test.describe('/running/fundraising/ on real data', () => {
  const REPO = resolve(import.meta.dirname, '../..');
  const owner = (file: string) => parse(readFileSync(join(REPO, 'data/running/owner', file), 'utf8'));
  const section = owner('section.yaml') as { focus_race: { race_id: string } };
  const races = (owner('upcoming-races.yaml') ?? []) as { id: string; name: string; date: string }[];
  const real = ((owner('campaigns.yaml') ?? []) as { id: string; race_id: string; page_url: string; charity: { name: string; url?: string; registered?: { name: string; number: string } } }[]).find(
    (c) => c.race_id === section.focus_race.race_id,
  );
  const file = real && join(REPO, 'data/running/published/fundraising', `${real.id}.json`);
  const published = file && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { points: { raised_pence: number; target_pence?: number }[] }) : undefined;
  const race = races.find((r) => r.id === real?.race_id);

  test.beforeEach(() => {
    test.skip(!published, 'the focus race has no published campaign');
  });

  test('shows the published figures, with its race, charity and Donate', async ({ page }) => {
    const response = await page.goto('/running/fundraising/');
    expect(response?.status()).toBe(200);
    const latest = published!.points.at(-1)!;
    await expect(page.getByRole('heading', { level: 1, name: 'Fundraising' })).toBeVisible();
    await expect(campaign(page).getByRole('heading', { level: 2 })).toHaveText(`${race!.name} · ${formatLongDate(race!.date)}`);
    await expect(campaign(page).locator('[data-fundraising-for]')).toHaveText(`For ${real!.charity.name}`);
    if (real!.charity.url) await expect(campaign(page).getByRole('link', { name: real!.charity.name })).toHaveAttribute('href', real!.charity.url);
    await expect(campaign(page).locator('[data-fundraising-lead]')).toContainText(poundsText(latest.raised_pence));
    if (latest.target_pence !== undefined) await expect(campaign(page).locator('[data-fundraising-lead]')).toContainText(poundsText(latest.target_pence));
    await expect(donate(campaign(page))).toHaveAttribute('href', real!.page_url);
    await expect(updated(campaign(page))).toHaveText(/^Figures updated /);
    await expect(page.locator('[data-last-updated-text]')).toHaveText(/^(Last updated |Not updated yet)/);
    await expect(chart(page)).toHaveCount(published!.points.length >= 2 ? 1 : 0);
  });

  test('has its menu item, title, description and share image', async ({ page }) => {
    await page.goto('/running/fundraising/');
    await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Fundraising' })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('Fundraising · Running · Alexander Webber');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', new RegExp(`${real!.charity.name}.*${race!.name}`));
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/\/og\/running-fundraising\.png$/);
    const png = await page.request.get(new URL(image!).pathname);
    expect(png.status()).toBe(200);
    expect(png.headers()['content-type']).toBe('image/png');
  });

  test('the sitemap lists it', async ({ request }) => {
    const sitemap = await request.get('/sitemap-0.xml');
    expect(await sitemap.text()).toContain('https://alexanderwebber.com/running/fundraising/');
  });

  test('Running pages carry the menu item, and the landing page links to it', async ({ page }) => {
    await page.goto('/running/goals/');
    await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Fundraising' })).toHaveAttribute('href', '/running/fundraising/');
    await page.goto('/running/');
    await expect(page.locator('[data-section-links]').getByRole('link', { name: /Fundraising/ })).toHaveAttribute('href', '/running/fundraising/');
  });

  test('needs no client JS files, only the small inline scripts', async ({ page }) => {
    await page.goto('/running/fundraising/');
    expect(await page.locator('script[src]').count()).toBe(0);
    const inline = await page.locator('script:not([src])').evaluateAll((els) => els.map((el) => el.textContent?.length ?? 0));
    for (const size of inline) expect(size).toBeLessThan(1024);
  });
});
