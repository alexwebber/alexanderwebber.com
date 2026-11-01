// The Training hub and year pages (T123's fixture half; US3.1, US3.5, US3.6, FR-045, FR-046,
// FR-058, FR-077), rendered with Astro's container API over a fake store with every input pinned,
// "today" included (the clock is faked). Browser checks over the real build are in
// tests/e2e/training.spec.ts and tests/a11y/training.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import type { Run, RunningStore } from '../../src/sections/running/data/store/index.ts';
import Training from '../../src/sections/running/pages/training.astro';
import YearPage from '../../src/sections/running/pages/training/[year].astro';
import { stripTags } from '../helpers/html.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com', trailingSlash: 'always' } });
});

const run = (id: string, km: number, extra: Record<string, unknown> = {}): Run =>
  runFixture(id, { distance_m: km * 1000, moving_s: km * 300, avg_pace_s_per_km: 300, device: 'Venu X1', title: `Run · ${km.toFixed(1)} km`, ...extra }) as unknown as Run;

// Sat 24 Oct 2026. Runs from Oct 2025, a treadmill run and a race.
const RUNS: Run[] = [
  run('2026-10-23-bv7w', 10, { elevation_gain_m: 55 }),
  run('2026-10-22-tttt', 5, { type: 'indoor', treadmill: true, title: 'Treadmill run · 5.0 km' }),
  run('2026-10-17-ofka', 5, { is_race: true, title: 'Track 5k' }),
  run('2026-09-30-aaaa', 12),
  run('2025-11-02-bbbb', 8, { device: 'Venu 2 Plus' }),
  run('2025-10-07-cccc', 6, { device: 'Venu 2 Plus', is_race: true, title: 'Parkrun' }),
];

function store(runs: Run[]): RunningStore {
  return {
    listRuns: async () => runs,
    getRun: async (id) => runs.find((r) => r.id === id),
    getRaceTrack: async () => undefined,
    getHealthSeries: async () => [],
    getRefreshRecord: async () => ({ schema_version: 1, generated_at: '2026-10-24T08:00:00Z', sources: { intervals: { last_data_change_at: '2026-10-24T08:00:00Z', last_success_at_build: '2026-10-24T08:00:00Z' } } }),
    getCampaignFigures: async () => [],
    getOwner: async () => ({ section: undefined, goals: [], upcomingRaces: [], races: [], overrides: [], exclusions: [], lab: [], manualMetrics: { training_status: [], race_predictions: [] }, campaigns: [], stories: [] }),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
  setRunningStore(store(RUNS));
});
afterEach(() => {
  vi.useRealTimers();
  setRunningStore(undefined);
});

const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
const text = (html: string) =>
  stripTags(html)
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const hub = async () => clean(await container.renderToString(Training, { request: new Request('https://alexanderwebber.com/running/training/') }));
const view = (html: string, name: string) => html.match(new RegExp(`data-view="${name}"[\\s\\S]*?</ol>\\s*</section>\\s*</div>|data-view="${name}"[\\s\\S]*?</div>`))?.[0] ?? '';

