// The Races area's accessibility (T137; WCAG 2.2 AA): zero axe violations on the real races page
// and on the race preview's races page and race pages (synthetic races, SHELL_PREVIEW=1), in light
// and dark, with every table open; a sound heading outline; the static map exposed as an image
// with its text alternative; and the map button reachable and operable from the keyboard.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES = ['/running/races/', '/race-preview/', '/race-preview/riverside-half-2026/', '/race-preview/indoor-5k-2026/', '/race-preview/2019-example-10k/'];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function outline(page: Page) {
  const levels = await page.locator('main :is(h1, h2, h3, h4, h5, h6):visible').evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the races pages and race pages pass axe in ${colorScheme} mode, with the tables open`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme });
    for (const path of PAGES) {
      await page.goto(path);
      expect(await axe(page), path).toEqual([]);
      for (const summary of await page.locator('details summary:visible').all()) await summary.click();
      expect(await axe(page), `${path} (tables open)`).toEqual([]);
    }
  });
}

test('every page has a sound heading outline', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await outline(page);
  }
});

test('the static map is an image with a text alternative, and its labels are hidden from screen readers', async ({ page }) => {
  await page.goto('/race-preview/riverside-half-2026/');
  const map = page.getByRole('img', { name: 'Route of Riverside Half Marathon' });
  await expect(map).toBeVisible();
  await expect(map).toHaveAccessibleDescription(/21\.1 km from the start \(S\) to the finish \(F\), with a marker every 2 km/);
  expect(await page.locator('[data-km-marker]').evaluateAll((els) => els.every((el) => el.getAttribute('aria-hidden') === 'true'))).toBe(true);
});

test('the map button is reachable and operable from the keyboard', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
  await page.goto('/race-preview/riverside-half-2026/');
  const button = page.getByRole('button', { name: 'Load interactive map' });
  for (let i = 0; i < 80 && !(await button.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-map-status]')).not.toBeEmpty();
  expect(await axe(page)).toEqual([]);
});
