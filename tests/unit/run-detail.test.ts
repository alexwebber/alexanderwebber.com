// A run's detail page (T123's fixture half; US3.2–US3.4, US3.6, FR-011, FR-013, FR-047, FR-048,
// FR-058, FR-077) and the pure functions behind it, rendered with Astro's container API over
// pinned fixtures. The browser checks over the real build are in tests/e2e/run-detail.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Run } from '../../src/sections/running/data/store/index.ts';
import { effortRows, seriesCharts, splitRows, tableRows, timeTicks, zoneRows, formatAxisTime } from '../../src/sections/running/domain/run-detail.ts';
import RunPage from '../../src/sections/running/pages/runs/[id].astro';
import { stripTags } from '../helpers/html.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com', trailingSlash: 'always' } });
});

const ZONES = [
  { zone: 1, low_bpm: 88, high_bpm: 105, seconds: 2 },
  { zone: 2, low_bpm: 105, high_bpm: 123, seconds: 44 },
  { zone: 3, low_bpm: 123, high_bpm: 140, seconds: 1393 },
  { zone: 4, low_bpm: 140, high_bpm: 158, seconds: 1532 },
  { zone: 5, low_bpm: 158, high_bpm: 175, seconds: 0 },
];

/** A 10.07 km run like the 23 Oct 2026 check run, with every panel's data. */
function fullRun(extra: Record<string, unknown> = {}): Run {
  const n = 120;
  const x_dist_m = Array.from({ length: n }, (_, i) => Math.round((10_069 * i) / (n - 1)));
  const x_elapsed_s = Array.from({ length: n }, (_, i) => Math.round((2984 * i) / (n - 1)));
  const wave = (base: number, amp: number) => Array.from({ length: n }, (_, i) => base + amp * Math.sin(i / 7));
  return runFixture('2026-10-23-bv7w', {
    title: 'Run · 10.1 km',
    distance_m: 10_069,
    moving_s: 2983,
    elapsed_s: 2984,
    avg_pace_s_per_km: 296.3,
    best_pace_s_per_km: 280,
    elevation_gain_m: 54.7,
    elevation_loss_m: 55.8,
    hr: { avg: 139, max: 151 },
    cadence_avg: 161,
    stride_m_avg: 1.26,
    power_w_avg: 546,
    device: 'Venu X1',
    dynamics: { gct_ms: 281.6, gct_balance_pct: 50.3, vert_osc_mm: 114.6, vert_ratio_pct: 9 },
    splits: [
      ...Array.from({ length: 10 }, (_, k) => ({ km: k + 1, time_s: 290 + k, pace_s_per_km: 290 + k, hr: 130 + k, elev_delta_m: k % 2 ? 2 : -1 })),
      { km: 11, time_s: 17, pace_s_per_km: 246.4, hr: 147, elev_delta_m: 0 },
    ],
    hr_zones: ZONES,
    series: { x_dist_m, x_elapsed_s, pace: wave(296, 20), hr: wave(139, 8), elev: wave(40, 10), cadence: wave(161, 3), power: wave(546, 40) },
    best_efforts: [
      { distance_m: 5000, label: '5k', time_s: 1479.5, plausible: true },
      { distance_m: 1000, label: '1k', time_s: 280, plausible: true },
      { distance_m: 3000, label: '3k', time_s: 500, plausible: false },
    ],
    ...extra,
  }) as unknown as Run;
}

/** A treadmill run with no heart rate, power or running dynamics (US3.4, US3.6). */
const bareRun = (extra: Record<string, unknown> = {}) =>
  runFixture('2026-10-22-tttt', {
    type: 'indoor',
    treadmill: true,
    title: 'Treadmill run · 5.0 km',
    series: { x_dist_m: [0, 2500, 5000], x_elapsed_s: [0, 750, 1500], pace: [300, 300, 300] },
    best_efforts: [{ distance_m: 1000, label: '1k', time_s: 290, plausible: true }],
    ...extra,
  }) as unknown as Run;

