// The shared shell's components (T072-T076, T152), rendered with Astro's container API. Covers
// their documented contracts: text alternatives and data tables (FR-071), no client JS in
// charts, CSS-only ranges (FR-068), page metadata (FR-072), freshness without JS (FR-005/006)
// and Garmin attribution (FR-077). Browser behaviour (layout, keyboard, axe) is in
// tests/a11y/shell.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { RefreshRecord, RunningStore, SectionSettings } from '../../src/sections/running/data/store/index.ts';
import BarChart from '../../src/shared/charts/BarChart.astro';
import ChartFigure from '../../src/shared/charts/ChartFigure.astro';
import LineChart from '../../src/shared/charts/LineChart.astro';
import ProgressBar from '../../src/shared/charts/ProgressBar.astro';
import RangeToggle from '../../src/shared/charts/RangeToggle.astro';
import Base from '../../src/shared/layout/Base.astro';
import Nav from '../../src/shared/layout/Nav.astro';
import GarminAttribution from '../../src/sections/running/components/GarminAttribution.astro';
import LastUpdated from '../../src/sections/running/components/LastUpdated.astro';
import SectionLayout from '../../src/sections/running/components/SectionLayout.astro';
import { setRunningStore } from '../../src/sections/running/data/load.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com' } });
});

/** Rendered HTML without Astro's scoped-style attributes, so assertions read like the markup. */
async function render(component: Parameters<AstroContainer['renderToString']>[0], props: Record<string, unknown> = {}, slots: Record<string, string> = {}, path = '/'): Promise<string> {
  const html = await container.renderToString(component, { props, slots, request: new Request(`https://alexanderwebber.com${path}`) });
  return html.replace(/ data-astro-cid-[a-z0-9]+(="")?/g, '');
}

const kg = (v: number) => `${v} kg`;
const weight = [
  { date: '2026-01-05', value: 101.2 },
  { date: '2026-03-01', value: null },
  { date: '2026-06-01', value: 99.4 },
  { date: '2026-10-12', value: 97.8 },
];

/** The text of the element with this id. */
function textOf(html: string, id: string): string | undefined {
  return new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1];
}

