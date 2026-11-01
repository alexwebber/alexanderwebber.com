// The landing page in a real browser (T109; US1, contracts/routes.md). It checks the built
// /running/ against the owner files and the published runs with invariants that hold whatever the
// refresh bot has published (an open PR's CI builds on the latest main data): the hero follows
// section.yaml and upcoming-races.yaml, featured goals follow goals.yaml, the latest run links to a
// run page with no time of day or map, treadmill runs are labelled, the page works without JS,
// and the layout fits 360px and 320px. The fundraising card follows the same rule: its checks ask
// whether the focus race's campaign has a published file, and never pin the bot's figures. Card
// wording for pinned scenarios (US1.1-US1.7: 182 days, "10.0 kg to go", a stale notice, the story
// link) is in tests/unit/landing.test.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { addDays, formatLongDate, today as londonToday } from '../../src/shared/format/dates.ts';
import { countdownText, daysRemaining, targetLabel } from '../../src/sections/running/domain/races.ts';

const PATH = '/running/';
const REPO = resolve(import.meta.dirname, '../..');
const owner = (file: string) => parse(readFileSync(join(REPO, 'data/running/owner', file), 'utf8'));

interface Section {
  focus_race: { race_id: string; charity: { name: string } };
  featured_goal_limit?: number;
  story_link?: { href: string; label: string };
}
interface UpcomingRace {
  id: string;
  name: string;
  date: string;
  target_time?: string;
  result_ref?: string;
}
interface OwnerGoal {
  id: string;
  priority: number;
  featured: boolean;
  retired?: boolean;
}
interface PublishedRun {
  id: string;
  date: string;
  treadmill: boolean;
}
interface OwnerCampaign {
  id: string;
  race_id: string;
  page_url: string;
}

const section = owner('section.yaml') as Section;
const races = (owner('upcoming-races.yaml') ?? []) as UpcomingRace[];
const focus = races.find((r) => r.id === section.focus_race.race_id)!;
const goals = (owner('goals.yaml') ?? []) as OwnerGoal[];
const featured = goals
  .filter((g) => g.featured && !g.retired)
  .sort((a, b) => a.priority - b.priority)
  .slice(0, section.featured_goal_limit ?? 6)
  .map((g) => g.id);
const campaign = ((owner('campaigns.yaml') ?? []) as OwnerCampaign[]).find((c) => c.race_id === section.focus_race.race_id);
// The card shows once the focus race's campaign has a published file (FR-022, FR-030).
const hasCard = campaign !== undefined && existsSync(join(REPO, 'data/running/published/fundraising', `${campaign.id}.json`));
const runsDir = join(REPO, 'data/running/published/runs');
const runs: PublishedRun[] = readdirSync(runsDir).flatMap((year) =>
  readdirSync(join(runsDir, year)).map((file) => JSON.parse(readFileSync(join(runsDir, year, file), 'utf8')) as PublishedRun),
);

async function open(page: Page) {
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
}

test('has its own title, description, share image and nav entry', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Running · Alexander Webber');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', new RegExp(focus.name));
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/\/og\/running\.png$/);
  const png = await page.request.get(new URL(image!).pathname);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');
  await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'Running' })).toBeVisible();
  await expect(page.locator('[data-last-updated]')).toBeVisible();
});

test('the site home links to the landing page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Running' }).click();
  await expect(page).toHaveURL(/\/running\/$/);
});

test('US1.1/US1.2: the hero shows the focus race, its date, the days left, its target and the charity', async ({ page }) => {
  await open(page);
  const hero = page.locator('[data-hero]');
  await expect(hero.getByRole('heading', { level: 2 })).toHaveText(`${focus.name} · ${formatLongDate(focus.date)}`);
  if (!focus.result_ref) {
    // With JS on, the countdown follows the visitor's UK date.
    const [value, unit] = countdownText(daysRemaining(focus, londonToday()));
    await expect(hero.locator('[data-countdown]')).toHaveText(`${value} ${unit}`.trim());
  }
  if (focus.target_time) await expect(hero.locator('[data-target]')).toHaveText(`Target: ${targetLabel(focus.target_time)}`);
  if (hasCard) {
    await expect(hero.locator('[data-charity]')).toHaveCount(0);
    const card = hero.locator('.fundraising-card');
    await expect(card).toContainText(`For ${section.focus_race.charity.name}`);
    await expect(card.getByRole('link', { name: 'Donate on JustGiving' })).toHaveAttribute('href', campaign!.page_url);
  } else {
    await expect(hero.locator('[data-charity]')).toHaveText(`For ${section.focus_race.charity.name}`);
    await expect(page.getByText(/fundrais|donate/i)).toHaveCount(0);
  }
  // A Garmin prediction always says "at current fitness" and carries the date it was read.
  for (const prediction of await hero.locator('[data-prediction]').all()) {
    await expect(prediction).toContainText(/^Garmin predicts \d{1,2}:\d{2}(:\d{2})? at current fitness \(\d{1,2} [A-Z][a-z]{2} \d{4}\)$/);
  }
});

