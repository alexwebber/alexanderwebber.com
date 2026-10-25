// The Health area's accessibility (T144; WCAG 2.2 AA): zero axe violations on the real health page
// and the health preview (synthetic data with lab results, SHELL_PREVIEW=1), in light and dark,
// in every range and with every data table open; a sound heading outline; charts exposed as images
// with their key message; and the range choice operable from the keyboard.
import { expect, test } from '@playwright/test';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const PAGES = ['/running/health/', '/health-preview/'];

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the health pages pass axe in ${colorScheme} mode, in every range and with the tables open`, async ({ page }) => {
    sweepOnlyInDark(colorScheme);
    test.slow();
    await page.emulateMedia({ colorScheme });
    for (const path of PAGES) {
      await page.goto(path);
      expect(await axe(page), path).toEqual([]);
      if (!fullSweep()) continue;
      for (const range of ['3 months', 'All time']) {
        for (const label of await page.locator('fieldset.range-toggle label', { hasText: range }).all()) await label.click();
        expect(await axe(page), `${path} (${range})`).toEqual([]);
      }
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

test('charts carry their key message, and the range choice works from the keyboard', async ({ page }) => {
  await page.goto('/running/health/');
  const weight = page.locator('figure.chart-figure').filter({ has: page.getByRole('heading', { name: 'Weight', exact: true }) });
  await expect(weight.locator('[data-range="1y"] svg[role="img"]')).toHaveAccessibleName(/^Weight, last year From [\d.]+ kg on \d+ \w+ \d{4} to [\d.]+ kg on \d+ \w+ \d{4}\. Target [\d.]+ kg\./);
  // The ranges on offer follow the data ("All time" only once it adds a month over "1 year"), so
  // walk whatever the chart offers: arrow keys move between native radios and wrap round.
  const ranges = await weight.locator('fieldset.range-toggle input[type="radio"]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  expect(ranges.length).toBeGreaterThanOrEqual(2);
  const radio = (i: number) => weight.locator(`fieldset.range-toggle input[value="${ranges[(i + ranges.length) % ranges.length]}"]`);
  const panel = (i: number) => weight.locator(`[data-range="${ranges[(i + ranges.length) % ranges.length]}"] svg`);
  const start = ranges.indexOf('1y');
  await expect(radio(start)).toBeChecked();
  await radio(start).focus();
  await page.keyboard.press('ArrowRight');
  await expect(radio(start + 1)).toBeChecked();
  await expect(panel(start + 1)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(radio(start - 1)).toBeChecked();
  await expect(panel(start - 1)).toBeVisible();
});
