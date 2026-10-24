// Run pages in a real browser (T123; US3.2–US3.4, US3.6, FR-011, FR-013, FR-048, FR-077). It checks
// every built run page against its published file with invariants that hold whatever the bot has
// published: a panel shows exactly when its data exists, figures are never shown as 0 when not
// recorded, no time of day, map or provider text appears, the chart switch works without JS, and
// the page fits 320px. Exact wording over pinned fixtures is in tests/unit/run-detail.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const runsDir = resolve(import.meta.dirname, '../../data/running/published/runs');
interface PublishedRun {
  id: string;
  date: string;
  treadmill: boolean;
  device?: string;
  hr?: { avg: number; max: number };
  power_w_avg?: number;
  dynamics?: Record<string, number>;
  cadence_avg?: number;
  stride_m_avg?: number;
  splits: unknown[];
  hr_zones?: { name?: string }[];
  best_efforts: { plausible: boolean }[];
  series: Record<string, (number | null)[]>;
}
const runs: PublishedRun[] = readdirSync(runsDir).flatMap((year) =>
  readdirSync(join(runsDir, year)).map((file) => JSON.parse(readFileSync(join(runsDir, year, file), 'utf8')) as PublishedRun),
);
const has = (values?: (number | null)[]) => (values ?? []).filter((v) => v !== null).length >= 2;
const garminZones = (r: PublishedRun) => (r.hr_zones ?? []).length === 5 && r.hr_zones!.every((z) => typeof z.name === 'string');

test('US3.2–US3.4: each panel shows exactly when its data was recorded, and no time of day, map or 0 stands in', async ({ page }) => {
  test.skip(runs.length === 0, 'no runs published');
  test.setTimeout(240_000);
  for (const run of runs) {
    const response = await page.goto(`/running/runs/${run.id}/`);
    expect(response?.status(), run.id).toBe(200);
    const html = await page.content();
    expect(html, run.id).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}|start_time|latlng/);
    expect(await page.locator('canvas, [data-race-map], .maplibregl-map').count(), run.id).toBe(0);
    await expect(page.locator('[data-run-summary] [data-figure="avg-hr"]'), run.id).toHaveCount(run.hr ? 1 : 0);
    await expect(page.locator('[data-splits]'), run.id).toHaveCount(run.splits.length ? 1 : 0);
    await expect(page.locator('[data-hr-zones]'), run.id).toHaveCount(garminZones(run) ? 1 : 0);
    await expect(page.locator('[data-run-efforts]'), run.id).toHaveCount(run.best_efforts.some((e) => e.plausible) ? 1 : 0);
    const dynamics = run.dynamics !== undefined || run.power_w_avg !== undefined || run.cadence_avg !== undefined || run.stride_m_avg !== undefined;
    await expect(page.locator('[data-run-dynamics]'), run.id).toHaveCount(dynamics ? 1 : 0);
    await expect(page.locator('[data-run-dynamics] [data-figure="power"]'), run.id).toHaveCount(run.power_w_avg !== undefined ? 1 : 0);
    for (const key of ['pace', 'hr', 'elev', 'cadence', 'power']) {
      // Once per axis panel (distance and time).
      await expect(page.locator(`[data-run-charts] [data-series="${key}"]`), `${run.id} ${key}`).toHaveCount(has(run.series[key]) ? 2 : 0);
    }
    // Figures never stand in a 0 for something not recorded (chart axes may start at 0; a flat
    // track run really does gain 0 m, so elevation is left out of this check).
    for (const value of await page.locator('[data-run-summary] dd, [data-run-dynamics] dd').allTextContents()) {
      expect(value, run.id).not.toMatch(/^0(\.0+)? (bpm|W|spm|ms|cm)$/);
    }
    await expect(page.locator('h1 + [data-garmin-attribution]'), run.id).toHaveText(run.device ? `Source: Garmin ${run.device}` : 'Source: Garmin');
    await expect(page.locator('[data-treadmill]'), run.id).toHaveCount(run.treadmill ? 1 : 0);
  }
});

test('FR-013: the charts switch from distance to elapsed time without JS, never clock time', async ({ browser }) => {
  const run = runs.filter((r) => has(r.series.pace)).sort((a, b) => b.date.localeCompare(a.date))[0];
  test.skip(!run, 'no run with charts');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/running/runs/${run!.id}/`);
  const charts = page.locator('[data-run-charts]');
  await expect(charts.locator('[data-axis="distance"] [data-series="pace"] svg')).toBeVisible();
  await expect(charts.locator('[data-axis="time"]')).toBeHidden();
  await expect(charts.locator('[data-axis="distance"] .chart-x').first()).toContainText(/km/);
  await charts.getByText('Time', { exact: true }).click();
  await expect(charts.locator('[data-axis="time"] [data-series="pace"] svg')).toBeVisible();
  await expect(charts.locator('[data-axis="distance"]')).toBeHidden();
  await expect(charts.locator('[data-axis="time"] .chart-x').first()).toContainText(/min|\d:\d\d/);
  await expect(charts.locator('[data-axis="time"] .chart-x').first()).not.toContainText(/am|pm/i);
  await context.close();
});

test('the latest run fits 320px and its chart tables open', async ({ page }) => {
  const run = [...runs].sort((a, b) => b.date.localeCompare(a.date))[0];
  test.skip(!run, 'no runs published');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/running/runs/${run!.id}/`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const summary = page.locator('[data-axis="distance"] [data-series="pace"] summary');
  if ((await summary.count()) > 0) {
    await summary.click();
    await expect(page.locator('[data-axis="distance"] [data-series="pace"] table')).toBeVisible();
  }
  await expect(page.getByRole('link', { name: `Runs in ${run!.date.slice(0, 4)}` })).toBeVisible();
});
