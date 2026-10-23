// The Goals page in a real browser (T095; US2, contracts/routes.md). It checks the built
// /running/goals/ against the owner's goals.yaml with invariants that hold whatever the refresh
// bot has published (an open PR's CI builds on the latest main data): every goal shows exactly
// once, retired goals never; active goals in priority order; achieved goals newest first; the
// layout at 360px and 320px; Garmin attribution placed as T152 says. Card wording for each goal
// state is covered by tests/unit/goal-cards.test.ts. US2.7 builds a copy of the repo with a
// malformed goal and checks the build stops before touching dist/.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';

const PATH = '/running/goals/';
const REPO = resolve(import.meta.dirname, '../..');

interface OwnerGoal {
  id: string;
  priority: number;
  retired?: boolean;
}

const goals = (parse(readFileSync(join(REPO, 'data/running/owner/goals.yaml'), 'utf8')) ?? []) as OwnerGoal[];

async function open(page: Page) {
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
}

const ids = (page: Page, list: string) => page.locator(`[${list}] [data-goal-id]`).evaluateAll((els) => els.map((el) => el.getAttribute('data-goal-id')!));

test('has its own title, description, share image and nav entry', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Goals · Running · Alexander Webber');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /running goals/);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/\/og\/running-goals\.png$/);
  const png = await page.request.get(new URL(image!).pathname);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');
  await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Goals' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible();
  await expect(page.locator('[data-last-updated]')).toBeVisible();
});

test('shows every goal once, never a retired one', async ({ page }) => {
  await open(page);
  const shown = [...(await ids(page, 'data-new-goals')), ...(await ids(page, 'data-active-goals')), ...(await ids(page, 'data-achieved-goals'))];
  expect(shown.sort()).toEqual(goals.filter((g) => !g.retired).map((g) => g.id).sort());
});

test('lists active goals in priority order', async ({ page }) => {
  await open(page);
  const priorities = await page.locator('[data-active-goals] [data-goal-id]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-priority'))));
  expect(priorities.length).toBeGreaterThan(0);
  expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  // The headings read in the same order.
  const active = await ids(page, 'data-active-goals');
  const byPriority = goals.filter((g) => active.includes(g.id)).sort((a, b) => a.priority - b.priority).map((g) => g.id);
  expect(active).toEqual(byPriority);
});

test('lists achieved goals newest first, each with its date, the newly achieved ones on top', async ({ page }) => {
  await open(page);
  for (const card of await page.locator('[data-new-goals] [data-goal-id]').all()) {
    await expect(card.locator('[data-newly-achieved]')).toHaveText('New');
  }
  await expect(page.locator('[data-achieved-goals] [data-newly-achieved]')).toHaveCount(0);
  const achieved = page.locator('[data-new-goals] [data-goal-id], [data-achieved-goals] [data-goal-id]');
  const dates = await achieved.evaluateAll((els) => els.map((el) => el.getAttribute('data-achieved-on')!));
  expect(dates).toEqual([...dates].sort().reverse());
  for (const card of await achieved.all()) {
    await expect(card).toContainText(/Achieved \d{1,2} [A-Z][a-z]{2} \d{4}/);
  }
});

test('every card shows a target or says there is no data yet, never a 0% bar from nothing', async ({ page }) => {
  await open(page);
  for (const card of await page.locator('[data-active-goals] [data-goal-id]').all()) {
    const meters = await card.getByRole('meter').count();
    const noData = await card.locator('[data-no-data]').count();
    const milestone = (await card.locator('dt', { hasText: 'Target' }).count()) === 0;
    expect(meters + noData > 0 || milestone, await card.getAttribute('data-goal-id') ?? '').toBe(true);
  }
});

test('Garmin attribution sits under the page heading and under each card heading that shows Garmin data', async ({ page }) => {
  await open(page);
  const cards = page.locator('[data-goal-id]');
  const attributed = cards.filter({ has: page.locator('[data-garmin-attribution]') });
  if ((await attributed.count()) > 0) {
    await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveText(/^Source: Garmin/);
  }
  for (const card of await attributed.all()) {
    await expect(card.locator('.goal-card-title + [data-garmin-attribution]')).toHaveText(/^Source: Garmin/);
  }
  // A card with a Garmin prediction or a recorded effort always carries it.
  for (const card of await cards.filter({ has: page.locator('[data-prediction]') }).all()) {
    await expect(card.locator('[data-garmin-attribution]')).toHaveCount(1);
  }
});

for (const width of [360, 320]) {
  test(`fits ${width}px without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    // Cards stack in one column on a phone.
    const lefts = await page.locator('[data-goal-id]').evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().left)))]);
    expect(lefts).toHaveLength(1);
  });
}

test('needs no client JS beyond the shared freshness script', async ({ page }) => {
  await open(page);
  const external = await page.locator('script[src]').count();
  expect(external).toBe(0);
});

test.describe('US2.7: a malformed goal stops the build', () => {
  test.setTimeout(180_000);

  test('names the file, goal and field, and leaves dist/ untouched', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
    const root = mkdtempSync(join(tmpdir(), 'aw-build-'));
    try {
      for (const entry of ['src', 'schemas', 'data', 'public', 'package.json', 'astro.config.mjs', 'tsconfig.json']) {
        cpSync(join(REPO, entry), join(root, entry), { recursive: true });
      }
      // A junction needs no symlink privilege on Windows; the type is ignored elsewhere.
      symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'), 'junction');
      const goalsFile = join(root, 'data/running/owner/goals.yaml');
      writeFileSync(goalsFile, `${readFileSync(goalsFile, 'utf8')}\n- id: broken-goal\n  type: race_time\n  title: Broken\n  priority: 99\n  featured: false\n  target: { distance: 10k, time: "3:7x" }\n`);
      mkdirSync(join(root, 'dist'));
      writeFileSync(join(root, 'dist/index.html'), 'the live build');

      const result = spawnSync(process.execPath, [join(REPO, 'node_modules/astro/bin/astro.mjs'), 'build'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, SHELL_PREVIEW: '', CLAUDECODE: '', AI_AGENT: '', NO_COLOR: '1' },
        timeout: 150_000,
      });
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.status, output).not.toBe(0);
      expect(output).toContain('data/running/owner/goals.yaml  goal "broken-goal"  field target.time: "3:7x" is not a valid time');
      expect(readFileSync(join(root, 'dist/index.html'), 'utf8')).toBe('the live build');
      expect(existsSync(join(root, 'dist/running'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