test('US1.3: featured goals appear newly achieved first, then in priority order, each with progress or "no data yet"', async ({ page }) => {
  await open(page);
  const cards = page.locator('[data-featured-goals] [data-goal-id]');
  const shown = await cards.evaluateAll((els) => els.map((el) => ({ id: el.getAttribute('data-goal-id')!, fresh: el.querySelector('[data-newly-achieved]') !== null, on: el.getAttribute('data-achieved-on') ?? '' })));
  const fresh = shown.filter((c) => c.fresh);
  expect(fresh.map((c) => c.on)).toEqual(fresh.map((c) => c.on).sort().reverse());
  expect(shown.slice(0, fresh.length).every((c) => c.fresh)).toBe(true);
  expect(shown.filter((c) => !c.fresh).map((c) => c.id)).toEqual(featured.filter((id) => !fresh.some((c) => c.id === id)));
  expect(shown.map((c) => c.id).sort()).toEqual([...featured].sort());
  for (const card of await cards.all()) {
    const status = await card.getAttribute('data-status');
    if (status === 'achieved') {
      await expect(card).toContainText(/Achieved \d{1,2} [A-Z][a-z]{2} \d{4}/);
      continue;
    }
    const meters = await card.getByRole('meter').count();
    const noData = await card.locator('[data-no-data]').count();
    expect(meters + noData, (await card.getAttribute('data-goal-id')) ?? '').toBeGreaterThan(0);
    await expect(card.locator('[data-target]')).toContainText(/^Target /);
  }
});

test('US1.5: this week and the latest run, which links to its run page', async ({ page }) => {
  await open(page);
  const week = page.locator('[data-this-week]');
  await expect(week.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(week.locator('[data-figure="distance"]')).toContainText(/\d+\.\d km\s*Last week \d+\.\d km/);
  const card = page.locator('[data-latest-run] [data-run-card]');
  if (runs.length === 0) {
    await expect(page.locator('[data-latest-run]')).toContainText('No runs yet.');
    return;
  }
  const latestDate = runs.map((r) => r.date).sort().at(-1)!;
  const id = (await card.getAttribute('data-run-id'))!;
  expect(id.startsWith(latestDate)).toBe(true);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/running/runs/${id}/$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('run pages show the date only, no time of day or map, and label treadmill runs (FR-011, FR-058)', async ({ page }) => {
  test.setTimeout(240_000); // every published run, so it grows with the data
  for (const run of runs) {
    const response = await page.goto(`/running/runs/${run.id}/`);
    expect(response?.status(), run.id).toBe(200);
    const html = await page.content();
    expect(html, run.id).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(await page.locator('canvas, [data-race-map], .maplibregl-map').count(), run.id).toBe(0);
    await expect(page.locator('[data-treadmill]'), run.id).toHaveCount(run.treadmill ? 1 : 0);
    if (run.treadmill) await expect(page.locator('[data-treadmill]')).toHaveText('Treadmill');
    await expect(page.locator('h1 + [data-garmin-attribution]'), run.id).toHaveText(/^Source: Garmin/);
  }
});

test('a treadmill latest run carries the label on its card', async ({ page }) => {
  await open(page);
  const card = page.locator('[data-latest-run] [data-run-card]');
  test.skip((await card.count()) === 0, 'no runs published');
  const id = await card.getAttribute('data-run-id');
  const run = runs.find((r) => r.id === id)!;
  await expect(card.locator('[data-treadmill]')).toHaveCount(run.treadmill ? 1 : 0);
});

test('US1.6: the story link shows exactly when section.yaml has one', async ({ page }) => {
  await open(page);
  if (section.story_link) {
    await expect(page.locator('[data-story-link] a')).toHaveAttribute('href', section.story_link.href);
  } else {
    await expect(page.locator('[data-story-link]')).toHaveCount(0);
    await expect(page.getByText(/story/i)).toHaveCount(0);
  }
});

test('links to the other areas that have shipped (FR-027)', async ({ page }) => {
  await open(page);
  const links = page.locator('[data-section-links] a');
  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toContain('/running/goals/');
  for (const href of hrefs) expect((await page.request.get(href!)).status(), href!).toBe(200);
});

test('Garmin attribution sits under the page heading, the chart title and each card that shows Garmin data (FR-077)', async ({ page }) => {
  await open(page);
  await expect(page.locator('h1 + [data-garmin-attribution]')).toHaveText(/^Source: Garmin/);
  const build = page.locator('[data-training-build] .chart-figure-source [data-garmin-attribution]');
  if ((await page.locator('[data-training-build] figure').count()) > 0 && runs.length > 0) await expect(build).toHaveText(/^Source: Garmin/);
  for (const card of await page.locator('[data-featured-goals] [data-goal-id]').filter({ has: page.locator('[data-prediction], [data-fastest] a, [data-current]') }).all()) {
    await expect(card.locator('[data-garmin-attribution]')).toHaveCount(1);
  }
  if ((await page.locator('[data-run-card]').count()) > 0) {
    await expect(page.locator('[data-run-card] .run-card-title + [data-garmin-attribution]')).toHaveText(/^Source: Garmin/);
  }
});

test("the countdown follows the visitor's UK date on a day after the build", async ({ page }) => {
  test.skip(Boolean(focus.result_ref), 'the focus race has a result');
  // Within the build's own UK day the script leaves the built text alone; on any other day it
  // works the count out again.
  await page.clock.setFixedTime(new Date(`${addDays(focus.date, -10)}T12:00:00Z`));
  await open(page);
  await expect(page.locator('[data-hero] [data-countdown]')).toHaveText('10 days to go');
});

test.describe('without JavaScript (FR-074)', () => {
  test.use({ javaScriptEnabled: false });

  test('every key figure is still there', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-hero] [data-countdown-value]')).toHaveText(/^(\d+|Race day|Result coming soon)$/);
    if (focus.target_time) await expect(page.locator('[data-hero] [data-target]')).toBeVisible();
    await expect(page.locator('[data-this-week] [data-figure="distance"]')).toBeVisible();
    await expect(page.locator('[data-last-updated-text]')).toHaveText(/^(Last updated \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}|Not updated yet)$/);
    await expect(page.locator('[data-training-build] table')).toHaveCount(1);
  });
});

