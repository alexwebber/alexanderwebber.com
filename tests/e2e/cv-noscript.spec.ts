// The CV without scripts (spec 004 T062; FR-014, SC-006; contracts/timeline-ui.md *Without
// scripts*), over the made-up previews: every level renders in reading order (the overview, then each
// list, then each card); every tile, row, "Back to themes" and "Follow this thread" link lands on an
// id on the page; every card's text is there to read; the email reads in words with no mailto:; and
// the page makes no request outside its own origin, with scripts off and on.
import { expect, test, type Page } from '@playwright/test';
import { loadCv } from '../../src/sections/cv/data/cv.ts';
import { PREVIEW_STATES, previewStore } from '../fixtures/cv-preview/store.ts';

async function open(page: Page, state: string) {
  const response = await page.goto(`/cv-preview/${state}/`);
  expect(response?.status(), state).toBe(200);
}

test.describe('with scripts off', () => {
  test.use({ javaScriptEnabled: false });

  for (const state of PREVIEW_STATES) {
    test(`${state}: every level shows, in reading order, and every in-page link lands`, async ({ page }) => {
      const cv = loadCv(previewStore(state))!;
      const t = cv.timeline;
      await open(page, state);
      await expect(page.locator('html')).not.toHaveClass(/cv-js/);
      await expect(page.getByRole('navigation', { name: 'Where you are in the timeline', exact: true })).toBeHidden();

      // Reading order: the overview, each list, then each card.
      const expected = [
        'cv',
        ...t.themes.map((th) => `theme-${th.theme.id}`),
        ...(t.roles.length > 0 ? ['roles'] : []),
        ...(t.threads.length > 0 ? ['threads'] : []),
        ...t.threads.map((th) => `thread-${th.thread.id}`),
        ...(t.next.length > 0 ? ['next'] : []),
        ...t.themes.flatMap((th) => th.changes.map((c) => `change-${c.id}`)),
        ...t.roles.map((r) => `role-${r.id}`),
        ...t.next.map((n) => `next-${n.id}`),
      ];
      const levels = page.locator('#cv .cv-level');
      expect(await levels.evaluateAll((els) => els.map((el) => el.getAttribute('data-level')))).toEqual(expected);
      for (const el of await levels.all()) await expect(el).toBeVisible();

      // Every in-page link lands on an id on the page; tiles, rows, "Back to themes" and "Follow this thread" among them.
      const hrefs = await page.locator('a[href^="#"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
      const missing = await page.evaluate((list) => list.filter((h) => !document.getElementById(decodeURIComponent(h.slice(1)))), hrefs);
      expect(missing).toEqual([]);
      expect(await page.locator('#cv a.cv-tile').count()).toBe(t.themes.length + (t.roles.length > 0 ? 1 : 0) + (t.threads.length > 0 ? 1 : 0) + (t.next.length > 0 ? 1 : 0));
      await expect(page.locator('#cv .cv-back-link a')).toHaveCount(expected.length - 1);
      await expect(page.locator('#cv .cv-follow a')).toHaveCount(t.threads.reduce((n, th) => n + th.changes.length, 0));
      for (const link of await page.locator('#cv .cv-follow a').all()) await expect(link).toHaveAttribute('href', /^#thread-/);

      // A tile takes the reader to its list, and "Back to themes" back up.
      const first = t.themes[0]!;
      await page.locator(`#cv a.cv-tile[href="#theme-${first.theme.id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#theme-${first.theme.id}$`));
      await expect(page.locator(`#theme-${first.theme.id}`)).toBeInViewport();

      // Every card's text is there to read.
      for (const change of t.changes) await expect(page.locator(`[data-cv-item="change:${change.id}"] [data-cv-field="card"]`)).toHaveText(change.item.card);
      for (const role of t.roles) await expect(page.locator(`[data-cv-item="role:${role.id}"] [data-cv-field="card"]`)).toHaveText(role.item.card);
      for (const item of t.next) await expect(page.locator(`[data-cv-item="next:${item.id}"] [data-cv-field="card"]`)).toHaveText(item.item.card);

      // The email in words, never a link and never joined.
      const email = page.locator('[data-cv-field="email"]');
      await expect(email).toHaveText(`${cv.page.email_user} at ${cv.page.email_domain}`);
      await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
      expect(await page.content()).not.toContain(`${cv.page.email_user}@${cv.page.email_domain}`);
    });
  }
});

for (const scripts of [false, true]) {
  test.describe(`requests with scripts ${scripts ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled: scripts });

    test('typical: the page asks nothing of any other origin', async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const elsewhere: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol.startsWith('http') && url.origin !== origin) elsewhere.push(url.origin);
      });
      await open(page, 'typical');
      await page.waitForLoadState('networkidle');
      expect(elsewhere).toEqual([]);
      if (scripts) {
        const cv = loadCv(previewStore('typical'))!;
        await expect(page.locator('[data-cv-field="email"] a')).toHaveAttribute('href', `mailto:${cv.page.email_user}@${cv.page.email_domain}`);
      }
    });
  });
}
