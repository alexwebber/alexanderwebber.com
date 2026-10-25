// The landing page's and run pages' accessibility (T109; WCAG 2.2 AA): zero axe violations in light
// and dark, a sound heading outline, progress bars and the chart exposed with their figures in
// words, and a keyboard path from the skip link through every link with a visible focus ring.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const PATH = '/running/';
const runsDir = resolve(import.meta.dirname, '../../data/running/published/runs');
const runIds = readdirSync(runsDir).flatMap((year) => readdirSync(join(runsDir, year)).map((f) => f.replace(/\.json$/, '')));

async function open(page: Page, path = PATH) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
    sweepOnlyInDark(colorScheme);
    await page.emulateMedia({ colorScheme });
    await open(page);
    expect(await axe(page)).toEqual([]);
    if (!fullSweep()) return;
    // The chart's data table, opened.
    await page.locator('[data-training-build] summary').first().click();
    expect(await axe(page)).toEqual([]);
  });

  test(`a run page passes axe in ${colorScheme} mode`, async ({ page }) => {
    test.skip(runIds.length === 0, 'no runs published');
    sweepOnlyInDark(colorScheme);
    await page.emulateMedia({ colorScheme });
    await open(page, `/running/runs/${runIds.sort().at(-1)}/`);
    expect(await axe(page)).toEqual([]);
  });
}

test('headings never skip a level', async ({ page }) => {
  await open(page);
  await outline(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Goals' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'This week' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Latest run' })).toBeVisible();
});

test('each progress bar is a named meter with its figures in words, and the chart has a text alternative', async ({ page }) => {
  await open(page);
  for (const meter of await page.getByRole('meter').all()) {
    await expect(meter).toHaveAccessibleName(/: progress$/);
    await expect(meter).toHaveAttribute('aria-valuetext', /\S/);
  }
  const chart = page.locator('[data-training-build] svg[role="img"]');
  if ((await chart.count()) > 0) await expect(chart).toHaveAccessibleName(/Weekly distance in the training build Weekly distance since/); // title, then desc (aria-labelledby)
});

test('the keyboard reaches the skip link first, then every link and control, each with a visible focus ring', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  // Tab from the top through the whole page. Focus stops are keyed on the element, its href and its
  // text, since several links share an href (the nav's Goals, "All goals" and the section link).
  await page.goto(PATH);
  const links = await page.locator('a[href]').count();
  const reached: string[] = [];
  for (let i = 0; i < links + 10; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return undefined;
      const style = getComputedStyle(el);
      return { text: `${el.tagName}:${el.getAttribute('href') ?? ''} ${el.textContent?.trim().replace(/\s+/g, ' ')}`, outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 };
    });
    if (!focused || reached.includes(focused.text)) break;
    expect(focused.outline, focused.text).toBe(true);
    reached.push(focused.text);
  }
  expect(reached.filter((t) => t.startsWith('A:'))).toHaveLength(links);
  expect(reached.some((t) => t.startsWith('SUMMARY:'))).toBe(true); // the chart's data table
});
