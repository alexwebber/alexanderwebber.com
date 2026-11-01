// The fundraising card and page's accessibility (T060, T077; FR-060, FR-061, SC-010; WCAG 2.2 AA),
// over the test-only previews and the real page: zero axe violations in every state, in light, dark
// and forced colours, the chart's table open, a sound heading outline, and the bar exposed with its
// figures in words. The real card is swept with the landing page in tests/a11y/landing.spec.ts.
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const STATES = ['active', 'first-day', 'no-target', 'zero', 'beaten', 'stale', 'second-campaign', 'no-current'];
const WITH_CARD = STATES.filter((state) => state !== 'no-current');
const PAGES = STATES.map((state) => `/fundraising-preview/${state}/`);

// The page exists once a campaign has a published file, so it joins the sweep then.
const figures = resolve(import.meta.dirname, '../../data/running/published/fundraising');
if (existsSync(figures) && readdirSync(figures).length > 0) PAGES.push('/running/fundraising/');

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
}

/** Opens the chart's table, where there is one, so axe reads it too. */
async function openTables(page: Page) {
  for (const summary of await page.locator('details summary').all()) await summary.click();
}

for (const path of PAGES) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${path}: passes axe in ${colorScheme} mode`, async ({ page }) => {
      sweepOnlyInDark(colorScheme);
      await page.emulateMedia({ colorScheme });
      await open(page, path);
      await openTables(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test(`${path}: passes axe in forced colours`, async ({ page }) => {
    test.skip(!fullSweep(), 'forced colours are swept in the phone project');
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, path);
    await openTables(page);
    expect(await axe(page)).toEqual([]);
  });

  test(`${path}: headings never skip a level`, async ({ page }) => {
    await open(page, path);
    await outline(page);
  });
}

for (const state of WITH_CARD) {
  test(`${state}: the card has its heading and a button edge in forced colours`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, `/fundraising-preview/${state}/`);
    await expect(page.getByRole('heading', { level: 3, name: 'Fundraising' })).toBeVisible();
    // The button's edge is what's left of it once forced colours drop the background.
    for (const donate of await page.getByRole('link', { name: 'Donate on JustGiving' }).all()) await expect(donate).not.toHaveCSS('border-top-style', 'none');
  });
}

test('the bar is a named meter with its figures in words (FR-061)', async ({ page }) => {
  await open(page, '/fundraising-preview/active/');
  const meter = page.locator('.fundraising-card').getByRole('meter');
  await expect(meter).toHaveAccessibleName('Fundraising target £2,000: progress');
  await expect(meter).toHaveAttribute('aria-valuetext', '£1,250 of £2,000, 62%');
  await expect(meter).toHaveAttribute('aria-valuenow', '62');
});

test('the article is named by its heading', async ({ page }) => {
  await open(page, '/fundraising-preview/active/');
  await expect(page.getByRole('article', { name: 'Fundraising' })).toBeVisible();
});

test('the page\'s sections are named by their headings', async ({ page }) => {
  await open(page, '/fundraising-preview/second-campaign/');
  await expect(page.getByRole('region', { name: 'Lakeside Half · 3 October 2027' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Past campaigns' })).toBeVisible();
  await expect(page.getByRole('figure', { name: 'The total so far' })).toBeVisible();
});

test('the chart has a text alternative, and its table a caption (FR-061)', async ({ page }) => {
  await open(page, '/fundraising-preview/active/');
  await expect(page.getByRole('img', { name: /Total raised by day/ })).toHaveAccessibleName(/£1,250 raised since 12 Oct 2026, 62% of the £2,000 target/);
  await page.locator('figure summary').click();
  await expect(page.getByRole('table', { name: 'The total so far' })).toBeVisible();
});
