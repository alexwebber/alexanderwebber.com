// The CV's phone drill (spec 004 T061; US1, US2, SC-003, SC-007; quickstart.md §3;
// contracts/timeline-ui.md *The drill*), over the made-up previews (SHELL_PREVIEW=1,
// tests/fixtures/cv-preview/) in the mobile-360 project at 320, 375 and 768 px:
// - the first screen shows the name, the headline and the start of the pitch (US1 scenario 1);
// - the overview shows every theme, roles, threads and where next; a tile leads to its list and a
//   row to its card: any card in two taps (SC-007);
// - the trail appears from the list on and names where you are; the back control, the browser's back
//   button and Escape each go up one level, focus on the level's heading going in and back on the
//   tile or row coming out;
// - previous and next walk the list and stop at the ends; "Follow this thread" then walks the thread;
// - a value change's panel reaches its value story, focus on the story;
// - a shared #change-<id> link opens that card, and its back control and Escape go to its theme's
//   list without leaving the page;
// - two columns of tiles at 768 px; no sideways scroll and no two boxes overlapping at 320 px in any
//   state, at every level.
// Expectations come from the preview's data (loadCv). Locators are scoped to #cv, names exact.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadCv, type ChangeView, type CvView } from '../../src/sections/cv/data/cv.ts';
import { PREVIEW_STATES, previewStore } from '../fixtures/cv-preview/store.ts';

const WIDTHS = [320, 375, 768] as const;
const typical = loadCv(previewStore('typical'))!;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'the drill at phone widths; the landscape form from 1024 px is slice 3');
});

async function open(page: Page, state: string, hash = '') {
  // From a blank page each time: a new #hash on the same page is a same-document navigation, which has no response.
  await page.goto('about:blank');
  const response = await page.goto(`/cv-preview/${state}/${hash}`);
  expect(response?.status(), state).toBe(200);
  await expect(page.locator('html')).toHaveClass(/cv-ready/);
}

const timeline = (page: Page) => page.locator('#cv');
const level = (page: Page) => page.locator('#cv .cv-level.is-current');
const tile = (page: Page, href: string) => timeline(page).locator(`a.cv-tile[href="${href}"]`);
const row = (page: Page, href: string) => level(page).locator(`a.cv-row[href="${href}"]`);
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Where you are in the timeline', exact: true });
const back = (page: Page) => crumbs(page).getByRole('button');

/** A theme with at least three changes, one of them in a thread and one adding value. */
function richTheme(cv: CvView) {
  return cv.timeline.themes.find((t) => t.changes.length >= 3 && t.changes.some((c) => c.thread) && t.changes.some((c) => c.story))!;
}