const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
const text = (html: string) =>
  stripTags(html)
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const render = async (r: Run) =>
  clean(await container.renderToString(RunPage, { props: { run: r }, params: { id: r.id }, request: new Request(`https://alexanderwebber.com/running/runs/${r.id}/`) }));
const panel = (html: string, attr: string) => html.match(new RegExp(`${attr}[\\s\\S]*?</section>`))?.[0] ?? '';

describe('run detail domain', () => {
  it('marks the last part-kilometre split with the distance it ends at', () => {
    const rows = splitRows(fullRun());
    expect(rows.map((r) => r.km).slice(-2)).toEqual(['10', '10.07']);
    expect(rows.at(-1)!.partial).toBe(true);
  });

  it("shows Garmin's five zones, named from their number", () => {
    expect(zoneRows(fullRun()).map((z) => [z.zone, z.name, z.low_bpm, z.high_bpm, z.seconds])).toEqual(
      ZONES.map((z, i) => [z.zone, ['Warm Up', 'Easy', 'Aerobic', 'Threshold', 'Maximum'][i], z.low_bpm, z.high_bpm, z.seconds]),
    );
    expect(zoneRows(fullRun()).reduce((sum, z) => sum + z.share, 0)).toBeCloseTo(1, 9);
    expect(zoneRows(bareRun())).toEqual([]);
  });

  it('keeps plausible best efforts only, shortest first (T160)', () => {
    expect(effortRows(fullRun()).map((e) => e.label)).toEqual(['1k', '5k']);
    expect(effortRows(fullRun())[1]!.pace_s_per_km).toBeCloseTo(295.9, 6);
  });

  it('charts only the series that were recorded, pace inverted and cut to its 2nd–98th percentile', () => {
    expect(seriesCharts(fullRun()).map((c) => c.key)).toEqual(['pace', 'hr', 'elev', 'cadence', 'power']);
    expect(seriesCharts(bareRun()).map((c) => c.key)).toEqual(['pace']);
    const pace = seriesCharts(fullRun())[0]!;
    expect(pace.invert).toBe(true);
    expect(pace.domain![0]).toBeGreaterThan(276);
    expect(pace.domain![1]).toBeLessThan(316);
    // A series of nulls (nothing recorded) gives no chart.
    expect(seriesCharts(fullRun({ series: { ...fullRun().series, power: fullRun().series.x_dist_m.map(() => null) } })).map((c) => c.key)).not.toContain('power');
  });

  it('tabulates a series per kilometre or per 5 minutes, ending at the run itself', () => {
    const rows = tableRows([0, 0.5, 1, 1.5, 2, 2.4], [300, 310, 290, null, 280, 270], 'distance', 2.5);
    expect(rows).toEqual([
      { at: 1, value: 305 },
      { at: 2, value: 290 },
      { at: 2.5, value: 275 },
    ]);
    expect(tableRows([0, 600, 1200], [1, 2, 3], 'time', 1250).map((r) => r.at)).toEqual([300, 900, 1250]);
    // A marathon on the time axis widens the buckets so the table stays short.
    expect(tableRows(Array.from({ length: 600 }, (_, i) => i * 30), Array(600).fill(1), 'time', 18_000, 50).length).toBeLessThanOrEqual(50);
  });

  it('ticks elapsed time at round minutes, never a clock time', () => {
    expect(timeTicks(2984)).toEqual([0, 900, 1800, 2700]);
    expect(timeTicks(12_600).every((t) => t % 1800 === 0)).toBe(true);
    expect(formatAxisTime(2700)).toBe('45 min');
    expect(formatAxisTime(5400)).toBe('1:30');
  });
});

