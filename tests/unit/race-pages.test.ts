// The races page and race pages (T133, with T130–T131), rendered with Astro's container API over a
// fake store with "today" pinned, plus the static map's geometry and the share cards. The owner's
// page as it is today (no races yet; owner, 2026-10-24) is checked word for word. Browser checks
// over synthetic races are in tests/e2e/races.spec.ts. Every race here is synthetic.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import RacePage from '../../src/sections/running/components/RacePage.astro';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import { loadRaces } from '../../src/sections/running/data/races.ts';
import type { OwnerData, Race, RaceTrack, Run, RunningStore, UpcomingRace } from '../../src/sections/running/data/store/index.ts';
import { elevationByKm, markerStep, routeJson, staticMap } from '../../src/sections/running/domain/race-map.ts';
import { raceCard } from '../../src/sections/running/og/race.ts';
import { racesCard } from '../../src/sections/running/og/races.png.ts';
import Races from '../../src/sections/running/pages/races.astro';
import { run as runFixture } from '../helpers/temp-repo.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com', trailingSlash: 'always' } });
});

const effort = (distance_m: number, time_s: number) => ({ distance_m, label: String(distance_m), time_s, plausible: true });
const run = (id: string, extra: Record<string, unknown> = {}): Run => runFixture(id, { device: 'Venu X1', ...extra }) as unknown as Run;
const BRIGHTON: UpcomingRace = { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon', target_time: '3:20:00', url: 'https://example.org/brighton' };
const SECTION = { focus_race: { race_id: 'brighton-2027', build_start: '2026-09-05', charity: { name: 'Martlets' } } };

// Today's shape: no races, a 5k track session (a week ago), a 10k inside a tempo run, a half.
const TODAY_RUNS: Run[] = [
  run('2026-10-17-ofka', { distance_m: 5010, title: 'Track run · 5.0 km', best_efforts: [effort(5000, 1184)] }),
  run('2026-10-09-temp', { distance_m: 10_740, best_efforts: [effort(5000, 1350), effort(10_000, 2760)] }),
  run('2026-04-05-half', { distance_m: 21_300, best_efforts: [effort(5000, 1400), effort(10_000, 2900), effort(21_097.5, 6223)] }),
];

function store(runs: Run[], owner: Partial<OwnerData> = {}, tracks: RaceTrack[] = []): RunningStore {
  return {
    listRuns: async () => runs,
    getRun: async (id) => runs.find((r) => r.id === id),
    getRaceTrack: async (id) => tracks.find((t) => t.id === id),
    getHealthSeries: async () => [],
    getRefreshRecord: async () => ({ schema_version: 1, generated_at: '2026-10-24T08:00:00Z', sources: { intervals: { last_data_change_at: '2026-10-24T08:00:00Z', last_success_at_build: '2026-10-24T08:00:00Z' } } }),
    getCampaignFigures: async () => [],
    getOwner: async () => ({ section: SECTION, goals: [], upcomingRaces: [BRIGHTON], races: [], overrides: [], exclusions: [], lab: [], manualMetrics: { training_status: [], race_predictions: [] }, campaigns: [], ...owner }),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
  setRunningStore(store(TODAY_RUNS));
});
afterEach(() => {
  vi.useRealTimers();
  setRunningStore(undefined);
});

const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
const text = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<caption[\s\S]*?<\/caption>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/ ([,.)])/g, '$1')
    .trim();
const section = (html: string, attr: string) => html.match(new RegExp(`<section[^>]*${attr}[\\s\\S]*?</section>`))![0];

