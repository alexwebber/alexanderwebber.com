// The Training hub and year pages in a real browser (T123; US3.1, US3.5, US3.6, contracts/routes.md).
// Invariants that hold whatever the refresh bot has published: the period switch works without
// JS, every published run is reachable from a year page, newest first by month, treadmill runs
// are labelled, "Races only" lists only races, and the layout fits 320px. Exact wording over
// pinned fixtures is in tests/unit/training.test.ts and periods.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/running/training/';
const runsDir = resolve(import.meta.dirname, '../../data/running/published/runs');
interface PublishedRun {
  id: string;
  date: string;
  treadmill: boolean;
  is_race: boolean;
}
const runs: PublishedRun[] = readdirSync(runsDir).flatMap((year) =>
  readdirSync(join(runsDir, year)).map((file) => JSON.parse(readFileSync(join(runsDir, year, file), 'utf8')) as PublishedRun),
);
const years = [...new Set(runs.map((r) => r.date.slice(0, 4)))].sort().reverse();

async function open(page: Page, path = PATH) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
}

test('has its own title, share image and nav entry, with Garmin attribution under the heading', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Training · Running · Alexander Webber');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/\/og\/running-training\.png$/);
  expect((await page.request.get(new URL(image!).pathname)).status()).toBe(200);
  await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Training' })).toHaveAttribute('aria-current', 'page');
  if (runs.length) await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveText(/^Source: Garmin/);
});

test('US3.1: opens on weeks; months and years switch in without JS', async ({ browser }) => {
  test.skip(runs.length === 0, 'no runs published');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await open(page);
  const totals = page.locator('[data-period-totals]');
  await expect(totals.getByRole('heading', { name: 'Distance by week' })).toBeVisible();
  await expect(totals.getByRole('heading', { name: 'Distance by month' })).toBeHidden();
  await totals.getByText('Months', { exact: true }).click();
  // The clicked option's radio takes focus but stays hidden, so the options don't shift.
  const radio = await totals.locator('fieldset.toggle input[value="month"]').boundingBox();
  expect(radio!.width).toBeLessThanOrEqual(1);
  await expect(totals.getByRole('heading', { name: 'Distance by month' })).toBeVisible();
  await expect(totals.getByRole('heading', { name: 'Moving time by month' })).toBeVisible();
  await expect(totals.getByRole('heading', { name: 'Distance by week' })).toBeHidden();
  await totals.getByText('Years', { exact: true }).click();
  await expect(totals.locator('[data-period="year"] [data-current-period]')).toContainText('This year');
  // At most 26 weekly columns.
  expect(await totals.locator('[data-period="week"] .bars').first().locator('li').count()).toBeLessThanOrEqual(26);
  await expect(page.locator('[data-all-time]')).toContainText(/Runs\s*\d+/);
  await context.close();
});

test('US3.5: every run is reachable from its year page, newest first, grouped by month', async ({ page }) => {
  test.skip(runs.length === 0, 'no runs published');
  await open(page);
  const hrefs = await page.locator('[data-year-links] a').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual(years.map((y) => `/running/training/${y}/`));
  const listed: string[] = [];
  for (const year of years) {
    await open(page, `/running/training/${year}/`);
    const all = page.locator('[data-view="all"]');
    const ids = await all.locator('[data-run-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-run-id')!));
    const dates = ids.map((id) => id.slice(0, 10));
    expect(dates, year).toEqual([...dates].sort().reverse());
    const months = await all.locator('[data-month]').evaluateAll((els) => els.map((el) => el.getAttribute('data-month')!));
    expect(months, year).toEqual([...new Set(dates.map((d) => d.slice(0, 7)))]);
    listed.push(...ids);
  }
  expect(listed.sort()).toEqual(runs.map((r) => r.id).sort());
});

test('US3.6: treadmill runs carry the label in the list; "Races only" shows only races', async ({ page }) => {
  test.skip(runs.length === 0, 'no runs published');
  const year = years[0]!;
  await open(page, `/running/training/${year}/`);
  for (const run of runs.filter((r) => r.date.startsWith(year))) {
    const row = page.locator(`[data-view="all"] [data-run-id="${run.id}"]`);
    await expect(row.locator('[data-treadmill]'), run.id).toHaveCount(run.treadmill ? 1 : 0);
    await expect(row.locator('.race-badge'), run.id).toHaveCount(run.is_race ? 1 : 0);
  }
  await page.getByText('Races only', { exact: true }).click();
  const races = page.locator('[data-view="races"]');
  await expect(page.locator('[data-view="all"]')).toBeHidden();
  const shown = await races.locator('[data-run-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-run-id')!));
  expect(shown.sort()).toEqual(runs.filter((r) => r.is_race && r.date.startsWith(year)).map((r) => r.id).sort());
  if (shown.length === 0) await expect(races).toContainText('No races yet.');
});

test('lists show the date only, never a time of day (FR-011), and fit 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of [PATH, ...years.map((y) => `/running/training/${y}/`)]) {
    await open(page, path);
    expect(await page.content(), path).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    // Whatever the font: a column's value label stays inside its plot, so it can't reach the page edge.
    const escaped = await page.locator('.bar-value:visible').evaluateAll((els) =>
      els.filter((el) => el.getBoundingClientRect().right > el.closest('.chart-plot')!.getBoundingClientRect().right + 0.5).map((el) => el.textContent),
    );
    expect(escaped, path).toEqual([]);
  }
});