test.describe('on a phone (SC-001, FR-073)', () => {
  // With a card, the total takes the place of this week's distance on the first screen, which 001's
  // SC-001 doesn't need (the owner confirms it at T062).
  test('the race, days left, target and the fundraising total, or else this week’s distance, are on the first screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page);
    const bottom = (selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    const last = hasCard ? '.fundraising-card [data-fundraising-lead]' : '[data-training-build] .chart-figure-summary';
    for (const selector of ['[data-hero] h2', '[data-countdown]', '[data-hero] [data-target]', last]) {
      if ((await page.locator(selector).count()) === 0) continue;
      expect(await bottom(selector), selector).toBeLessThanOrEqual(780);
    }
  });

  for (const width of [360, 320]) {
    test(`fits ${width}px without sideways scrolling, goals in one column`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      const lefts = await page.locator('[data-featured-goals] > li').evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().left)))]);
      expect(lefts).toHaveLength(1);
    });

    test(`at ${width}px the fundraising card comes after the hero's facts, clear of the training build, before the goals (FR-034)`, async ({ page }) => {
      test.skip(!hasCard, 'the focus race has no published campaign');
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      const box = (selector: string) => page.locator(selector).first().evaluate((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return { top: top + window.scrollY, bottom: bottom + window.scrollY };
      });
      const card = await box('.fundraising-card');
      expect(card.top).toBeGreaterThanOrEqual((await box('[data-hero] .hero-facts')).bottom);
      expect(card.bottom).toBeLessThanOrEqual((await box('[data-training-build]')).top);
      expect((await box('[data-training-build]')).bottom).toBeLessThanOrEqual((await box('[data-featured]')).top);
    });
  }
});

test('on a wide screen celebrations and the lead goal span the full width, and the rest sit two by two', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const list = page.locator('[data-featured-goals]');
  const full = Math.round((await list.boundingBox())!.width);
  const items = await list.locator('> li').evaluateAll((els) =>
    els.map((el) => ({ wide: el.hasAttribute('data-wide'), fresh: el.querySelector('[data-newly-achieved]') !== null, width: Math.round(el.getBoundingClientRect().width) })),
  );
  test.skip(items.length < 3, 'needs three featured goals');
  // Each newly achieved card, then the lead goal, spans the row.
  const lead = items.findIndex((i) => !i.fresh);
  for (const [n, item] of items.entries()) if (item.fresh || n === lead) expect(item.wide).toBe(true);
  for (const item of items) {
    if (item.wide) expect(item.width).toBeGreaterThan(full * 0.95);
    else expect(item.width).toBeLessThan(full * 0.6);
  }
  // The others fill whole rows: a lone last card spans instead of leaving a gap.
  expect(items.filter((i) => !i.wide).length % 2).toBe(0);
});

test('needs no client JS files, only the small inline scripts', async ({ page }) => {
  await open(page);
  expect(await page.locator('script[src]').count()).toBe(0);
  const inline = await page.locator('script:not([src])').evaluateAll((els) => els.map((el) => el.textContent?.length ?? 0));
  for (const size of inline) expect(size).toBeLessThan(1024);
});
