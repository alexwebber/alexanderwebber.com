// Shared helpers for the Playwright accessibility specs (tests/a11y/).
//
// axe's rules (contrast, names, roles) don't change with the viewport, which the layout tests
// cover, so the full sweeps (dark mode, every range or toggle, every table open) run in the phone
// project only (mobile first). The desktop project runs axe once per page as it loads, in light
// mode.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The project that runs the full axe sweeps (playwright.config.ts). */
const SWEEP_PROJECT = 'mobile-360';

/** axe's WCAG 2.2 AA violations on the page as it stands, one line each (rule: targets). */
export async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** Headings in `main` start at h1 and never skip a level (hidden ones aside). */
export async function outline(page: Page): Promise<void> {
  const levels = await page.locator('main :is(h1, h2, h3, h4, h5, h6):visible').evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
}

/** True in the project that runs the full sweeps. Call inside a test. */
export function fullSweep(): boolean {
  return test.info().project.name === SWEEP_PROJECT;
}

/** Skips a dark-mode axe test outside the sweep project. Call inside a test. */
export function sweepOnlyInDark(colorScheme: 'light' | 'dark'): void {
  test.skip(colorScheme === 'dark' && !fullSweep(), 'dark mode is swept in the phone project');
}
