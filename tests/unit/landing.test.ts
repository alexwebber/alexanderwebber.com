// The landing page and the minimal run page (T109's fixture half; spec US1.1-US1.7, FR-020..027,
// FR-058, FR-072, FR-077), rendered with Astro's container API over a fake store with every input
// pinned, "today" included (the clock is faked). The browser checks over the real build (layout
// at 360px, no-JS, axe, keyboard) are in tests/e2e/landing.spec.ts and tests/a11y/landing.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGoalsCache } from '../../src/sections/running/data/goals.ts';
import { clearLandingCache, loadLanding } from '../../src/sections/running/data/landing.ts';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import { landingCard } from '../../src/sections/running/og/landing.ts';
import Landing from '../../src/sections/running/pages/index.astro';
import RunPage from '../../src/sections/running/pages/runs/[id].astro';
import type { Goal, HealthMetric, OwnerData, RefreshRecord, Run, RunningStore, SectionSettings, UpcomingRace } from '../../src/shared/storage/index.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com', trailingSlash: 'always' } });
});

const SECTION: SectionSettings = {
  focus_race: { race_id: 'brighton-2027', build_start: '2026-09-14', charity: { name: 'Martlets hospice' } },
  garmin_devices: { scale: 'Index S2' },
  stale_after_hours: 12,
  featured_goal_limit: 6,
  recent_highlight_days: { pb: 14, goal: 14 },
} as SectionSettings;
const BRIGHTON: UpcomingRace = { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon', target_time: '3:30:00' };

const goal = (g: Partial<Goal> & Pick<Goal, 'id' | 'priority'>): Goal => ({ type: 'milestone', title: g.id, featured: true, ...g }) as Goal;
const GOALS: Goal[] = [
  goal({ id: 'weight', priority: 4, type: 'body_composition', title: 'Weight 93 kg', start_value: 105, target: { metric: 'weight_kg', value: 93, direction: 'at_most' } } as Partial<Goal> & Pick<Goal, 'id' | 'priority'>),
  goal({ id: 'brighton', priority: 1, type: 'race_time', title: 'Brighton under 3:30', linked_race: 'brighton-2027', deadline: '2027-04-04', target: { distance: 'marathon', time: '3:30:00' } } as Partial<Goal> & Pick<Goal, 'id' | 'priority'>),
  goal({ id: '10k', priority: 2, type: 'race_time', title: '10k under 45', target: { distance: '10k', time: '45:00' } } as Partial<Goal> & Pick<Goal, 'id' | 'priority'>),
  goal({ id: '5k', priority: 3, type: 'race_time', title: '5k under 20', target: { distance: '5k', time: '20:00' } } as Partial<Goal> & Pick<Goal, 'id' | 'priority'>),
  goal({ id: 'not-featured', priority: 5, featured: false, type: 'race_time', title: 'Half', target: { distance: 'half', time: '1:40:00' } } as Partial<Goal> & Pick<Goal, 'id' | 'priority'>),
];

const run = (id: string, km: number, extra: Record<string, unknown> = {}): Run =>
  runFixture(id, { distance_m: km * 1000, moving_s: km * 300, avg_pace_s_per_km: 300, device: 'Venu X1', title: `Run · ${km.toFixed(1)} km`, ...extra }) as unknown as Run;

// Sun 4 Oct 2026 (US1.1). This week: Mon 28 Sep to Sun 4 Oct; three runs since Monday (US1.5).
const RUNS: Run[] = [
  run('2026-10-04-k3f7', 16, { best_efforts: [{ distance_m: 10000, label: '10k', time_s: 2760, plausible: true }] }),
  run('2026-10-01-p2rt', 8),
  run('2026-09-28-abcd', 10, { best_efforts: [{ distance_m: 5000, label: '5k', time_s: 1185, plausible: true }] }),
  run('2026-09-24-efgh', 12),
  run('2026-09-15-ijkl', 6),
];

interface Fixture {
  section?: SectionSettings;
  upcoming?: UpcomingRace[];
  goals?: Goal[];
  runs?: Run[];
  refresh?: RefreshRecord;
  predictions?: OwnerData['manualMetrics']['race_predictions'];
  health?: Partial<Record<HealthMetric, { date: string; value: number }[]>>;
}

function store(f: Fixture = {}): RunningStore {
  const runs = f.runs ?? RUNS;
  return {
    listRuns: async () => runs,
    getRun: async (id) => runs.find((r) => r.id === id),
    getRaceTrack: async () => undefined,
    getHealthSeries: async (metric) => (f.health ?? { weight_avg7: [{ date: '2026-10-03', value: 103.0 }] })[metric] ?? [],
    getRefreshRecord: async () =>
      f.refresh ?? { schema_version: 1, generated_at: '2026-10-04T08:00:00Z', sources: { intervals: { last_data_change_at: '2026-10-04T08:00:00Z', last_success_at_build: '2026-10-04T08:00:00Z' } } },
    getOwner: async () => ({
      section: 'section' in f ? f.section : SECTION,
      goals: f.goals ?? GOALS,
      upcomingRaces: f.upcoming ?? [BRIGHTON],
      races: [],
      overrides: [],
      exclusions: [],
      lab: [],
      manualMetrics: { training_status: [], race_predictions: f.predictions ?? [{ as_of: '2026-10-01', marathon: '3:28:40', '10k': '44:10' }] },
    }),
  };
}

function use(f: Fixture = {}) {
  setRunningStore(store(f));
  clearGoalsCache();
  clearLandingCache();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00Z')); // 11:00 in London
  use();
});
afterEach(() => {
  vi.useRealTimers();
  setRunningStore(undefined);
  clearGoalsCache();
  clearLandingCache();
});

