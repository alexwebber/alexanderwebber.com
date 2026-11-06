// The journey story page's accessibility (spec 003 T038; FR-004, FR-074; WCAG 2.2 AA), over the
// test-only previews (SHELL_PREVIEW=1, tests/fixtures/story-preview/): zero axe violations in every
// state, in light, dark and forced colours, and the heading outline h1, then h2 per chapter and for
// the closing section, then h3 per takeaway. The takeaway's box in forced colours is also checked in
// tests/e2e/story.spec.ts, on both projects. From four chapters on (T060; FR-052): axe with the
// chapter list closed and open, in light, dark and forced colours, and a keyboard path through the
// "Chapters" summary to a chapter and back.
import { expect, test, type Page } from '@playwright/test';
import { PREVIEW_STATES as STATES } from '../fixtures/story-preview/store.ts';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

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

// The chapter list, closed and open (FR-052). Closed is the sweep above; these open it first.
for (const state of ['four-chapters', 'long']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${state}: passes axe in ${colorScheme} mode with the chapter list open`, async ({ page }) => {
      sweepOnlyInDark(colorScheme);
      await page.emulateMedia({ colorScheme });
      await open(page, state);
      await page.locator('.story-page details.story-chapters > summary').click();
      await expect(page.locator('.story-page details.story-chapters')).toHaveAttribute('open');
      expect(await axe(page)).toEqual([]);
    });
  }

  test(`${state}: passes axe in forced colours with the list closed and open, its rules kept`, async ({ page }) => {
    test.skip(!fullSweep(), 'forced colours are swept in the phone project');
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, state);
    const list = page.locator('.story-page details.story-chapters');
    await expect(list).not.toHaveCSS('border-top-style', 'none');
    expect(await axe(page)).toEqual([]);
    await list.locator('summary').click();
    expect(await axe(page)).toEqual([]);
  });

  test(`${state}: the keyboard opens the list, reaches a chapter, and comes back to the list`, async ({ page }) => {
    await open(page, state);
    const list = page.locator('.story-page details.story-chapters');
    const focused = () => page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return `${el.tagName}:${el.getAttribute('href') ?? ''}:${el.textContent?.trim()}`;
    });
    // Tab from the top to the "Chapters" summary, and open it with Enter.
    for (let i = 0; i < 40 && (await focused()) !== 'SUMMARY::Chapters'; i++) await page.keyboard.press('Tab');
    expect(await focused()).toBe('SUMMARY::Chapters');
    await page.keyboard.press('Enter');
    await expect(list).toHaveAttribute('open');
    // The second chapter's name is two Tabs on; Enter follows it.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const link = list.locator('li').nth(1).locator('a');
    await expect(link).toBeFocused();
    const target = (await link.getAttribute('href'))!;
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    const chapter = page.locator(`.story-page section${target}`);
    await expect(chapter.getByRole('heading', { level: 2 })).toBeInViewport();
    // Tab on from the chapter to its "Back to chapters", fully in view when focused, then back.
    const back = chapter.locator('.story-back a');
    for (let i = 0; i < 10 && !(await back.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(back).toBeFocused();
    await expect(back).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#story-chapter-list$/);
    await expect(list.getByRole('list')).toBeInViewport();
    // The next Tab starts from the list: its first chapter.
    await page.keyboard.press('Tab');
    await expect(list.locator('li').first().locator('a')).toBeFocused();
  });
}

// Graduation (T072): in every state, Tab alone reaches every link and control in the story, each in
// view when focused (the chapter list opened first, so its links are reachable too).
for (const state of STATES) {
  test(`${state}: Tab reaches every link and control in the story, each in view when focused`, async ({ page }) => {
    await open(page, state);
    const story = page.locator('.story-page');
    // Opened without focusing it, so the first Tab starts at the top of the page.
    await story.locator('details.story-chapters').evaluateAll((els) => els.forEach((el) => ((el as HTMLDetailsElement).open = true)));
    const controls = await story.locator('a, summary').evaluateAll((els) => els.map((el, i) => (el.setAttribute('data-tab-check', String(i)), String(i))));
    // A state with no link in its text and fewer than four chapters (no-closing) has none to reach.
    const reached = new Set<string>();
    // Each control once, plus the page's links before and after the story, with room to spare.
    for (let i = 0; i < controls.length + 60 && reached.size < controls.length; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-tab-check') ?? null);
      if (id === null) continue;
      reached.add(id);
      // In view within a pixel: focus scrolling can leave an inline link a fraction of a pixel short.
      const box = (await story.locator(`[data-tab-check="${id}"]`).boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.y, `control ${id} top`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `control ${id} bottom`).toBeLessThanOrEqual(viewport.height + 1);
      expect(box.x, `control ${id} left`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `control ${id} right`).toBeLessThanOrEqual(viewport.width + 1);
    }
    expect([...reached].toSorted(), 'every link and control in the story').toEqual(controls.toSorted());
  });
}
