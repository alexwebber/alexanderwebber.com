// Health and performance metrics in a real browser (T144; US5.1–US5.7, FR-060–FR-069, FR-077).
// Two halves:
// - the real /running/health/, with checks that hold whatever is published;
// - the test-only health preview (SHELL_PREVIEW=1, tests/fixtures/health-preview/): synthetic data
//   through the real components, with what the owner's data doesn't have yet (lab results, several
//   dated prediction and status entries, an HRV baseline band). Its "today" is 24 Oct 2026.
// Plus the privacy rule across every page type: no sleep, stress, Body Battery, steps or SpO2
// anywhere, and no single weigh-in.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const runsDir = resolve(import.meta.dirname, '../../data/running/published/runs');
const runIds = readdirSync(runsDir)
  .flatMap((year) => readdirSync(join(runsDir, year)).map((f) => f.replace(/\.json$/, '')))
  .sort();

const PAGE = '/running/health/';
const PREVIEW = '/health-preview/';

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
}

/** The figure whose title is `title`. */
const figure = (page: Page, title: string) => page.locator('figure.chart-figure').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('the real health page', () => {
  test('has its title, share image and nav entry, with the metrics body first (owner order)', async ({ page }) => {
    await open(page, PAGE);
    await expect(page).toHaveTitle('Health · Running · Alexander Webber');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/\/og\/running-health\.png$/);
    expect((await page.request.get(new URL(image!).pathname)).status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Running' }).getByRole('link', { name: 'Health' })).toHaveAttribute('aria-current', 'page');
    const headings = await page.locator('main h2').allTextContents();
    expect(headings).toEqual(['Weight', 'Body fat', 'VO2 max', 'Garmin race predictions', 'Garmin training status', 'Fitness, fatigue and form', 'Resting heart rate', 'HRV']);
  });

  test('US5.1: each metric shows its current value; manual figures are "as of"; fitness is intervals.icu\'s model', async ({ page }) => {
    await open(page, PAGE);
    for (const title of ['Weight', 'Body fat', 'Resting heart rate', 'HRV']) {
      await expect(figure(page, title).locator('[data-metric-now]')).toContainText(/Now [\d.]+( kg|%| bpm| ms) \(7-day average\)/);
    }
    await expect(figure(page, 'VO2 max').locator('[data-metric-now]')).toContainText(/Now \d+/);
    await expect(page.locator('[data-prediction-distance]')).toHaveCount(4);
    for (const time of await page.locator('[data-prediction-time]').allTextContents()) expect(time).toMatch(/(\(as of \d+ \w+ \d{4}\)|not recorded yet)/);
    await expect(page.locator('[data-training-status-now]')).toContainText(/(as of \d+ \w+ \d{4}\)|not recorded yet)/);
    await expect(page.locator('[data-fitness-model]')).toContainText("intervals.icu's fitness and fatigue model, not Garmin's training load");
    await expect(figure(page, 'Fitness, fatigue and form').locator('[data-garmin-attribution]')).toHaveText('Derived in part from Garmin device-sourced data');
    await expect(page.locator('[data-fitness-note]')).toContainText(/climb from zero for their first 42 days/);
  });

  test('US5.2, FR-061: weight is the 7-day average, leading with the change since the start', async ({ page }) => {
    await open(page, PAGE);
    const weight = figure(page, 'Weight');
    const lines = await weight.locator('[data-metric-line]').allTextContents();
    expect(lines[0]).toMatch(/^[\d.]+ kg (down|up) since \d+ \w+ \d{4} \([\d.]+ kg\)$/);
    await expect(weight.locator('table thead th')).toHaveText(['Date', 'Weight (7-day average)']);
    await expect(weight.locator('.chart-dots')).toHaveCount(0);
  });

  test('US5.3: body fat readings are dots under the average, with the target marked; charts open on 1 year', async ({ page }) => {
    await open(page, PAGE);
    const bodyFat = figure(page, 'Body fat');
    await expect(bodyFat.locator('[data-range="1y"] .chart-dots')).toBeVisible();
    await expect(bodyFat.locator('[data-range="1y"] .chart-target')).toContainText(/Target [\d.]+%/);
    await expect(bodyFat.getByRole('radio', { name: '1 year' })).toBeChecked();
    await bodyFat.locator('label', { hasText: '3 months' }).click();
    await expect(bodyFat.locator('[data-range="3m"] svg')).toBeVisible();
    await expect(bodyFat.locator('[data-range="1y"] svg')).toBeHidden();
  });

  test('US5.7: HRV starts at its first reading with a note, and no invented baseline', async ({ page }) => {
    await open(page, PAGE);
    await expect(page.locator('[data-hrv-note]')).toHaveText(/^HRV readings start on \d+ \w+ \d{4}(, when the .+ replaced the .+)?\.$/);
    await expect(figure(page, 'HRV').locator('.chart-band')).toHaveCount(0);
  });

  test('FR-077: Garmin attribution under the heading and at every chart and manual figure', async ({ page }) => {
    await open(page, PAGE);
    await expect(page.locator('header.page-header [data-garmin-attribution]')).toHaveText('Source: Garmin');
    for (const title of ['Weight', 'Body fat']) await expect(figure(page, title).locator('[data-garmin-attribution]').first()).toHaveText(/^Source: Garmin( .+)?$/);
    for (const title of ['VO2 max', 'Resting heart rate', 'HRV']) await expect(figure(page, title).locator('[data-garmin-attribution]').first()).toHaveText('Source: Garmin');
    await expect(page.locator('[data-race-predictions] > [data-garmin-attribution]')).toHaveText('Source: Garmin');
  });
});