describe('LineChart', () => {
  it('is an SVG image named by its own <title> and <desc>', async () => {
    const html = await render(LineChart, { title: 'Weight', desc: 'Down 3.4 kg this year', series: [{ label: 'Weight', points: weight }], format: kg, id: 'w' });
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby="w-title w-desc"/);
    expect(textOf(html, 'w-title')).toBe('Weight');
    expect(textOf(html, 'w-desc')).toBe('Down 3.4 kg this year');
  });

  it('breaks the line at a gap and labels the last value', async () => {
    const html = await render(LineChart, { title: 'Weight', desc: 'd', series: [{ label: 'Weight', points: weight }], format: kg });
    const d = /class="chart-line" d="([^"]+)"/.exec(html)![1]!;
    expect(d.match(/M/g)).toHaveLength(2);
    expect(html).toContain('class="chart-dot-label"');
    expect(html).toContain('>97.8 kg<');
    expect(html).toContain('title="Weight: 97.8 kg, 12 Oct 2026"');
  });

  it('draws a labelled target and reference markers inside the y range', async () => {
    const html = await render(LineChart, {
      title: 'Weight',
      desc: 'd',
      series: [{ label: 'Weight', points: weight }],
      format: kg,
      target: { value: 93, label: 'Target 93 kg' },
      markers: [{ date: '2026-06-02', value: 99.0, label: 'DEXA' }],
    });
    expect(html).toContain('Target 93 kg');
    expect(html).toContain('>DEXA<');
    // The y axis reaches down to the target
    expect(html).toMatch(/>9[0-3](\.5)? kg</);
  });

  it('shows only the chosen date range', async () => {
    const html = await render(LineChart, { title: 'W', desc: 'd', series: [{ label: 'Weight', points: weight }], from: '2026-07-01', to: '2026-10-17' });
    expect(html).not.toContain('101.2');
    expect(html).toContain('>97.8<');
  });

  it('has a legend only for two or more series', async () => {
    const one = await render(LineChart, { title: 'W', desc: 'd', series: [{ label: 'A', points: weight }] });
    const two = await render(LineChart, { title: 'W', desc: 'd', series: [{ label: 'A', points: weight }, { label: 'B', points: weight }] });
    expect(one).not.toContain('chart-legend');
    expect(two).toContain('chart-legend');
    expect(two).toContain('--key-color: var(--series-2)');
  });

  it('ships no client JS', async () => {
    const html = await render(LineChart, { title: 'W', desc: 'd', series: [{ label: 'A', points: weight }] });
    expect(html).not.toContain('<script');
  });

  it('draws a dot series as one path of round dots, with no end label of its own (T139)', async () => {
    const html = await render(LineChart, {
      title: 'Body fat',
      desc: 'd',
      series: [
        { label: 'Readings', points: weight, marks: 'dots' },
        { label: '7-day average', points: weight },
      ],
      format: kg,
    });
    const d = /class="chart-dots" d="([^"]+)"/.exec(html)![1]!;
    expect(d.match(/h0/g)).toHaveLength(3); // the null is no dot
    expect(html.match(/class="chart-dot-label"/g)).toHaveLength(1);
    expect(html).toContain('class="is-dots"');
  });

  it('shades a band only on days that have one', async () => {
    const band = { label: 'Baseline', points: [{ date: '2026-06-01', low: 98, high: 100 }, { date: '2026-06-02', low: 98, high: 100 }, { date: '2026-10-12', low: 97, high: 99 }] };
    const html = await render(LineChart, { title: 'HRV', desc: 'd', series: [{ label: 'A', points: weight }], band });
    const d = /class="chart-band" d="([^"]+)"/.exec(html)![1]!;
    expect(d.match(/Z/g)).toHaveLength(2);
    expect(html).toContain('Baseline');
    const none = await render(LineChart, { title: 'HRV', desc: 'd', series: [{ label: 'A', points: weight }], band: { label: 'Baseline', points: [] } });
    expect(none).not.toContain('chart-band');
  });

  it('moves end values into the legend when end labels are off (converging lines)', async () => {
    const html = await render(LineChart, { title: 'F', desc: 'd', series: [{ label: 'Fitness', points: weight }, { label: 'Fatigue', points: weight }], format: kg, endLabels: false });
    expect(html).not.toContain('class="chart-dot-label"');
    expect(html).toContain('>Fitness 97.8 kg<');
    expect(html).toContain('>Fatigue 97.8 kg<');
  });

  it('draws reference markers as labelled diamonds, distinct from series dots', async () => {
    const html = await render(LineChart, { title: 'W', desc: 'd', series: [{ label: 'A', points: weight }], format: kg, markers: [{ date: '2026-06-02', value: 99, label: 'DEXA scan' }] });
    expect(html).toContain('class="chart-marker"');
    expect(html).toContain('title="DEXA scan: 99 kg, 2 Jun 2026"');
  });
});

describe('BarChart', () => {
  const bars = Array.from({ length: 12 }, (_, i) => ({ label: `W${i + 1}`, value: 20 + i, showValue: i === 11 }));

  it('is a named SVG image with one column per bar, values only where asked', async () => {
    const html = await render(BarChart, { title: 'Weekly distance', desc: 'Up to 31 km', bars, format: (v: number) => `${v} km`, id: 'b' });
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby="b-title b-desc"/);
    expect(html.match(/class="bar"/g)).toHaveLength(12);
    expect(html.match(/class="bar-value"/g)).toHaveLength(1);
    expect(html).toContain('title="W12: 31 km"');
    expect(html).not.toContain('<script');
  });

  it('thins x labels to fit, and marks every other one to give way at 320px', async () => {
    const html = await render(BarChart, { title: 't', desc: 'd', bars, maxLabels: 4 });
    expect(html).toContain('<li>W1</li>');
    expect(html).toContain('<li class="minor">W4</li>');
    expect(html).toContain('<li>W7</li>');
    expect(html).not.toContain('W2<');
  });
});

describe('ProgressBar', () => {
  it('is an ARIA meter with the value in words, clamped to 0-100', async () => {
    const html = await render(ProgressBar, { label: 'Progress to 93 kg', fraction: 1.4, valueText: 'Target reached' });
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="Progress to 93 kg"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="Target reached"');
    expect(html).toContain('width: 100%');
  });
});

describe('RangeToggle', () => {
  const slots = { '3m': '<p>three</p>', '1y': '<p>one</p>', all: '<p>all</p>' };

  it('offers native radios, selects 1 year by default and has a panel per range', async () => {
    const html = await render(RangeToggle, { legend: 'Weight chart range', id: 'r' }, slots);
    expect(html).toContain('<legend class="visually-hidden">Weight chart range</legend>');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/value="1y" checked/);
    expect(html).toContain('<label for="r-3m">3 months</label>');
    for (const range of ['3m', '1y', 'all']) expect(html).toContain(`data-range="${range}"`);
    expect(html).toContain('<p>three</p>');
    expect(html).not.toContain('<script');
  });

  it('drops the control when only one range is offered', async () => {
    const html = await render(RangeToggle, { legend: 'l', ranges: ['all'] }, { all: '<p>all</p>' });
    expect(html).not.toContain('type="radio"');
    expect(html).toContain('<p>all</p>');
  });

  it('fails the build when a range has no content', async () => {
    await expect(render(RangeToggle, { legend: 'l' }, { '1y': '<p>one</p>' })).rejects.toThrow(/"3m" slot/);
  });
});