describe('races page with no races yet (owner, 2026-10-24)', () => {
  it('shows the upcoming races first, then the PB table, then where the history starts', async () => {
    const html = clean(await container.renderToString(Races, { request: new Request('https://alexanderwebber.com/running/races/') }));
    const order = ['data-upcoming-races', 'data-pb-table', 'data-race-history'].map((a) => html.indexOf(a));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(section(html, 'data-upcoming-races'))).toBe('Upcoming races Focus race Brighton Marathon 4 April 2027 · Marathon · Target: sub-3:20 162 days to go');
    expect(section(html, 'data-upcoming-races')).toContain('<a href="https://example.org/brighton">Brighton Marathon</a>');
    expect(text(section(html, 'data-pb-table'))).toBe(
      'Personal bests Source: Garmin Venu X1 Distance Race Fastest in any run ' +
        '5k No race yet 19:44 New 17 Oct 2026 ' +
        '10k No race yet 46:00 9 Oct 2026 (in a longer run) ' +
        'Half marathon No race yet 1:43:43 5 Apr 2026 ' +
        'Marathon Not run yet: Brighton Marathon on 4 Apr 2027 will be the first.',
    );
    expect(section(html, 'data-pb-table')).toContain('<a href="/running/runs/2026-10-17-ofka/">17 Oct 2026</a>');
    expect(text(section(html, 'data-race-history'))).toBe('Race history No races yet: Brighton Marathon on 4 Apr 2027 will be the first.');
    expect(html).toMatch(/<h1>Races<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1<\/p>/);
    expect(html).toContain('/og/running-races.png');
    expect(html).toContain('aria-current="page"');
  });

  it('lists races newest first once there are some, with the PB badge and watch-time label', async () => {
    const race = run('2026-10-18-p2rt', { is_race: true, title: 'Harbour 10k', distance_m: 10_060, elapsed_s: 2671 });
    const races: Race[] = [
      { slug: 'harbour-10k-2026', run_id: race.id, name: 'Harbour 10k', date: '2026-10-18', distance: '10k', official_time: '44:30' },
      { slug: '2019-example-10k', date: '2019-10-13', name: 'Example 10k', distance: '10k', official_time: '52:30' },
    ];
    setRunningStore(store([...TODAY_RUNS, race], { races }));
    const html = clean(await container.renderToString(Races, { request: new Request('https://alexanderwebber.com/running/races/') }));
    const history = section(html, 'data-race-history');
    expect([...history.matchAll(/data-race-slug="([^"]+)"/g)].map((m) => m[1])).toEqual(['harbour-10k-2026', '2019-example-10k']);
    expect(text(history)).toBe('Race history Source: Garmin Venu X1 Harbour 10k New PB 18 Oct 2026 10k 44:30 Example 10k 13 Oct 2019 10k 52:30');
    expect(history).toContain('<a href="/running/races/harbour-10k-2026/">Harbour 10k</a>');
    expect(text(section(html, 'data-pb-table'))).toContain('10k 44:30 New Harbour 10k, 18 Oct 2026 Race is fastest');
  });
});

const TRACK: RaceTrack = {
  schema_version: 1,
  id: '2026-05-17-k3f7',
  points: Array.from({ length: 50 }, (_, i) => [0.3 + i * 0.0006, 0.6 + Math.sin(i / 8) * 0.004, i * 431.4, 10 + (i % 7)] as [number, number, number, number | null]),
  trim_ends_m: 0,
  bbox: [0.3, 0.596, 0.3294, 0.604],
  source: 'intervals',
};

describe('race page (T133)', () => {
  const HALF = run('2026-05-17-k3f7', { is_race: true, title: 'Riverside Half', distance_m: 21_140, elapsed_s: 6075, track_ref: 'race-tracks/2026-05-17-k3f7', series: { x_dist_m: [0, 21_140], x_elapsed_s: [0, 6075], pace: [287, 287] } });
  const ENTRY: Race = { slug: 'riverside-half-2026', run_id: HALF.id, name: 'Riverside Half Marathon', date: '2026-05-17', distance: 'half', official_time: '1:41:07', position: 212, results_url: 'https://example.org/results', note: 'Into a headwind.' };

  async function page(runs: Run[], races: Race[], slug: string) {
    setRunningStore(store(runs, { races }, [TRACK]));
    const data = await loadRaces('2026-10-24');
    const race = data.history.find((r) => r.slug === slug)!;
    return clean(await container.renderToString(RacePage, { props: { race, track: data.tracks.get(slug), photos: [], routeSrc: `/running/races/${slug}/route.json`, image: `/og/running-races-${slug}.png`, racesHref: '/running/races/' } }));
  }

  it('shows the official result beside the watch time, the static map, and the run detail (US4.3, US4.4)', async () => {
    const html = await page([HALF], [ENTRY], 'riverside-half-2026');
    expect(text(section(html, 'data-race-result'))).toBe(
      'Result Official time 1:41:07 (watch: 1:41:15) Date 17 May 2026 Distance Half marathon Position 212 Into a headwind. Official results · This run in the training log',
    );
    expect(html).toContain('<a href="https://example.org/results">Official results</a>');
    expect(html).toMatch(/<h1>Riverside Half Marathon<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1<\/p>/);
    const map = section(html, 'data-race-map');
    expect(map).toContain('data-route-src="/running/races/riverside-half-2026/route.json"');
    expect(map).toMatch(/<svg viewBox="0 0 1000 \d+" role="img"/);
    expect(map).toMatch(/<button type="button" class="map-load" data-map-load hidden>/);
    expect(map).toContain('Source: Garmin Venu X1');
    expect(map).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(map).not.toMatch(/\b0\.3\d{3}|\b0\.6\d{3}/); // projected figures only: no coordinates in the page
    expect(html).toContain('data-run-summary');
    expect(html).toContain('/og/running-races-riverside-half-2026.png');
  });

  it('has no map or run detail for a hand-entered race, and says why', async () => {
    const html = await page([], [{ slug: '2019-example-10k', date: '2019-10-13', name: 'Example 10k', distance: '10k', official_time: '52:30' }], '2019-example-10k');
    expect(html).not.toContain('data-race-map');
    expect(html).not.toContain('data-run-summary');
    expect(text(section(html, 'data-race-result'))).toBe('Result Official time 52:30 Date 13 October 2019 Distance 10k Entered by hand, so there is no recorded run to show.');
    expect(html).not.toContain('data-garmin-attribution>Source: Garmin');
  });

  it('labels a watch time when there is no official one, and shows no map without a track', async () => {
    const html = await page([{ ...HALF, track_ref: undefined } as Run], [{ ...ENTRY, official_time: undefined }], 'riverside-half-2026');
    expect(text(section(html, 'data-race-result'))).toMatch(/^Result Finish time 1:41:15 \(watch time\)/);
    expect(html).not.toContain('data-race-map');
  });
});

