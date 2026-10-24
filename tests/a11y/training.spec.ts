// The Training area's accessibility (T123; WCAG 2.2 AA): zero axe violations on the hub, a year
// page and a full run page, in light and dark and with every toggle option and data table open; a
// sound heading outline; charts exposed with their key message; and the toggles reachable and
// operable from the keyboard.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const runsDir = resolve(import.meta.dirname, '../../data/running/published/runs');
const runIds = readdirSync(runsDir)
  .flatMap((year) => readdirSync(join(runsDir, year)).map((f) => f.replace(/\.json$/, '')))
  .sort();
const latestYear = runIds.at(-1)?.slice(0, 4);

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function outline(page: Page) {
  const levels = await page.locator('main :is(h1, h2, h3, h4, h5, h6):visible').evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
}

/** Every option of every toggle, each followed by an axe run. */
async function eachToggle(page: Page, check: () => Promise<void>) {
  for (const label of await page.locator('fieldset.toggle label').all()) {
    await label.click();
    await check();
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the hub passes axe in ${colorScheme} mode, in every view and with the tables open`, async ({ page }) => {
    // About eight full-page axe runs: ~10 s locally, past the 30 s default on the 2-core CI runner.
    test.slow();
    await page.emulateMedia({ colorScheme });
    await page.goto('/running/training/');
    expect(await axe(page)).toEqual([]);
    await eachToggle(page, async () => expect(await axe(page)).toEqual([]));
    for (const summary of await page.locator('details summary:visible').all()) await summary.click();
    expect(await axe(page)).toEqual([]);
  });

  test(`a year page and the latest run page pass axe in ${colorScheme} mode`, async ({ page }) => {
    test.skip(runIds.length === 0, 'no runs published');
    await page.emulateMedia({ colorScheme });
    await page.goto(`/running/training/${latestYear}/`);
    expect(await axe(page)).toEqual([]);
    await page.goto(`/running/runs/${runIds.at(-1)}/`);
    expect(await axe(page)).toEqual([]);
    await eachToggle(page, async () => expect(await axe(page)).toEqual([]));
    for (const summary of await page.locator('details summary:visible').all()) await summary.click();
    expect(await axe(page)).toEqual([]);
  });
}

test('headings never skip a level on the hub, a year page and a run page', async ({ page }) => {
  await page.goto('/running/training/');
  await outline(page);
  test.skip(runIds.length === 0, 'no runs published');
  await page.goto(`/running/training/${latestYear}/`);
  await outline(page);
  await page.goto(`/running/runs/${runIds.at(-1)}/`);
  await outline(page);
});

test('charts carry their key message, and the toggles work from the keyboard', async ({ page }) => {
  test.skip(runIds.length === 0, 'no runs published');
  await page.goto('/running/training/');
  await expect(page.locator('[data-period="week"] svg[role="img"]').first()).toHaveAccessibleName(/^Distance by week The last \d+ weeks: /);
  const months = page.getByRole('radio', { name: 'Months' });
  await page.getByRole('radio', { name: 'Weeks' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(months).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Distance by month' })).toBeVisible();

  await page.goto(`/running/runs/${runIds.at(-1)}/`);
  const time = page.getByRole('radio', { name: 'Time' });
  if ((await time.count()) > 0) {
    await page.getByRole('radio', { name: 'Distance' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(time).toBeChecked();
    await expect(page.locator('[data-axis="time"] svg[role="img"]').first()).toHaveAccessibleName(/against elapsed time/);
  }
});
