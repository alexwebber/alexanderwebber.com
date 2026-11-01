// The fundraising card's accessibility (T060; FR-060, FR-061, SC-010; WCAG 2.2 AA), over the
// test-only previews: zero axe violations in every state, in light, dark and forced colours, a
// sound heading outline, and the bar exposed with its figures in words. The real card is swept
// with the landing page in tests/a11y/landing.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const STATES = ['active', 'no-target', 'zero', 'beaten', 'stale'];

async function open(page: Page, state: string) {
  const response = await page.goto(`/fundraising-preview/${state}/`);
  expect(response?.status(), state).toBe(200);
}

for (const state of STATES) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${state}: passes axe in ${colorScheme} mode`, async ({ page }) => {
      sweepOnlyInDark(colorScheme);
      await page.emulateMedia({ colorScheme });
      await open(page, state);
      expect(await axe(page)).toEqual([]);
    });
  }

  test(`${state}: passes axe in forced colours`, async ({ page }) => {
    test.skip(!fullSweep(), 'forced colours are swept in the phone project');
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, state);
    expect(await axe(page)).toEqual([]);
    // The button's edge is what's left of it once forced colours drop the background.
    await expect(page.getByRole('link', { name: 'Donate on JustGiving' })).not.toHaveCSS('border-top-style', 'none');
  });

  test(`${state}: headings never skip a level`, async ({ page }) => {
    await open(page, state);
    await outline(page);
    await expect(page.getByRole('heading', { level: 3, name: 'Fundraising' })).toBeVisible();
  });
}

test('the bar is a named meter with its figures in words (FR-061)', async ({ page }) => {
  await open(page, 'active');
  const meter = page.getByRole('meter');
  await expect(meter).toHaveAccessibleName('Fundraising target £2,000: progress');
  await expect(meter).toHaveAttribute('aria-valuetext', '£1,250 of £2,000, 62%');
  await expect(meter).toHaveAttribute('aria-valuenow', '62');
});

test('the article is named by its heading', async ({ page }) => {
  await open(page, 'active');
  await expect(page.getByRole('article', { name: 'Fundraising' })).toBeVisible();
});