describe('training hub (T120)', () => {
  it('US3.1: opens on weekly totals with a CSS-only switch to months and years, and all-time totals', async () => {
    const html = await hub();
    const toggle = html.match(/<fieldset class="toggle">[\s\S]*?<\/fieldset>/)![0];
    expect(toggle).toMatch(/value="week" data-index="0" checked/);
    expect(text(toggle)).toBe('Totals by Weeks Months Years');
    for (const kind of ['week', 'month', 'year']) {
      expect(html).toContain(`>Distance by ${kind}</h3>`);
      expect(html).toContain(`>Moving time by ${kind}</h3>`);
    }
    const t = text(html);
    // This week (Mon 19 to Sun 25 Oct): 10 km and the 5 km treadmill run (FR-058).
    expect(t).toContain('This week 2 runs Distance 15.0 km Moving time 1:15:00 Average pace 5:00 /km Elevation gain 55 m');
    expect(t).toContain('This month 3 runs Distance 20.0 km');
    expect(t).toContain('This year 4 runs Distance 32.0 km');
    expect(t).toMatch(/All time Since 7 Oct 2025 Runs 6 Distance 46 km Moving time 3:50:00 Average pace 5:00 \/km Elevation gain 55 m/);
    expect(t).toContain('The last 26 weeks: 32.0 km in 4 runs; this week 15.0 km so far.');
    expect(html).toContain('/og/running-training.png');
  });

  it("lists this year's runs newest first by month, with the race and treadmill labels, linking to run pages (US3.5, US3.6)", async () => {
    const html = await hub();
    const all = view(html, 'all');
    expect([...all.matchAll(/data-month="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026-10', '2026-09']);
    expect([...all.matchAll(/class="run-row[^"]*" data-run-id="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026-10-23-bv7w', '2026-10-22-tttt', '2026-10-17-ofka', '2026-09-30-aaaa']);
    expect(all).toContain('<a href="/running/runs/2026-10-23-bv7w/">Run · 10.0 km</a>');
    expect(all.match(/data-run-id="2026-10-22-tttt"[\s\S]*?<\/li>/)![0]).toContain('data-treadmill');
    expect(text(all.match(/<li[^>]*data-run-id="2026-10-17-ofka"[\s\S]*?<\/li>/)![0])).toBe('Track 5k Race 17 Oct 2026 5.0 km 25:00 5:00 /km');
    expect(all).not.toContain('2025-10-07-cccc');
  });

  it('"Races only" shows races from every year, and every year has a page link', async () => {
    const html = await hub();
    const races = view(html, 'races');
    expect([...races.matchAll(/data-run-id="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026-10-17-ofka', '2025-10-07-cccc']);
    expect(text(races)).toContain('Races from every year.');
    expect([...html.matchAll(/href="(\/running\/training\/\d{4}\/)"/g)].map((m) => m[1])).toEqual(['/running/training/2026/', '/running/training/2025/']);
  });

  it('names every watch behind the totals and the list (FR-077)', async () => {
    const html = await hub();
    expect(html).toMatch(/<h1>Training<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1, Garmin Venu 2 Plus<\/p>/);
    expect(html.match(/Distance by week<\/h3>[\s\S]*?<\/p>/)![0]).toContain('Source: Garmin Venu X1, Garmin Venu 2 Plus');
  });

  it('says so when there are no runs yet', async () => {
    setRunningStore(store([]));
    const t = text(await hub());
    expect(t).toContain('No runs yet.');
    expect(t).not.toContain('All time');
  });
});

describe('year page (T120)', () => {
  it("lists one year's runs with its totals and links to the other years", async () => {
    const runs = RUNS.filter((r) => r.date.startsWith('2025'));
    const html = clean(
      await container.renderToString(YearPage, {
        props: { year: 2025, runs, years: [2026, 2025] },
        params: { year: '2025' },
        request: new Request('https://alexanderwebber.com/running/training/2025/'),
      }),
    );
    const t = text(html);
    expect(html).toContain('<h1>Training in 2025</h1>');
    expect(t).toContain('Runs 2 Distance 14 km Moving time 1:10:00 Average pace 5:00 /km Elevation gain Not recorded');
    expect(t).toMatch(/From 7 Oct 2025 to 2 Nov 2025 ?\./);
    expect([...html.matchAll(/data-month="([^"]+)"/g)].map((m) => m[1]).slice(0, 2)).toEqual(['2025-11', '2025-10']);
    expect(html).toContain('<a href="/running/training/2025/" aria-current="page">');
    expect(html).toContain('/og/running-year.png');
    expect(html).toMatch(/<h1>Training in 2025<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu 2 Plus<\/p>/);
  });
});
