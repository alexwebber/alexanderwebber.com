// The Running menu on a phone (owner, 2026-11-06): one line that swipes sideways instead of
// wrapping, so a second line no longer pushes the landing page's Donate below the first screen.
// Only the list scrolls, never the page; it fades out at its end; the current page's link is
// scrolled into view on load (a small inline script), and a link that takes keyboard focus scrolls
// into view by itself. Without JavaScript the list starts at its beginning. Wider screens keep the
// plain row. Every Running page in the menu is checked, so a new area (e.g. Story) is covered.
import { expect, test, type Locator, type Page } from '@playwright/test';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Running', exact: true });
const list = (page: Page) => menu(page).getByRole('list');

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
}

/** The menu's lines: its items' distinct tops. */
const lines = (page: Page) => list(page).locator('li').evaluateAll((items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size);

/** The menu's links, from the landing page. */
async function menuPaths(page: Page): Promise<string[]> {
  await open(page, '/running/');
  const hrefs = await menu(page).getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(4);
  return hrefs;
}

/** How far a link sits outside the list's clear part (inside its padding, before the fade): 0 if fully shown. */
const outside = (link: Locator) =>
  link.evaluate((a) => {
    const ul = a.closest('ul')!;
    const box = ul.getBoundingClientRect();
    const style = getComputedStyle(ul);
    const left = box.left + parseFloat(style.paddingLeft);
    const right = box.right - parseFloat(style.paddingRight);
    const r = a.getBoundingClientRect();
    return Math.max(0, left - r.left, r.right - right);
  });

test.describe('on a phone', () => {
  for (const width of [360, 320]) {
    test(`at ${width} px the menu is one line that scrolls on its own, and no page scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 640 });
      for (const path of await menuPaths(page)) {
        await open(page, path);
        expect(await lines(page), path).toBe(1);
        const sizes = await list(page).evaluate((ul) => ({ scroll: ul.scrollWidth, client: ul.clientWidth, overflow: getComputedStyle(ul).overflowX }));
        expect(sizes.scroll, path).toBeGreaterThan(sizes.client);
        expect(sizes.overflow, path).toBe('auto');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBe(0);
      }
    });
  }

  test("each page's own link is fully in view, clear of the fade, as the page opens", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const path of await menuPaths(page)) {
      await open(page, path);
      const current = menu(page).locator('a[aria-current="page"]');
      await expect(current, path).toHaveAttribute('href', path);
      expect(await outside(current), path).toBeLessThan(1);
    }
  });

  test('the list fades out at its end, and the last link shows clearly once scrolled to', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page, '/running/');
    expect(await list(page).evaluate((ul) => getComputedStyle(ul).maskImage)).toMatch(/linear-gradient/);
    const last = menu(page).getByRole('link').last();
    expect(await outside(last)).toBeGreaterThan(0);
    await list(page).evaluate((ul) => { ul.scrollLeft = ul.scrollWidth; });
    expect(await outside(last)).toBeLessThan(1);
  });

  test('a link reached by keyboard scrolls into view', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page, '/running/');
    const last = menu(page).getByRole('link').last();
    expect(await outside(last)).toBeGreaterThan(0);
    await last.focus();
    await expect(last).toBeFocused();
    await expect.poll(() => list(page).evaluate((ul) => ul.scrollLeft)).toBeGreaterThan(0);
    // Focus scrolls the link into the list's box; the end padding (the fade's width) may still overlap it.
    expect(await last.evaluate((a) => a.getBoundingClientRect().right <= a.closest('ul')!.getBoundingClientRect().right + 0.5)).toBe(true);
  });

  test.describe('with JavaScript off', () => {
    test.use({ javaScriptEnabled: false });

    test('the list starts at its beginning, and every link is still there', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      const paths = await menuPaths(page);
      await open(page, paths.at(-1)!);
      expect(await list(page).evaluate((ul) => ul.scrollLeft)).toBe(0);
      await expect(menu(page).getByRole('link')).toHaveCount(paths.length);
    });
  });
});

test('on a desktop the menu is a plain row: one line, nothing to scroll, no fade', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of await menuPaths(page)) {
    await open(page, path);
    expect(await lines(page), path).toBe(1);
    const state = await list(page).evaluate((ul) => ({ scroll: ul.scrollWidth, client: ul.clientWidth, mask: getComputedStyle(ul).maskImage }));
    expect(state.scroll, path).toBeLessThanOrEqual(state.client);
    expect(state.mask, path).toBe('none');
  }
});