describe('static map geometry (T131)', () => {
  it('projects the route into the SVG with start, finish and a marker every 2 km for a half', () => {
    const map = staticMap(TRACK);
    expect(map.width).toBe(1000);
    expect(map.path.startsWith('M')).toBe(true);
    expect(map.path.split('L')).toHaveLength(50);
    expect(map.step_km).toBe(2);
    expect(map.markers.map((m) => m.km)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    for (const p of [map.start, map.finish, ...map.markers]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(map.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(map.height);
    }
    expect(map.height / map.width).toBeLessThanOrEqual(1 / 0.8);
  });

  it('spaces markers by distance', () => {
    expect([markerStep(5), markerStep(10), markerStep(21.1), markerStep(42.2)]).toEqual([1, 1, 2, 5]);
  });

  it('gives the profile per km and the route in GeoJSON order', () => {
    expect(elevationByKm(TRACK).slice(0, 3)).toEqual([
      { km: 0, elev_m: 10 },
      { km: 1, elev_m: 12 },
      { km: 2, elev_m: 15 },
    ]);
    const route = routeJson(TRACK);
    expect(route.coordinates[0]).toEqual([0.6, 0.3]);
    expect(route.bounds).toEqual([
      [0.596, 0.3],
      [0.604, 0.3294],
    ]);
  });
});

describe('share cards (T133)', () => {
  it("words a race's card, with Garmin attribution only for a watch time", async () => {
    setRunningStore(store([{ ...run('2026-05-17-k3f7'), is_race: true, title: 'Riverside Half', distance_m: 21_140, elapsed_s: 6075 }], { races: [{ slug: 'riverside-half-2026', run_id: '2026-05-17-k3f7', name: 'Riverside Half Marathon', date: '2026-05-17', distance: 'half', official_time: '1:41:07', position: 212 }] }));
    const [official] = (await loadRaces('2026-10-24')).history;
    expect(raceCard(official!)).toMatchObject({ eyebrow: 'Running · Race', title: 'Riverside Half Marathon', subtitle: '1:41:07 (official) · Half marathon · 17 May 2026 · Position 212' });
    expect(raceCard(official!)).not.toHaveProperty('attribution');
    expect(raceCard({ ...official!, official: false, time_s: 6075 })).toMatchObject({ subtitle: '1:41:15 · Half marathon · 17 May 2026 · Position 212', attribution: 'Source: Garmin Venu X1' });
  });

  it('words the races card from the next race and the history', async () => {
    const data = await loadRaces('2026-10-24');
    expect(racesCard(data)).toMatchObject({ title: 'Races and personal bests', subtitle: 'Next: Brighton Marathon, 162 days to go. No races yet.' });
  });
});