/** The visible boxes matched by `selector` inside `scope` overlap nowhere (within half a pixel). */
async function noOverlap(scope: Locator, selector: string): Promise<void> {
  const overlaps = await scope.evaluate((root, sel) => {
    const boxes = [...root.querySelectorAll(sel)].filter((el) => el.getClientRects().length > 0).map((el) => ({ el, r: el.getBoundingClientRect() }));
    const out: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!.r;
        const b = boxes[j]!.r;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) out.push(`${boxes[i]!.el.textContent?.trim().slice(0, 30)} / ${boxes[j]!.el.textContent?.trim().slice(0, 30)}`);
      }
    }
    return out;
  }, selector);
  expect(overlaps, selector).toEqual([]);
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
    });

    test('US1.1: the first screen shows the name, the headline and the start of the pitch', async ({ page }) => {
      await open(page, 'typical');
      const height = page.viewportSize()!.height;
      for (const el of [page.getByRole('heading', { level: 1, name: typical.page.name, exact: true }), page.getByText(typical.page.headline, { exact: true }), page.locator(`[data-cv-item="block:${typical.pitch.id}"] p`).first()]) {
        const box = (await el.boundingBox())!;
        expect(box.y, (await el.textContent()) ?? '').toBeLessThan(height - 24);
      }
    });

    test('the overview shows every theme, then roles, threads and where next', async ({ page }) => {
      await open(page, 'typical');
      const names = await level(page).locator('.cv-tile-name').allTextContents();
      expect(names).toEqual([...typical.timeline.themes.map((t) => t.theme.name), 'Roles', 'Threads', 'Where next']);
      await expect(crumbs(page)).toBeHidden();
    });

    test('SC-007: any card in two taps; the trail names where you are; back, browser back and Escape each go up one level', async ({ page }) => {
      const theme = richTheme(typical);
      const change = theme.changes[1]!;
      await open(page, 'typical');

      // Tap 1: a theme's tile.
      await tile(page, `#theme-${theme.theme.id}`).click();
      await expect(page).toHaveURL(new RegExp(`#theme-${theme.theme.id}$`));
      await expect(page.locator(`#theme-${theme.theme.id}`)).toBeFocused();
      await expect(crumbs(page)).toBeVisible();
      await expect(crumbs(page).locator('li')).toHaveText(['Themes', theme.theme.name]);
      await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(theme.theme.name);
      await expect(level(page).locator('a.cv-row')).toHaveCount(theme.changes.length);

      // Tap 2: a change's row.
      await row(page, `#change-${change.id}`).click();
      await expect(page.locator(`#change-${change.id}`)).toBeFocused();
      await expect(page.locator(`#change-${change.id}`)).toBeInViewport();
      await expect(crumbs(page).locator('li')).toHaveText(['Themes', theme.theme.name, change.item.label]);
      await expect(back(page)).toHaveAccessibleName(`Back to ${theme.theme.name}`);

      // The back control: up to the list, focus on the row that led in.
      await back(page).click();
      await expect(page).toHaveURL(new RegExp(`#theme-${theme.theme.id}$`));
      await expect(row(page, `#change-${change.id}`)).toBeFocused();
      await expect(row(page, `#change-${change.id}`)).toBeInViewport();

      // The browser's back button: from the card again, then from the list to the overview.
      await row(page, `#change-${change.id}`).click();
      await expect(page.locator(`#change-${change.id}`)).toBeFocused();
      await page.goBack();
      await expect(row(page, `#change-${change.id}`)).toBeFocused();
      await page.goBack();
      await expect(level(page)).toHaveClass(/cv-overview/);
      await expect(tile(page, `#theme-${theme.theme.id}`)).toBeFocused();
      await expect(crumbs(page)).toBeHidden();

      // Escape: in and out again.
      await tile(page, `#theme-${theme.theme.id}`).click();
      await row(page, `#change-${change.id}`).click();
      await page.keyboard.press('Escape');
      await expect(row(page, `#change-${change.id}`)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(tile(page, `#theme-${theme.theme.id}`)).toBeFocused();
      await expect(page).toHaveURL(/\/cv-preview\/typical\//);
    });

    test('previous and next walk the list and stop at the ends', async ({ page }) => {
      const theme = richTheme(typical);
      const [first, second] = theme.changes as [ChangeView, ChangeView];
      const last = theme.changes.at(-1)!;
      await open(page, 'typical', `#change-${first.id}`);
      const steps = level(page).locator('.cv-steps:visible');
      await expect(steps.locator('[aria-disabled="true"]')).toHaveText(['Previous']);
      await steps.getByRole('link', { name: `Next: ${second.item.label}`, exact: true }).click();
      await expect(page.locator(`#change-${second.id}`)).toBeFocused();
      await steps.getByRole('link', { name: `Previous: ${first.item.label}`, exact: true }).click();
      await expect(page.locator(`#change-${first.id}`)).toBeFocused();
      await open(page, 'typical', `#change-${last.id}`);
      await expect(level(page).locator('.cv-steps:visible [aria-disabled="true"]')).toHaveText(['Next']);
      // Previous and next replace the entry, so the back control still goes up a level.
      await level(page).locator('.cv-steps:visible').getByRole('link', { name: /^Previous: / }).click();
      await back(page).click();
      await expect(level(page).locator('h3').first()).toHaveText(theme.theme.name);
    });

    test('"Follow this thread" opens the change in its thread, which then walks the thread', async ({ page }) => {
      const thread = typical.timeline.threads.find((t) => t.changes.length >= 3) ?? typical.timeline.threads[0]!;
      const [first, second] = thread.changes as [ChangeView, ChangeView];
      await open(page, 'typical', `#change-${first.id}`);
      await level(page).getByRole('link', { name: 'Follow this thread', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#change-${first.id}-in-${thread.thread.id}$`));
      await expect(page.locator(`#change-${first.id}`)).toBeFocused();
      await expect(level(page).locator('.cv-thread-place')).toHaveText(`Thread · 1 of ${thread.changes.length}: ${thread.thread.name}`);
      await expect(level(page).getByRole('link', { name: `See it in ${first.theme.name}`, exact: true })).toBeVisible();
      await expect(crumbs(page).locator('li')).toHaveText(['Themes', 'Threads', thread.thread.name, first.item.label]);
      await level(page).locator('.cv-steps:visible').getByRole('link', { name: `Next: ${second.item.label}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#change-${second.id}-in-${thread.thread.id}$`));
      await expect(level(page).locator('.cv-thread-place')).toHaveText(`Thread · 2 of ${thread.changes.length}: ${thread.thread.name}`);
      // Up a level from inside the thread: the thread's list.
      await page.keyboard.press('Escape');
      await expect(page.locator(`#thread-${thread.thread.id}`)).toBeVisible();
      await expect(level(page).locator(`a.cv-row[href="#change-${second.id}-in-${thread.thread.id}"]`)).toBeFocused();
    });

    test("a value change's panel reaches its value story, focus on the story", async ({ page }) => {
      const change = typical.timeline.changes.find((c) => c.story)!;
      await open(page, 'typical', `#change-${change.id}`);
      await level(page).getByRole('link', { name: `Read the value story: ${change.story!.title}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#value-${change.story!.id}$`));
      await expect(page.locator(`#value-${change.story!.id}`)).toBeFocused();
      await expect(page.locator(`#value-${change.story!.id}`)).toBeInViewport();
      // The timeline stays where it was.
      await expect(page.locator(`#change-${change.id}`)).toBeVisible();
    });

    test('a shared #change link opens its card; back and Escape go to its theme list without leaving the page', async ({ page }) => {
      const change = richTheme(typical).changes[2]!;
      for (const leave of ['back', 'escape'] as const) {
        await page.goto('about:blank');
        await open(page, 'typical', `#change-${change.id}`);
        await expect(level(page)).toHaveClass(/cv-card/);
        await expect(page.locator(`#change-${change.id}`)).toBeFocused();
        await expect(page.locator(`#change-${change.id}`)).toBeInViewport();
        if (leave === 'back') await back(page).click();
        else await page.keyboard.press('Escape');
        await expect(page).toHaveURL(new RegExp(`/cv-preview/typical/#theme-${change.theme.id}$`));
        await expect(row(page, `#change-${change.id}`)).toBeFocused();
        await back(page).click();
        await expect(page).toHaveURL(/\/cv-preview\/typical\/#cv$/);
        await expect(level(page)).toHaveClass(/cv-overview/);
      }
    });

    test('an unknown timeline address shows the overview; other addresses change nothing', async ({ page }) => {
      await open(page, 'typical', '#change-no-such-change');
      await expect(level(page)).toHaveClass(/cv-overview/);
      await open(page, 'typical', '#main');
      await expect(level(page)).toHaveClass(/cv-overview/);
    });
  });
}

test('tiles sit in two columns at 768 px and one at 375', async ({ page }) => {
  for (const [width, columns] of [[768, 2], [375, 1]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'typical');
    const lefts = await level(page).locator('.cv-tiles').first().locator('a.cv-tile').evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size);
    expect(lefts, `${width} px`).toBe(columns);
  }
});

for (const state of PREVIEW_STATES) {
  test(`${state}: no sideways scroll and no two boxes overlapping at 320 px, at every level`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    const cv = loadCv(previewStore(state))!;
    const { timeline: t } = cv;
    const first = t.themes[0]!;
    const hashes = [
      '',
      `#theme-${first.theme.id}`,
      ...t.themes.map((th) => `#change-${th.changes.at(-1)!.id}`),
      ...(t.roles.length > 0 ? ['#roles', `#role-${t.roles.at(-1)!.id}`] : []),
      ...(t.threads.length > 0 ? ['#threads', `#thread-${t.threads[0]!.thread.id}`, `#change-${t.threads[0]!.changes[0]!.id}-in-${t.threads[0]!.thread.id}`] : []),
      ...(t.next.length > 0 ? ['#next', `#next-${t.next.at(-1)!.id}`] : []),
    ];
    for (const hash of hashes) {
      await open(page, state, hash);
      expect(await sideways(page), `${state}${hash}`).toBe(0);
      await noOverlap(level(page), 'a.cv-tile, a.cv-row');
      await noOverlap(level(page), '.cv-axis-row:not([aria-hidden]) time');
      await noOverlap(level(page), '.cv-step, .cv-follow a');
      await noOverlap(level(page), ':scope > :is(p, h3, div, ol, ul)');
      if (hash) await noOverlap(crumbs(page), '.cv-back, .cv-trail li');
    }
  });
}