describe('run page (T121)', () => {
  it('US3.2: shows every recorded figure, the charts, zones, splits, best efforts and dynamics', async () => {
    const html = await render(fullRun());
    const t = text(html);
    for (const figure of [
      'Date 23 Oct 2026',
      'Distance 10.07 km',
      'Moving time 49:43',
      'Elapsed time 49:44',
      'Average pace 4:56 /km',
      'Best pace 4:40 /km',
      'Elevation gain 55 m',
      'Elevation loss 56 m',
      'Average heart rate 139 bpm',
      'Max heart rate 151 bpm',
      'Cadence 161 spm',
      'Stride length 1.26 m',
      'Average power 546 W',
      'Ground contact time 282 ms',
      'Ground contact balance 50.3% L / 49.7% R',
      'Vertical oscillation 11.5 cm',
      'Vertical ratio 9.0%',
    ]) {
      expect(t).toContain(figure);
    }
    for (const chart of ['Pace', 'Heart rate', 'Elevation', 'Cadence', 'Power']) {
      expect(html).toContain(`>${chart}</h3>`);
    }
    expect(t).toContain('Zone 3 Aerobic 123–140 bpm 23:13');
    expect(t).toContain('Zone 4 Threshold 140–158 bpm 25:32');
    expect(panel(html, 'data-splits')).toContain('<th scope="row">10.07</th>');
    expect(text(panel(html, 'data-run-efforts'))).toMatch(/1k 4:40 4:40 \/km 5k 24:40 4:56 \/km/);
    expect(panel(html, 'data-run-efforts')).not.toContain('3k'); // implausible
  });

  it('plots against distance by default with a CSS-only switch to elapsed time, never clock time (FR-013)', async () => {
    const html = await render(fullRun());
    const toggle = html.match(/<fieldset class="toggle">[\s\S]*?<\/fieldset>/)![0];
    expect(toggle).toMatch(/value="distance" data-index="0" checked/);
    expect(toggle).toMatch(/value="time" data-index="1"(?! checked)/);
    expect(html).toContain('data-axis="distance"');
    expect(html).toContain('data-axis="time"');
    expect(html).toContain('against elapsed time');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}|\b\d{1,2}:\d{2} ?(?:am|pm)\b/i);
    // No script beyond the shared freshness one (which the container leaves out): the switch is CSS.
    expect((html.match(/<script\b/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it('US3.3: the date only, and no map, route, place name or provider text anywhere', async () => {
    const html = await render(fullRun({ title: 'Run · 10.1 km', note: 'Steady, felt good.' }));
    expect(html).not.toMatch(/06:42|start_time|latlng|maplibre|data-race-map|<canvas|latitude|longitude/i);
    expect(html).toContain('<time datetime="2026-10-23">');
    expect(text(html)).toContain('Steady, felt good.');
  });

  it('US3.4, US3.6: a treadmill run with no heart rate, power or dynamics leaves those panels out', async () => {
    const html = await render(bareRun());
    const t = text(html);
    expect(html).toContain('data-treadmill');
    expect(html).not.toMatch(/data-run-dynamics|data-hr-zones|data-splits|data-race-map/);
    expect(t).not.toMatch(/heart rate|Elevation gain|Power|Cadence|0 bpm|0 W\b/i);
    expect(html).toContain('data-series="pace"');
    expect(text(panel(html, 'data-run-efforts'))).toContain("A treadmill run's efforts don't count towards personal bests or goals.");
  });

  it('names the run\'s own watch under the heading and at each panel (FR-077), and sits under Training', async () => {
    const html = await render(fullRun());
    expect(html).toMatch(/<h1>Run · 10.1 km<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin Venu X1<\/p>/);
    for (const attr of ['data-splits', 'data-run-efforts', 'data-run-dynamics']) {
      expect(panel(html, attr)).toContain('Source: Garmin Venu X1');
    }
    expect(html.match(/data-series="pace"[\s\S]*?<\/figure>/)![0]).toContain('Source: Garmin Venu X1');
    expect(html).toContain('<a href="/running/training/" aria-current="true">Training</a>');
    expect(html).toContain('href="/running/training/2026/"');
    expect(html).toContain('/og/running-run.png');
  });
});
