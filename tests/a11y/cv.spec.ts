// The CV page's accessibility (spec 004 T063; WCAG 2.2 AA; contracts/timeline-ui.md), over the
// made-up previews typical and stress: zero axe violations at every level of the drill, in light and
// dark, and in forced colours on the phone project (boxes drawn by background keep a border); the
// heading outline; the trail's navigation named; and a Tab sweep of each level from the timeline's
// heading reaching every link and control of the level and the trail, each focused element fully in
// view and clear of the sticky trail. Without scripts, axe over the whole page in reading order.
import { expect, test, type Page } from '@playwright/test';
import { loadCv, type CvView } from '../../src/sections/cv/data/cv.ts';
import { previewStore } from '../fixtures/cv-preview/store.ts';
import { axe, fullSweep, outline, sweepOnlyInDark } from '../helpers/a11y.ts';

const STATES = ['typical', 'stress'] as const;

/** Every level of the drill, by its address: the overview, lists, and cards of each kind. */
function levels(cv: CvView): string[] {
  const t = cv.timeline;
  const theme = t.themes.find((th) => th.changes.some((c) => c.thread && c.story)) ?? t.themes[0]!;
  const change = theme.changes.find((c) => c.thread && c.story) ?? theme.changes[0]!;
  const thread = t.threads[0];
  return [
    '#cv',
    `#theme-${theme.theme.id}`,
    `#change-${change.id}`,
    ...(thread ? ['#threads', `#thread-${thread.thread.id}`, `#change-${thread.changes[0]!.id}-in-${thread.thread.id}`] : []),
    ...(t.roles.length > 0 ? ['#roles', `#role-${t.roles[0]!.id}`] : []),
    ...(t.next.length > 0 ? ['#next', `#next-${t.next[0]!.id}`] : []),
  ];
}

async function open(page: Page, state: string, hash: string) {
  const response = await page.goto(`/cv-preview/${state}/${hash}`);
  expect(response?.status(), state).toBe(200);
  await expect(page.locator('html')).toHaveClass(/cv-ready/);
}

for (const state of STATES) {
  const cv = loadCv(previewStore(state))!;
  for (const hash of levels(cv)) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${state} ${hash}: passes axe in ${colorScheme} mode`, async ({ page }) => {
        sweepOnlyInDark(colorScheme);
        await page.emulateMedia({ colorScheme });
        await open(page, state, hash);
        expect(await axe(page)).toEqual([]);
      });
    }

    test(`${state} ${hash}: passes axe in forced colours, boxes keeping their borders`, async ({ page }) => {
      test.skip(!fullSweep(), 'forced colours are swept in the phone project');
      await page.emulateMedia({ forcedColors: 'active' });
      await open(page, state, hash);
      expect(await axe(page)).toEqual([]);
      for (const box of await page.locator('#cv .cv-level.is-current :is(.cv-tile, .cv-row, .cv-step, .cv-follow a, .cv-value-panel, .cv-thread-panel)').all()) {
        await expect(box).not.toHaveCSS('border-top-style', 'none');
      }
    });

    test(`${state} ${hash}: headings in order, the trail named, and Tab reaches every link and control in view`, async ({ page }) => {
      await open(page, state, hash);
      await outline(page);
      const crumbs = page.getByRole('navigation', { name: 'Where you are in the timeline', exact: true });
      if (hash === '#cv') await expect(crumbs).toBeHidden();
      else await expect(crumbs).toBeVisible();

      // Tag every visible link and button of the trail and the level, then Tab from the timeline's heading.
      const total = await page.evaluate(() => {
        const els = [...document.querySelectorAll('#cv [data-crumbs] :is(a[href], button), #cv .cv-level.is-current :is(a[href], button)')].filter((el) => el.getClientRects().length > 0);
        els.forEach((el, i) => el.setAttribute('data-sweep', String(i)));
        return els.length;
      });
      expect(total).toBeGreaterThan(0);
      await page.locator('#cv-heading').focus();
      const seen = new Set<string>();
      for (let presses = 0; presses < total + 5 && seen.size < total; presses++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const crumbs = document.querySelector<HTMLElement>('#cv [data-crumbs]');
          const r = el?.getBoundingClientRect();
          const under = crumbs && !crumbs.hidden && !crumbs.contains(el) ? crumbs.getBoundingClientRect().bottom : 0;
          return el && r ? { sweep: el.getAttribute('data-sweep'), top: r.top, bottom: r.bottom, left: r.left, right: r.right, under, height: innerHeight, width: innerWidth, name: el.textContent?.trim().slice(0, 40) } : undefined;
        });
        if (!focused?.sweep) continue;
        seen.add(focused.sweep);
        expect(focused.top, `${focused.name} is clear of the trail`).toBeGreaterThanOrEqual(focused.under - 1);
        expect(focused.bottom, focused.name).toBeLessThanOrEqual(focused.height + 1);
        expect(focused.left, focused.name).toBeGreaterThanOrEqual(-1);
        expect(focused.right, focused.name).toBeLessThanOrEqual(focused.width + 1);
      }
      expect(seen.size, 'every link and control of the trail and the level was reached by Tab').toBe(total);
    });
  }

  // axe can't run in a page with JavaScript off (it waits on the page's own timers, and the run hangs),
  // so the no-script layout is checked by loading the page without its scripts' effects: the drill's
  // classes come off <html>, and every level shows in reading order, as it does without scripts
  // (tests/e2e/cv-noscript.spec.ts checks that page itself, with scripts off).
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${state}: the no-script layout (every level in order) passes axe in ${colorScheme} mode, headings in order`, async ({ page }) => {
      sweepOnlyInDark(colorScheme);
      // Every level shows at once: a long page for axe.
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme });
      await open(page, state, '');
      await page.evaluate(() => document.documentElement.classList.remove('cv-js', 'cv-ready'));
      await expect(page.locator('#cv .cv-level').last()).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await outline(page);
    });
  }
}