describe('ChartFigure', () => {
  it('captions the chart and puts the data in a keyboard-reachable table', async () => {
    const html = await render(
      ChartFigure,
      { title: 'Weight', summary: 'Down 3.4 kg', heading: 3, id: 'f', table: { columns: ['Date', 'Weight'], rows: [['12 Oct 2026', '97.8 kg']] } },
      { default: '<div class="chart"></div>', source: '<p>Source: Garmin</p>' },
    );
    expect(html).toMatch(/<figure[^>]*aria-labelledby="f-title"[^>]*>\s*<figcaption/);
    expect(html).toContain('<h3 class="chart-figure-title" id="f-title"');
    expect(html.indexOf('Source: Garmin')).toBeLessThan(html.indexOf('Down 3.4 kg'));
    expect(html).toContain('<summary>Show the data</summary>');
    expect(html).toMatch(/tabindex="0" role="region" aria-label="Weight: data"/);
    expect(html).toContain('<th scope="col">Date</th>');
    expect(html).toContain('<th scope="row">12 Oct 2026</th>');
    expect(html).toContain('<td>97.8 kg</td>');
  });
});

describe('Base and Meta', () => {
  const meta = { title: 'Goals · Running · Alexander Webber', description: 'Active and achieved goals.', image: '/og/running-goals.png', imageAlt: 'Goals card' };

  it('gives every page lang, metadata, a skip link and landmarks', async () => {
    const html = await render(Base, meta, { default: '<p>content</p>' }, '/running/goals/');
    expect(html).toContain('<html lang="en-GB">');
    expect(html).toContain('<title>Goals · Running · Alexander Webber</title>');
    expect(html).toContain('<meta name="description" content="Active and achieved goals.">');
    expect(html).toContain('<link rel="canonical" href="https://alexanderwebber.com/running/goals/">');
    expect(html).toContain('<meta property="og:image" content="https://alexanderwebber.com/og/running-goals.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta property="og:image:alt" content="Goals card">');
    expect(html).toMatch(/<a class="skip-link"[^>]*href="#main"/);
    expect(html).toMatch(/<header class="site-header"/);
    expect(html).toMatch(/<main id="main" tabindex="-1"/);
    expect(html).toMatch(/<footer class="site-footer"/);
    expect(html).not.toContain('<script');
  });

  it('refuses a page without a title or description', async () => {
    await expect(render(Base, { ...meta, description: ' ' })).rejects.toThrow(/title and a description/);
  });
});

describe('Nav', () => {
  const items = [
    { label: 'Overview', href: '/running/' },
    { label: 'Training', href: '/running/training/' },
  ];

  it('marks the current page, and the parent item of a page below it', async () => {
    const onPage = await render(Nav, { label: 'Running', items }, {}, '/running/training/');
    expect(onPage).toContain('<nav aria-label="Running">');
    expect(onPage).toMatch(/href="\/running\/training\/" aria-current="page"/);
    expect(onPage).not.toMatch(/href="\/running\/" aria-current/);
    const below = await render(Nav, { label: 'Running', items, current: '/running/training/' }, {}, '/running/runs/2026-10-17-k3f7/');
    expect(below).toMatch(/href="\/running\/training\/" aria-current="true"/);
  });

  it('renders nothing with no items (no area has shipped)', async () => {
    expect(await render(Nav, { label: 'Running', items: [] })).not.toContain('<nav');
  });
});

