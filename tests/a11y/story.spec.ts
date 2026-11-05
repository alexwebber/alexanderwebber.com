// The journey story page's accessibility (spec 003 T038; FR-004, FR-074; WCAG 2.2 AA), over the
// test-only previews (SHELL_PREVIEW=1, tests/fixtures/story-preview/): zero axe violations in every
// state, in light, dark and forced colours, and the heading outline h1, then h2 per chapter and for
// the closing section, then h3 per takeaway. The takeaway's box in forced colours is also checked in
// tests/e2e/story.spec.ts, on both projects.
import { expect, test, type Page } from '@playwright/test';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const STATES = ['one-chapter', 'three-chapters', 'long', 'figures', 'no-closing', 'same-day'];

async function open(page: Page, state: string) {
  const response = await page.goto(`/story-preview/${state}/`);
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

  test(`${state}: passes axe in forced colours, the takeaway keeping its border and label`, async ({ page }) => {
    test.skip(!fullSweep(), 'forced colours are swept in the phone project');
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, state);
    expect(await axe(page)).toEqual([]);
    for (const box of await page.locator('.story-page .story-takeaway').all()) {
      await expect(box).not.toHaveCSS('border-left-style', 'none');
      await expect(box.getByRole('heading', { level: 3, name: 'What I learned', exact: true })).toBeVisible();
    }
  });

  test(`${state}: headings run h1, then h2 per chapter and closing section, then h3 per takeaway`, async ({ page }) => {
    await open(page, state);
    await outline(page);
    const levels = await page.locator('main :is(h1, h2, h3, h4, h5, h6)').evaluateAll((els) => els.map((el) => el.tagName.toLowerCase()));
    expect(levels.filter((l) => l === 'h1')).toHaveLength(1);
    expect(levels.some((l) => l === 'h4' || l === 'h5' || l === 'h6')).toBe(false);
    const chapters = await page.locator('.story-page section.story-chapter').count();
    const closing = await page.locator('.story-page section.story-closing').count();
    expect(levels.filter((l) => l === 'h2')).toHaveLength(chapters + closing);
    expect(levels.filter((l) => l === 'h3')).toHaveLength(chapters);
  });
}