test.describe('health over synthetic data (health preview)', () => {
  test('US5.4: a lab VO2 max is a labelled marker, compared with the Garmin estimate', async ({ page }) => {
    await open(page, PREVIEW);
    const vo2 = figure(page, 'VO2 max');
    await expect(vo2.locator('[data-range="1y"] .chart-marker-label')).toHaveText('Lab test');
    await expect(vo2.locator('[data-lab-comparison] li')).toHaveText('Lab test, 15 Mar 2026 (Example Sports Lab): 51.0. Garmin, 15 Mar 2026: 54.0. Difference (lab minus Garmin): −3.0.');
  });

  test('US5.5: two DEXA scans a year apart are separate labelled points beside the readings', async ({ page }) => {
    await open(page, PREVIEW);
    const bodyFat = figure(page, 'Body fat');
    await bodyFat.locator('label', { hasText: 'All time' }).click();
    await expect(bodyFat.locator('[data-range="all"] .chart-marker-label')).toHaveText(['DEXA scan', 'DEXA scan']);
    await expect(bodyFat.locator('[data-lab-comparison] li')).toHaveCount(2);
    await expect(bodyFat.locator('[data-lab-comparison] li').first()).toContainText(/DEXA scan, 10 Jun 2025 \(Example Clinic\): 31\.2%\. Garmin Index S2, \d+ Jun 2025: [\d.]+%\. Difference \(lab minus Garmin\): [+−][\d.]+ percentage points\./);
    await expect(figure(page, 'Weight').locator('[data-lab-comparison]')).toContainText('Garmin Index S2 (7-day average)');
  });

  test('US5.1: dated manual entries form their history and trends; achieved goals and linked races show', async ({ page }) => {
    await open(page, PREVIEW);
    await expect(page.locator('[data-training-status-now]')).toHaveText('Peaking (as of 20 Oct 2026)');
    await expect(page.locator('[data-training-status-history] li')).toHaveText(['14 Jul 2026: Productive (After a training block)', '2 Apr 2026: Maintaining']);
    const marathon = page.locator('[data-prediction-distance="marathon"]');
    await expect(marathon).toContainText('3:29:30 (as of 14 Jul 2026)');
    await expect(marathon.locator('[data-prediction-goal]')).toHaveText('Goal sub-3:20');
    await expect(marathon.locator('[data-prediction-race]')).toHaveText('Seaside Marathon, 4 Apr 2027');
    for (const title of ['5k prediction', '10k prediction', 'Half marathon prediction', 'Marathon prediction']) await expect(figure(page, title)).toBeVisible();
  });

  test('a baseline band shows only where the data has one, and HRV falls back to its start date', async ({ page }) => {
    await open(page, PREVIEW);
    await expect(figure(page, 'HRV').locator('[data-range="1y"] .chart-band')).toBeVisible();
    await expect(page.locator('[data-hrv-note]')).toHaveText('HRV readings start on 1 Sep 2025.');
  });
});

test('US5.6, FR-061: no sleep, stress, Body Battery, steps, SpO2 or single weigh-ins on any page', async ({ page }) => {
  test.slow();
  const pages = ['/', '/running/', '/running/goals/', '/running/training/', '/running/races/', PAGE, ...(runIds.length ? [`/running/runs/${runIds.at(-1)}/`, `/running/training/${runIds.at(-1)!.slice(0, 4)}/`] : [])];
  for (const path of pages) {
    await open(page, path);
    // All text, including closed tables and hidden ranges and views, without scripts and styles.
    const text = (
      await page.evaluate(() => {
        const body = document.body.cloneNode(true) as HTMLElement;
        body.querySelectorAll('script, style').forEach((el) => el.remove());
        return body.textContent ?? '';
      })
    ).toLowerCase();
    for (const word of ['sleep', 'stress', 'body battery', 'spo2', 'pulse ox', 'blood oxygen']) expect(text, `${path}: ${word}`).not.toContain(word);
    expect(text, `${path}: steps`).not.toMatch(/\bsteps\b/);
    expect(text, `${path}: a single weigh-in`).not.toMatch(/\bweigh-in\b(?!s are never shown)/);
  }
});
