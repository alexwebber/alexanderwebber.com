// The shared shell in a real browser (T072-T076, T152): axe (WCAG 2.2 AA rules) in light and
// dark, no sideways scroll at 320px, keyboard use of the skip link, range toggle and data table,
// and the freshness script's three outcomes. /shell-preview/ exists only in a build made with
// SHELL_PREVIEW=1 (astro.config.mjs; tests.yml builds that way). Its data is all synthetic,
// including a fixed build-time freshness, so results don't depend on what the repo has published.
import { expect, test, type Page } from '@playwright/test';
import { axe, fullSweep, sweepOnlyInDark } from '../helpers/a11y.ts';

const PREVIEW = '/shell-preview/';

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} is missing: build with SHELL_PREVIEW=1 first`).toBe(200);
}

async function expectNoAxeViolations(page: Page) {
  expect(await axe(page)).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of ['/', PREVIEW]) {
      test(`${path} passes axe`, async ({ page }) => {
        sweepOnlyInDark(colorScheme);
        await open(page, path);
        await expectNoAxeViolations(page);
      });
    }

    test('axe also passes with the data table open and another range chosen', async ({ page }) => {
      test.skip(!fullSweep(), 'swept in the phone project');
      await open(page, PREVIEW);
      await page.getByText('All time', { exact: true }).click();
      await page.getByText('Show the data').first().click();
      await expectNoAxeViolations(page);
    });
  });
}

test('an address with no page gets the site\'s own "page not found" page, which passes axe', async ({ page }) => {
  const response = await page.goto('/running/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('main').getByRole('link', { name: "Alexander Webber's home page" })).toHaveAttribute('href', '/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Running' })).toHaveAttribute('href', '/running/');
  await expectNoAxeViolations(page);
});

test('no sideways scrolling at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ['/', PREVIEW]) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBe(0);
  }
});

test('the skip link is the first Tab stop and moves focus to main', async ({ page }) => {
  await open(page, PREVIEW);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('Garmin attribution sits right under the page heading and on each chart', async ({ page }) => {
  await open(page, PREVIEW);
  const underHeading = page.locator('h1 + [data-garmin-attribution]');
  await expect(underHeading).toHaveText('Source: Garmin');
  await expect(page.locator('figcaption [data-garmin-attribution]')).toHaveCount(2);
});

test.describe('range toggle', () => {
  const panel = (page: Page, range: string) => page.locator(`.range-panel[data-range="${range}"]`);

  test('shows one range at a time, 1 year first', async ({ page }) => {
    await open(page, PREVIEW);
    await expect(panel(page, '1y')).toBeVisible();
    await expect(panel(page, '3m')).toBeHidden();
    await expect(panel(page, 'all')).toBeHidden();
  });

  test('is operable by keyboard and exposed as radios', async ({ page }) => {
    await open(page, PREVIEW);
    const group = page.getByRole('group', { name: 'Weight chart range' });
    await expect(group.getByRole('radio')).toHaveCount(3);
    await group.getByRole('radio', { name: '1 year' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(group.getByRole('radio', { name: '3 months' })).toBeChecked();
    await expect(panel(page, '3m')).toBeVisible();
    await expect(panel(page, '1y')).toBeHidden();
  });

  test('each chart is an image with its own text alternative', async ({ page }) => {
    await open(page, PREVIEW);
    await expect(page.getByRole('img', { name: 'Weight, last year Weight fell about 3 kg over the last year.' })).toBeVisible();
  });
});

test('the data table opens from the keyboard', async ({ page }) => {
  await open(page, PREVIEW);
  const summary = page.locator('summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  const table = page.getByRole('region', { name: 'Weight: data' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible();
  await table.focus();
  await expect(table).toBeFocused();
});

test.describe('last updated', () => {
  const notice = (page: Page) => page.locator('[data-stale-notice]');
  const text = (page: Page) => page.locator('[data-last-updated-text]');

  test('shows the live time and hides the notice while fresh', async ({ page }) => {
    const recent = new Date(Date.now() - 2 * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    await page.route('**/running/api/freshness', (route) => route.fulfill({ json: { intervals: { last_success_at: recent }, generated_at: recent } }));
    await open(page, PREVIEW);
    await expect(text(page)).toHaveText('Last updated 2 hours ago');
    await expect(notice(page)).toBeHidden();
  });

  test('shows the notice when the live data is older than the threshold', async ({ page }) => {
    const old = new Date(Date.now() - 30 * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    await page.route('**/running/api/freshness', (route) => route.fulfill({ json: { intervals: { last_success_at: old }, generated_at: old } }));
    await open(page, PREVIEW);
    await expect(text(page)).toHaveText('Last updated 30 hours ago');
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('may be out of date');
  });

  test('keeps the build-time text and notice when the endpoint fails', async ({ page }) => {
    await page.route('**/running/api/freshness', (route) => route.fulfill({ status: 503, body: '' }));
    await open(page, PREVIEW);
    // The preview page fixes its build-time value at 1 Jan 2026 09:00 UTC, stale at build.
    await expect(text(page)).toHaveText('Last updated 1 Jan 2026, 09:00');
    await expect(notice(page)).toBeVisible();
  });
});