const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
const text = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/ ([,.):])/g, '$1')
    .replace(/\( /g, '(')
    .trim();
const page = async () => clean(await container.renderToString(Landing, { request: new Request('https://alexanderwebber.com/running/') }));
const ids = (html: string, list: string) => [...(html.match(new RegExp(`${list}[\\s\\S]*?</ol>`))?.[0] ?? '').matchAll(/data-goal-id="([^"]+)"/g)].map((m) => m[1]);

describe('landing page (US1)', () => {
  it('US1.1: leads with the Brighton hero: date, 182 days, target, the Garmin prediction as of its date, the charity', async () => {
    const t = text(await page());
    expect(t).toContain('Brighton Marathon · 4 April 2027');
    expect(t).toContain('182 days to go');
    expect(t).toContain('Target: sub-3:30');
    expect(t).toContain('Garmin predicts 3:28:40 at current fitness (1 Oct 2026)');
    expect(t).toContain('For Martlets hospice');
  });

  it('US1.2: shows a tightened target and no longer the old one', async () => {
    use({ upcoming: [{ ...BRIGHTON, target_time: '3:20:00' }], goals: GOALS.map((g) => (g.id === 'brighton' ? ({ ...g, title: 'Brighton under 3:20', target: { distance: 'marathon', time: '3:20:00' } } as Goal) : g)) });
    const t = text(await page());
    expect(t).toContain('Target: sub-3:20');
    expect(t).not.toMatch(/3:30/);
  });

  it('US1.3: featured goals in priority order after the newly achieved, each with its target, current value and progress', async () => {
    const html = await page();
    // The 5k (achieved 28 Sep, six days ago) leads while it is new.
    expect(ids(html, 'data-featured-goals')).toEqual(['5k', 'brighton', '10k', 'weight']);
    const tenK = text(html.match(/data-goal-id="10k"[\s\S]*?<\/article>/)![0]);
    expect(tenK).toContain('Fastest 46:00 (in a longer run)');
    expect(tenK).toContain('Target sub-45:00');
    expect(tenK).toContain('1:00 to go');
    expect(tenK).toContain('Garmin predicts 44:10 at current fitness (1 Oct 2026)');
    expect(html.match(/data-goal-id="10k"[\s\S]*?<\/article>/)![0]).toContain('role="meter"');
  });

  it('US1.4: the weight goal reads "10.0 kg to go" with a progress bar from the start towards 93 kg', async () => {
    const card = (await page()).match(/data-goal-id="weight"[\s\S]*?<\/article>/)![0];
    expect(text(card)).toContain('10.0 kg to go');
    expect(text(card)).toContain('Now 103.0 kg (7-day average)');
    expect(card).toMatch(/role="meter"[^>]*aria-valuenow="17"/); // (103 - 105) / (93 - 105)
  });

  it('celebrates a newly achieved featured goal first (FR-042), then returns it to its priority place', async () => {
    const html = await page();
    const card = html.match(/<article[^>]*data-goal-id="5k"[\s\S]*?<\/article>/)![0];
    expect(card).toContain('data-status="achieved"');
    expect(card).toContain('goal-card-new');
    expect(text(card)).toContain('Achieved 28 Sep 2026 New');
    expect(text(card)).toContain('19:45');
    expect(card).toContain('href="/running/runs/2026-09-28-abcd/"');
    // Wider screens: the celebration and the lead goal span both columns; 10k and weight pair up.
    const wide = [...html.matchAll(/<li data-wide[^>]*>\s*<article[^>]*data-goal-id="([^"]+)"/g)].map((m) => m[1]);
    expect(wide).toEqual(['5k', 'brighton']);
    // Fourteen days on (12 Oct), it is back in priority order; the lead spans, and weight, left
    // alone on the last row, spans it.
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'));
    clearGoalsCache();
    clearLandingCache();
    const later = await page();
    expect(ids(later, 'data-featured-goals')).toEqual(['brighton', '10k', '5k', 'weight']);
    expect(later.match(/<article[^>]*data-goal-id="5k"[^>]*>/)![0]).not.toContain('goal-card-new');
    expect([...later.matchAll(/<li data-wide[^>]*>\s*<article[^>]*data-goal-id="([^"]+)"/g)].map((m) => m[1])).toEqual(['brighton', 'weight']);
  });

  it('US1.5: this week (runs, distance, time) against last week, and the latest run linking to its page', async () => {
    const html = await page();
    const week = text(html.match(/data-this-week[\s\S]*?<\/section>/)![0]);
    expect(week).toContain('28 Sep to 4 Oct');
    expect(week).toContain('Runs 3 Last week 1');
    expect(week).toContain('Distance 34.0 km Last week 12.0 km');
    expect(week).toContain('Time 2:50:00 Last week 1:00:00');
    expect(week).toContain('22.0 km more than last week so far.');
    const latest = html.match(/data-latest-run[\s\S]*?<\/section>/)![0];
    expect(latest).toContain('<a href="/running/runs/2026-10-04-k3f7/">Run · 16.0 km</a>');
    expect(text(latest)).toContain('4 Oct 2026');
  });

  it('shows the training build since build_start, with the longest run', async () => {
    const t = text((await page()).match(/data-training-build[\s\S]*?<\/figure>/)![0]);
    expect(t).toContain('Weekly distance since 14 Sep 2026: 52.0 km in 5 runs, 34.0 km this week.');
    expect(t).toContain('Longest run: 16.0 km on 4 Oct 2026');
  });

  it('shows a zero week cleanly', async () => {
    use({ runs: [run('2026-09-22-aaaa', 10)] });
    const week = text((await page()).match(/data-this-week[\s\S]*?<\/section>/)![0]);
    expect(week).toContain('No runs yet this week.');
    expect(week).toContain('Runs 0 Last week 1');
  });

  it('US1.6: no story link or placeholder until section.yaml has one; then a link', async () => {
    expect(await page()).not.toContain('data-story-link');
    use({ section: { ...SECTION, story_link: { href: '/story/', label: "Alex's story: why Brighton" } } as SectionSettings });
    expect(await page()).toContain('<p class="story-link" data-story-link><a href="/story/">Alex&#39;s story: why Brighton</a></p>');
  });

  it('US1.7: data two days old still renders fully, with the last update and the stale notice', async () => {
    use({ refresh: { schema_version: 1, generated_at: '2026-10-02T08:00:00Z', sources: { intervals: { last_data_change_at: '2026-10-02T08:00:00Z', last_success_at_build: '2026-10-02T08:00:00Z' } } } });
    const html = await page();
    expect(text(html)).toContain('Last updated 2 Oct 2026, 09:00');
    expect(html).toMatch(/<p class="stale-notice" data-stale-notice>/); // not hidden
    expect(text(html)).toContain('182 days to go');
  });

  it('labels a treadmill latest run and never draws a map (FR-058)', async () => {
    use({ runs: [run('2026-10-04-tttt', 5, { type: 'indoor', treadmill: true, title: 'Treadmill run · 5.0 km' }), ...RUNS.slice(1)] });
    const latest = (await page()).match(/data-latest-run[\s\S]*?<\/section>/)![0];
    expect(latest).toContain('data-treadmill');
    expect(text(latest)).toContain('Treadmill');
    expect(await page()).not.toMatch(/maplibre|data-race-map|<canvas/i);
  });

  it('links only to shipped areas (FR-027), and the fundraising slot renders nothing (FR-025)', async () => {
    const html = await page();
    const links = html.match(/data-section-links[\s\S]*?<\/nav>/)![0];
    expect([...links.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(['/running/goals/', '/running/training/', '/running/races/', '/running/health/']);
    expect(html).not.toMatch(/fundrais/i);
  });

  it('puts Garmin attribution under the page heading, the hero heading, the chart and every Garmin card (FR-077)', async () => {
    const html = await page();
    expect(html).toMatch(/<h1>Running<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1, Garmin Index S2<\/p>/);
    expect(html).toMatch(/id="hero-title">[\s\S]*?<\/h2>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin<\/p>/);
    expect(html).toMatch(/Training build<\/h3>\s*<div class="chart-figure-source"><p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1<\/p>/);
    expect(html.match(/data-latest-run[\s\S]*?<\/section>/)![0]).toContain('Source: Garmin Venu X1');
    expect(html.match(/data-goal-id="weight"[\s\S]*?<\/article>/)![0]).toContain('Source: Garmin Index S2');
  });

  it('race day, then result coming soon (quickstart 7d)', async () => {
    vi.setSystemTime(new Date('2027-04-04T08:00:00Z'));
    use();
    expect(text(await page())).toContain('Race day');
    vi.setSystemTime(new Date('2027-04-05T08:00:00Z'));
    use();
    const hero = text((await page()).match(/data-hero[\s\S]*?<\/section>/)![0]);
    expect(hero).toContain('Result coming soon');
    expect(hero).not.toContain('Garmin predicts'); // the prediction is moot once the race is run
  });

  it('renders without a focus race (no section.yaml): no hero, and the rest still shows', async () => {
    use({ section: undefined });
    const html = await page();
    expect(html).not.toContain('data-hero');
    expect(html).toContain('data-this-week');
  });

  it('has its own title, description and share image', async () => {
    const html = await page();
    expect(html).toContain('<title>Running · Alexander Webber</title>');
    expect(html).toContain(`<meta name="description" content="Alexander Webber's running: Brighton Marathon on 4 Apr 2027: 182 days to go, aiming for sub-3:30, for Martlets hospice. Goals, this week's training and the latest run.">`);
    expect(html).toContain('/og/running.png');
  });
});

describe('landing share image (FR-072)', () => {
  it('says how many days to Brighton, with the target and the charity', async () => {
    const card = landingCard((await loadLanding('2026-10-04')).focus);
    expect(card).toMatchObject({ eyebrow: 'Running', title: '182 days to Brighton', subtitle: 'Target: sub-3:30 · For Martlets hospice' });
    expect(card.attribution).toBeUndefined();
  });

  it('follows the race state, and has a plain card with no focus race', async () => {
    expect(landingCard((await loadLanding('2027-04-03')).focus).title).toBe('1 day to Brighton');
    expect(landingCard((await loadLanding('2027-04-04')).focus).title).toBe('Race day: Brighton Marathon');
    expect(landingCard((await loadLanding('2027-04-06')).focus).title).toBe('Brighton Marathon: result coming soon');
    expect(landingCard(undefined).title).toBe('Running');
  });
});

describe('run page (T102)', () => {
  const render = (r: Run) => container.renderToString(RunPage, { props: { run: r }, params: { id: r.id }, request: new Request(`https://alexanderwebber.com/running/runs/${r.id}/`) });

  it('shows the summary figures, the date and never a time of day, map or location', async () => {
    const html = clean(await render(run('2026-10-04-k3f7', 16, { moving_s: 4800, avg_pace_s_per_km: 300, hr: { avg: 141, max: 160 } })));
    const t = text(html);
    expect(t).toContain('Run · 16.0 km');
    expect(t).toContain('Date 4 Oct 2026');
    expect(t).toContain('Distance 16.00 km');
    expect(t).toContain('Moving time 1:20:00');
    expect(t).toContain('Average pace 5:00 /km');
    expect(t).toContain('Average heart rate 141 bpm');
    expect(html).toMatch(/<h1>Run · 16.0 km<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1<\/p>/);
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(html).not.toMatch(/maplibre|data-race-map|<canvas|latitude|longitude/i);
    expect(html).toContain('/og/running-run.png');
    expect(html).toContain('<title>Run · 16.0 km, 4 Oct 2026 · Running · Alexander Webber</title>');
  });

  it('labels a treadmill run and leaves out heart rate when not recorded (FR-048, FR-058)', async () => {
    const html = clean(await render(run('2026-10-04-tttt', 5, { type: 'indoor', treadmill: true, title: 'Treadmill run · 5.0 km' })));
    expect(html).toContain('data-treadmill');
    expect(text(html)).not.toContain('heart rate');
  });
});