describe('LastUpdated', () => {
  const now = new Date('2026-10-17T21:00:00Z');

  it('says so before the first publish, with no stale claim', async () => {
    const html = await render(LastUpdated, { lastSuccessAt: undefined, staleAfterHours: 12, now });
    expect(html).toContain('Not updated yet');
    expect(html).toMatch(/data-stale-notice[^>]*hidden/);
  });

  it('shows the build-time value in UK time and hides the notice while fresh', async () => {
    const html = await render(LastUpdated, { lastSuccessAt: '2026-10-17T19:17:00Z', staleAfterHours: 12, now });
    expect(html).toContain('Last updated 17 Oct 2026, 20:17');
    expect(html).toMatch(/data-stale-notice[^>]*hidden/);
    expect(html).toContain(`data-success-ms="${Date.parse('2026-10-17T19:17:00Z')}"`);
    expect(html).toContain('data-stale-ms="43200000"');
  });

  it('shows the notice when the data was already stale at build time', async () => {
    const html = await render(LastUpdated, { lastSuccessAt: '2026-10-16T08:00:00Z', staleAfterHours: 12, now });
    expect(html).not.toMatch(/data-stale-notice[^>]*hidden/);
    expect(html).toContain('more than 12 hours ago');
  });

  it('never puts an ISO time of day on the page (run pages carry it; scan-privacy)', async () => {
    const html = await render(LastUpdated, { lastSuccessAt: '2026-10-17T19:17:00Z', staleAfterHours: 12, now });
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('polls the freshness endpoint with a small script', async () => {
    const html = await render(LastUpdated, { lastSuccessAt: undefined, staleAfterHours: 12, now });
    expect(html).toContain('<script');
  });
});

describe('GarminAttribution', () => {
  it.each([
    [{}, 'Source: Garmin'],
    [{ device: 'Venu X1' }, 'Source: Garmin Venu X1'],
    [{ device: ['Venu X1', 'Venu 2 Plus'] }, 'Source: Garmin Venu X1, Garmin Venu 2 Plus'],
    [{ device: [] }, 'Source: Garmin'],
    [{ derived: true }, 'Derived in part from Garmin device-sourced data'],
  ])('%o reads "%s"', async (props, text) => {
    const html = await render(GarminAttribution, props);
    expect(html).toContain(`>${text}</p>`);
    expect(html).toContain('data-garmin-attribution');
  });
});

describe('SectionLayout', () => {
  const refresh: RefreshRecord = {
    schema_version: 1,
    sources: { intervals: { last_data_change_at: '2026-10-17T19:17:00Z', last_success_at_build: '2026-10-17T19:17:00Z' } },
    generated_at: '2026-10-17T19:18:00Z',
  } as RefreshRecord;

  function fakeStore(section?: Partial<SectionSettings>): RunningStore {
    return {
      listRuns: async () => [],
      getRun: async () => undefined,
      getRaceTrack: async () => undefined,
      getHealthSeries: async () => [],
      getRefreshRecord: async () => refresh,
      getOwner: async () => ({
        section: section as SectionSettings | undefined,
        goals: [],
        upcomingRaces: [],
        races: [],
        overrides: [],
        exclusions: [],
        lab: [],
        manualMetrics: { training_status: [], race_predictions: [] },
      }),
    };
  }

  afterEach(() => setRunningStore(undefined));

  const props = { heading: 'Goals', description: 'Active and achieved goals.', image: '/og/running-goals.png', imageAlt: 'Goals card' };

  it('wraps the page in the Running theme with heading and freshness', async () => {
    setRunningStore(fakeStore());
    const html = await render(SectionLayout, props, { default: '<p>body</p>' }, '/running/goals/');
    expect(html).toContain('<body class="theme-running">');
    expect(html).toContain('<title>Goals · Running · Alexander Webber</title>');
    expect(html).toMatch(/<h1[^>]*>Goals<\/h1>/);
    expect(html).toContain('Last updated 17 Oct 2026, 20:17');
    expect(html).toContain('<p>body</p>');
    expect(html).not.toContain('data-garmin-attribution');
  });

  it('puts Garmin attribution right under the heading when asked', async () => {
    setRunningStore(fakeStore());
    const html = await render(SectionLayout, { ...props, garmin: true }, {}, '/running/goals/');
    expect(html).toMatch(/<\/h1>\s*<p class="garmin-attribution" data-garmin-attribution>Source: Garmin<\/p>/);
  });

  it('names the scale from section.yaml for weight and body fat, else plain Garmin', async () => {
    setRunningStore(fakeStore({ garmin_devices: { scale: 'Index S2' } }));
    expect(await render(GarminAttribution, { scale: true })).toContain('>Source: Garmin Index S2</p>');
    setRunningStore(fakeStore());
    expect(await render(GarminAttribution, { scale: true })).toContain('>Source: Garmin</p>');
  });

  it("uses the owner's stale threshold", async () => {
    setRunningStore(fakeStore({ stale_after_hours: 6 }));
    const html = await render(SectionLayout, props, {}, '/running/goals/');
    expect(html).toContain(`data-stale-ms="${6 * 3_600_000}"`);
  });
});
