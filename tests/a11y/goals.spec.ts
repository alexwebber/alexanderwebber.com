// The Goals page's accessibility (T095; WCAG 2.2 AA): zero axe violations in light and dark, a
// sound heading outline, progress bars exposed as named meters, and a keyboard path from the skip
// link through every link with a visible focus ring.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/running/goals/';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(page: Page) {
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('headings go h1 > h2 sections > h3 goal cards, without skipping a level', async ({ page }) => {
  await open(page);
  const levels = await page.locator('main :is(h1, h2, h3, h4, h5, h6)').evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { level: 2, name: 'Working towards' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Achieved' })).toBeVisible();
});

test('each progress bar is a named meter with its figures in words', async ({ page }) => {
  await open(page);
  for (const meter of await page.getByRole('meter').all()) {
    await expect(meter).toHaveAccessibleName(/: progress$/);
    await expect(meter).toHaveAttribute('aria-valuetext', /\S/);
  }
});

test('the keyboard reaches the skip link first, then every link, each with a visible focus ring', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  // Tab from the top through the whole page: every link is reached once, in DOM order, and shows
  // a focus outline.
  await page.goto(PATH);
  const links = await page.locator('a[href]').count();
  const reached: string[] = [];
  for (let i = 0; i < links + 5; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return undefined;
      const style = getComputedStyle(el);
      return { text: `${el.tagName}:${el.getAttribute('href') ?? ''} ${el.textContent?.trim()}`, outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 };
    });
    if (!focused || reached.includes(focused.text)) break;
    expect(focused.outline, focused.text).toBe(true);
    reached.push(focused.text);
  }
  expect(reached.filter((t) => t.startsWith('A:'))).toHaveLength(links);
  expect(reached).toContain('A:/running/goals/ Goals');
});
