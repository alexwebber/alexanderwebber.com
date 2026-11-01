// The fundraising card and page (T057, T074, T091, T099; US1.1, US1.6, US1.7, US2, US3, US4, FR-023, FR-030, FR-032,
// FR-033, FR-041 to FR-044, FR-061, FR-063, FR-065), rendered with Astro's container API over the data loader: each
// row of specs/002-fundraising/contracts/routes.md's card table, then the page's sections. The card's
// place on the landing page is in tests/unit/landing.test.ts; browser checks (layout, axe, keyboard,
// the freshness script) are in tests/e2e/fundraising.spec.ts and tests/a11y/fundraising.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import FundraisingCard from '../../src/sections/running/components/FundraisingCard.astro';
import FundraisingPage from '../../src/sections/running/components/FundraisingPage.astro';
import { loadFundraising } from '../../src/sections/running/data/fundraising.ts';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import type { Campaign, CampaignFigures, CampaignStory, OwnerData, Race, Run, RunningStore, UpcomingRace } from '../../src/sections/running/data/store/index.ts';
import { fundraisingCard } from '../../src/sections/running/og/fundraising.png.ts';
import { stripTags } from '../helpers/html.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com' } });
});

const NOW = new Date('2026-11-10T12:00:00Z');
const CAMPAIGN: Campaign = {
  id: 'seaside-2027',
  race_id: 'seaside-2027',
  charity: { name: 'Example hospice' },
  page_url: 'https://www.justgiving.com/page/example-seaside-2027',
};

function store(point: Partial<CampaignFigures['points'][number]>, { lastReadAt = '2026-11-10T09:17:03Z', campaigns = [CAMPAIGN], published = true } = {}): RunningStore {
  return {
    listRuns: async () => [],
    getRun: async () => undefined,
    getRaceTrack: async () => undefined,
    getHealthSeries: async () => [],
    getRefreshRecord: async () => undefined,
    getCampaignFigures: async () =>
      published ? [{ schema_version: 1, campaign_id: CAMPAIGN.id, last_read_at: lastReadAt, points: [{ date: '2026-11-09', raised_pence: 1, supporters: 1 }, { date: '2026-11-10', raised_pence: 0, supporters: 0, ...point }] }] : [],
    getOwner: async () => ({
      section: { focus_race: { race_id: 'seaside-2027', build_start: '2026-09-05', charity: { name: 'Example hospice' } } } as never,
      goals: [],
      upcomingRaces: [{ id: 'seaside-2027', name: 'Seaside Marathon', date: '2027-04-04', distance: 'marathon' }],
      races: [],
      overrides: [],
      exclusions: [],
      lab: [],
      manualMetrics: { training_status: [], race_predictions: [] },
      campaigns,
      stories: [],
    }),
  };
}

async function html(from: RunningStore): Promise<string> {
  const { current } = await loadFundraising('2026-11-10', from);
  const rendered = await container.renderToString(FundraisingCard, { props: { campaign: current, now: NOW } });
  return rendered.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
}

/** The visible text, whitespace collapsed. */
const text = (rendered: string) =>
  stripTags(rendered)
    .replace(/\s+/g, ' ')
    .trim();

const between = (rendered: string, attribute: string) => text(rendered.match(new RegExp(`<p[^>]*${attribute}[\\s\\S]*?</p>`))?.[0] ?? '');
const meter = (rendered: string) => rendered.match(/<div class="progress"[^>]*>/)?.[0];

describe('the card, by state (contracts/routes.md)', () => {
  it('US1.1: £1,250 of £2,000 from 37 supporters, for the charity, with a 62% bar', async () => {
    const card = await html(store({ raised_pence: 125000, target_pence: 200000, supporters: 37 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£1,250 raised of £2,000');
    expect(between(card, 'data-fundraising-secondary')).toBe('37 supporters · For Example hospice');
    expect(meter(card)).toContain('aria-valuenow="62"');
    expect(meter(card)).toContain('aria-valuetext="£1,250 of £2,000, 62%"');
    expect(meter(card)).toContain('aria-label="Fundraising target £2,000: progress"');
    expect(card).toContain('Figures updated 10 Nov 2026, 09:17');
  });

  it('the bar draws the same floored figure as the words, not the rounded one', async () => {
    const card = await html(store({ raised_pence: 125000, target_pence: 200000, supporters: 37 }));
    expect(card).toContain('width: 62%');
  });

  it('target reached: full, with the supporters and the charity still there', async () => {
    const card = await html(store({ raised_pence: 200000, target_pence: 200000, supporters: 37 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£2,000 raised of £2,000');
    expect(between(card, 'data-fundraising-secondary')).toBe('Target reached: 100% · 37 supporters · For Example hospice');
    expect(meter(card)).toContain('aria-valuenow="100"');
  });

  it('US1.7: target beaten: a full bar, not one past its end, and the real percentage', async () => {
    const card = await html(store({ raised_pence: 216000, target_pence: 200000, supporters: 37 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£2,160 raised of £2,000');
    expect(between(card, 'data-fundraising-secondary')).toBe('Target beaten: 108% · 37 supporters · For Example hospice');
    expect(meter(card)).toContain('aria-valuenow="100"');
    expect(meter(card)).toContain('aria-valuetext="£2,160 of £2,000, 108%"');
    expect(card).toContain('width: 100%');
  });

  it('never reads as complete just below the target', async () => {
    const card = await html(store({ raised_pence: 199999, target_pence: 200000, supporters: 37 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£1,999 raised of £2,000');
    expect(card).not.toContain('Target reached');
    expect(meter(card)).toContain('aria-valuenow="99"');
  });

  it('no target: the total and supporters, and no bar', async () => {
    const card = await html(store({ raised_pence: 125000, supporters: 37 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£1,250 raised');
    expect(between(card, 'data-fundraising-secondary')).toBe('37 supporters · For Example hospice');
    expect(card).not.toContain('role="meter"');
  });

  it('nothing raised yet: an empty bar and "No supporters yet"', async () => {
    const card = await html(store({ raised_pence: 0, target_pence: 50000, supporters: 0 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£0 raised of £500');
    expect(between(card, 'data-fundraising-secondary')).toBe('No supporters yet · For Example hospice');
    expect(meter(card)).toContain('aria-valuenow="0"');
  });

  it('one supporter is singular', async () => {
    const card = await html(store({ raised_pence: 1000, target_pence: 50000, supporters: 1 }));
    expect(between(card, 'data-fundraising-secondary')).toBe('1 supporter · For Example hospice');
  });

  it('amounts round down, so it never overstates (FR-063)', async () => {
    const card = await html(store({ raised_pence: 103075, target_pence: 100000, supporters: 9 }));
    expect(between(card, 'data-fundraising-lead')).toBe('£1,030 raised of £1,000');
    expect(between(card, 'data-fundraising-secondary')).toContain('Target beaten: 103%');
  });
});

describe('Donate (FR-065)', () => {
  it('is a plain link to the campaign\'s page, in the same tab, naming JustGiving', async () => {
    const links = (await html(store({ raised_pence: 0, target_pence: 50000, supporters: 0 }))).match(/<a [\s\S]*?<\/a>/g)!;
    expect(links).toHaveLength(2);
    expect(links[0]).toBe('<a class="fundraising-donate" href="https://www.justgiving.com/page/example-seaside-2027">Donate on JustGiving</a>');
  });

  it('sits beside a link to the fundraising page (FR-040)', async () => {
    const links = (await html(store({ raised_pence: 0, target_pence: 50000, supporters: 0 }))).match(/<a [\s\S]*?<\/a>/g)!;
    expect(links[1]).toBe('<a href="/running/fundraising/">See the fundraising page</a>');
  });
});

describe('figures updated and the stale notice (FR-004, FR-005)', () => {
  const figures = { raised_pence: 125000, target_pence: 200000, supporters: 37 };

  it('carries the campaign and the instant for the script, and hides the notice while fresh', async () => {
    const card = await html(store(figures));
    expect(card).toContain('data-campaign="seaside-2027"');
    expect(card).toContain(`data-read-ms="${Date.parse('2026-11-10T09:17:03Z')}"`);
    expect(card).toContain('data-stale-ms="43200000"');
    expect(card).toMatch(/data-fundraising-stale[^>]*hidden/);
  });

  it('shows the notice at build time once the figures are over 12 hours old, and still shows them', async () => {
    const card = await html(store(figures, { lastReadAt: '2026-11-08T09:17:03Z' }));
    expect(card).not.toMatch(/data-fundraising-stale[^>]*hidden/);
    expect(text(card)).toContain('These figures may be out of date');
    expect(between(card, 'data-fundraising-lead')).toBe('£1,250 raised of £2,000');
    expect(card).toContain('Donate on JustGiving');
  });

  it('keeps clear of Running\'s own attributes, which the stale drill counts', async () => {
    const card = await html(store(figures, { lastReadAt: '2026-11-08T09:17:03Z' }));
    expect(card).not.toContain('data-stale-notice');
    expect(card).not.toContain('data-last-updated');
  });

  it('has only the freshness script', async () => {
    const card = await html(store(figures));
    expect(card.match(/<script/g)).toHaveLength(1);
  });
});

describe('loadFundraising (FR-022)', () => {
  const figures = { raised_pence: 125000, target_pence: 200000, supporters: 37 };

  it('reads the current figures from the last point', async () => {
    const { current, past } = await loadFundraising('2026-11-10', store(figures));
    expect(current?.figures.raised_pence).toBe(125000);
    expect(current?.points).toHaveLength(2);
    expect(current?.race).toEqual({ name: 'Seaside Marathon', date: '2027-04-04' });
    expect(current?.progress?.percent).toBe(62);
    expect(current?.staleAfterHours).toBe(12);
    expect(past).toEqual([]);
  });

  it('leaves out a campaign with no published file', async () => {
    expect((await loadFundraising('2026-11-10', store(figures, { published: false }))).current).toBeUndefined();
  });

  it('leaves out figures with no campaign, or a campaign on another race', async () => {
    expect((await loadFundraising('2026-11-10', store(figures, { campaigns: [] }))).current).toBeUndefined();
    expect((await loadFundraising('2026-11-10', store(figures, { campaigns: [{ ...CAMPAIGN, race_id: 'other-2028' }] }))).current).toBeUndefined();
  });
});

// The page: a store with any campaigns, each given its race, points and read time.
const FOCUS: UpcomingRace = { id: 'seaside-2027', name: 'Seaside Marathon', date: '2027-04-04', distance: 'marathon' };
const point = (date: string, pounds: number, supporters: number, target?: number): CampaignFigures['points'][number] => ({
  date,
  raised_pence: pounds * 100,
  ...(target !== undefined ? { target_pence: target * 100 } : {}),
  supporters,
});
const figuresOf = (campaign_id: string, points: CampaignFigures['points'], last_read_at = '2026-11-10T09:17:03Z'): CampaignFigures => ({ schema_version: 1, campaign_id, last_read_at, points });
const campaignOn = (id: string, extra: Partial<Campaign> = {}): Campaign => ({ id, race_id: id, charity: { name: 'Example hospice' }, page_url: `https://www.justgiving.com/page/example-${id}`, ...extra });

interface PageFixture {
  campaigns?: Campaign[];
  figures?: CampaignFigures[];
  upcoming?: UpcomingRace[];
  races?: Race[];
  runs?: Run[];
  section?: OwnerData['section'];
  stories?: CampaignStory[];
}

function pageStore({ campaigns = [campaignOn('seaside-2027')], figures = [], upcoming = [FOCUS], races = [], runs = [], section, stories = [] }: PageFixture): RunningStore {
  return {
    listRuns: async () => runs,
    getRun: async () => undefined,
    getRaceTrack: async () => undefined,
    getHealthSeries: async () => [],
    getRefreshRecord: async () => undefined,
    getCampaignFigures: async () => figures,
    getOwner: async () => ({
      section: section ?? ({ focus_race: { race_id: 'seaside-2027', build_start: '2026-09-05', charity: { name: 'Example hospice' } } } as never),
      goals: [],
      upcomingRaces: upcoming,
      races,
      overrides: [],
      exclusions: [],
      lab: [],
      manualMetrics: { training_status: [], race_predictions: [] },
      campaigns,
      stories,
    }),
  };
}

afterEach(() => setRunningStore(undefined));

async function pageHtml(fixture: PageFixture): Promise<string> {
  const from = pageStore(fixture);
  setRunningStore(from);
  const data = await loadFundraising('2026-11-10', from);
  const rendered = await container.renderToString(FundraisingPage, {
    props: { data, image: '/og/running-fundraising.png', now: NOW },
    request: new Request('https://alexanderwebber.com/running/fundraising/'),
  });
  return rendered.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
}

const ACTIVE: PageFixture = {
  campaigns: [campaignOn('seaside-2027', { charity: { name: 'Example hospice', url: 'https://example.org/', registered: { name: 'Example hospice group', number: '000000' } } })],
  figures: [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-11-10', 1250, 37, 2000)])],
};

describe('past campaigns in the loader (FR-022, FR-043)', () => {
  const load = (fixture: PageFixture) => loadFundraising('2026-11-10', pageStore(fixture));
  const past2026: Race = { slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' } as Race;
  const past2025: Race = { slug: 'river-2025', name: 'River 10k', date: '2025-05-11', distance: '10k' } as Race;

  it('lists every other campaign with figures, most recent race first', async () => {
    const { current, past } = await load({
      campaigns: [campaignOn('river-2025'), campaignOn('seaside-2027'), campaignOn('harbour-2026')],
      figures: [figuresOf('river-2025', [point('2025-05-11', 10, 1)]), figuresOf('harbour-2026', [point('2026-09-20', 20, 1)]), figuresOf('seaside-2027', [point('2026-11-10', 30, 1)])],
      races: [past2026, past2025],
    });
    expect(current?.campaign.id).toBe('seaside-2027');
    expect(past.map((view) => view.campaign.id)).toEqual(['harbour-2026', 'river-2025']);
  });

  it('leaves out a past campaign with no published file (FR-022)', async () => {
    const { past } = await load({ campaigns: [campaignOn('seaside-2027'), campaignOn('harbour-2026')], figures: [figuresOf('seaside-2027', [point('2026-11-10', 30, 1)])], races: [past2026] });
    expect(past).toEqual([]);
  });

  it('takes a race from races/ by slug when upcoming-races.yaml has moved on', async () => {
    const { past } = await load({ campaigns: [campaignOn('harbour-2026')], figures: [figuresOf('harbour-2026', [point('2026-09-20', 20, 1)])], races: [past2026] });
    expect(past[0]?.race).toEqual({ name: 'Harbour 10k', date: '2026-09-20' });
  });

  it('names a race with no name of its own after its run, as raceHistory does', async () => {
    const { name: _, ...unnamed } = past2026;
    const races = [{ ...unnamed, run_id: '2026-09-20-k3f7' } as Race];
    const runs = [{ id: '2026-09-20-k3f7', title: 'Harbour run' } as Run];
    const { past } = await load({ campaigns: [campaignOn('harbour-2026')], figures: [figuresOf('harbour-2026', [point('2026-09-20', 20, 1)])], races, runs });
    expect(past[0]?.race.name).toBe('Harbour run');
  });

  it('carries finished on each view', async () => {
    const { current, past } = await load({
      campaigns: [campaignOn('seaside-2027'), campaignOn('harbour-2026', { finished: true })],
      figures: [figuresOf('seaside-2027', [point('2026-11-10', 30, 1)]), figuresOf('harbour-2026', [point('2026-09-20', 20, 1)])],
      races: [past2026],
    });
    expect(current?.finished).toBe(false);
    expect(past[0]?.finished).toBe(true);
  });

  it('with no campaign on the focus race, everything is past (US4.5)', async () => {
    const { current, past } = await load({ campaigns: [campaignOn('harbour-2026')], figures: [figuresOf('harbour-2026', [point('2026-09-20', 20, 1)])], races: [past2026] });
    expect(current).toBeUndefined();
    expect(past).toHaveLength(1);
  });
});

describe('the fundraising page (US2, FR-041 to FR-043)', () => {
  const inPage = (html: string, attribute: string) => text(html.match(new RegExp(`<[a-z0-9]+[^>]*${attribute}[\\s\\S]*?</(p|h2|section)>`))?.[0] ?? '');

  it('leads with the campaign, then the chart (US2.1)', async () => {
    const html = await pageHtml(ACTIVE);
    expect(inPage(html, 'id="fundraising-current-title"')).toBe('Seaside Marathon · 4 April 2027');
    expect(html.indexOf('data-fundraising-current')).toBeLessThan(html.indexOf('<figure'));
    expect(html).toContain('Donate on JustGiving');
    expect(html).toContain('Figures updated 10 Nov 2026, 09:17');
    expect(html).not.toContain('Past campaigns');
  });

  it('links the charity, and names it once, above the figures', async () => {
    const html = await pageHtml(ACTIVE);
    expect(html).toContain('For <a href="https://example.org/">Example hospice</a>');
    expect(inPage(html, 'data-fundraising-secondary')).toBe('37 supporters');
    expect(html).not.toContain('data-fundraising-charity');
  });

  it('names the charity in text when it has no site', async () => {
    const html = await pageHtml({ ...ACTIVE, campaigns: [campaignOn('seaside-2027')] });
    expect(inPage(html, 'data-fundraising-for')).toBe('For Example hospice');
  });

  it('keeps the target note beside the supporters', async () => {
    const html = await pageHtml({ figures: [figuresOf('seaside-2027', [point('2026-11-10', 2160, 37, 2000)])] });
    expect(inPage(html, 'data-fundraising-secondary')).toBe('Target beaten: 108% · 37 supporters');
  });

  it('gives the registered charity in either form, and only when there is one', async () => {
    const withName = (name: string) => ({ ...ACTIVE, campaigns: [campaignOn('seaside-2027', { charity: { name: 'Example hospice', registered: { name, number: '000000' } } })] });
    expect(inPage(await pageHtml(withName('Example hospice group')), 'data-fundraising-registered')).toBe('Part of Example hospice group, registered charity 000000');
    expect(inPage(await pageHtml(withName('Example hospice')), 'data-fundraising-registered')).toBe('Registered charity 000000');
    expect(await pageHtml({ ...ACTIVE, campaigns: [campaignOn('seaside-2027')] })).not.toContain('data-fundraising-registered');
  });

  it('leaves the registered charity off the landing card', async () => {
    const from = pageStore(ACTIVE);
    const { current } = await loadFundraising('2026-11-10', from);
    const card = await container.renderToString(FundraisingCard, { props: { campaign: current, now: NOW } });
    expect(card).not.toContain('registered charity');
    expect(card).not.toContain('000000');
  });

  it('US2.3: one point shows the figures and no chart', async () => {
    const html = await pageHtml({ figures: [figuresOf('seaside-2027', [point('2026-11-10', 1250, 37, 2000)])] });
    expect(text(html)).toContain('£1,250 raised of £2,000');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('The total so far');
  });

  it('two points show the chart, with its summary, target and closing point', async () => {
    const html = await pageHtml({ figures: [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-10-20', 1250, 37, 2000)])] });
    expect(html.match(/<figure/g)).toHaveLength(1);
    expect(html).toContain('<p class="chart-figure-summary">£1,250 raised since 12 Oct 2026, 62% of the £2,000 target</p>');
    expect(html).toContain('<span>Target £2,000</span>');
    expect(html).toMatch(/title="Total raised: £1,250, 10 Nov 2026"/);
  });

  it('has no target line without a target', async () => {
    const html = await pageHtml({ figures: [figuresOf('seaside-2027', [point('2026-10-12', 100, 2), point('2026-11-10', 1250, 37)])] });
    expect(html).toContain('<figure');
    expect(html).not.toContain('chart-target"');
  });

  it('the table lists the real points, newest first, with no supporters column (FR-042)', async () => {
    const html = await pageHtml(ACTIVE);
    const table = html.match(/<table[\s\S]*?<\/table>/)![0];
    expect([...table.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1])).toEqual(['Date', 'Total raised']);
    expect([...table.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><\/tr>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['10 Nov 2026', '£1,250'],
      ['12 Oct 2026', '£100'],
    ]);
    expect(table).not.toMatch(/supporter/i);
  });

  it('US2.5: past campaigns sit below, with race, charity, final total, target and a link', async () => {
    const html = await pageHtml({
      campaigns: [campaignOn('seaside-2027'), campaignOn('harbour-2026', { finished: true, charity: { name: 'Example shelter' } })],
      figures: [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-11-10', 1250, 37, 2000)]), figuresOf('harbour-2026', [point('2026-09-20', 2340, 40, 2000)], '2027-07-03T08:17:00Z')],
      races: [{ slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' } as Race],
    });
    expect(html.indexOf('<figure')).toBeLessThan(html.indexOf('data-past-campaigns'));
    const item = text(html.match(/<li class="past-campaign"[\s\S]*?<\/li>/)![0]);
    expect(item).toContain('Harbour 10k · 20 September 2026');
    expect(item).toContain('For Example shelter');
    expect(item).toContain('Final total: £2,340 raised of £2,000');
    expect(item).toContain('Last updated 3 Jul 2027');
    expect(html).toContain('<a href="https://www.justgiving.com/page/example-harbour-2026">JustGiving page');
  });

  it('a finished past campaign has no updated line and can never go stale', async () => {
    const html = await pageHtml({
      campaigns: [campaignOn('harbour-2026', { finished: true })],
      figures: [figuresOf('harbour-2026', [point('2026-09-20', 2340, 40)], '2020-01-01T08:17:00Z')],
      races: [{ slug: 'harbour-2026', date: '2026-09-20', distance: '10k' } as Race],
    });
    expect(html).not.toContain('data-fundraising-updated');
    expect(html).not.toContain('data-fundraising-stale');
  });

  it('an unfinished past campaign shows its updated line, and the notice past the threshold', async () => {
    const html = await pageHtml({
      campaigns: [campaignOn('harbour-2026')],
      figures: [figuresOf('harbour-2026', [point('2026-09-20', 310, 14)], '2026-11-08T09:17:03Z')],
      races: [{ slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' } as Race],
    });
    const item = html.match(/<li class="past-campaign"[\s\S]*?<\/li>/)![0];
    expect(text(item)).toContain('£310 raised');
    expect(text(item)).not.toContain('Final total');
    expect(text(item)).toContain('Figures updated 8 Nov 2026, 09:17');
    expect(item).not.toMatch(/data-fundraising-stale[^>]*hidden/);
  });

  it('with no current campaign, leads with the list (FR-043)', async () => {
    const html = await pageHtml({ campaigns: [campaignOn('harbour-2026')], figures: [figuresOf('harbour-2026', [point('2026-09-20', 310, 14)])], races: [{ slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' } as Race] });
    expect(html).not.toContain('data-fundraising-current');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('Donate');
    expect(html).toContain('data-past-campaigns');
  });

  it('has its own title, description and share image (FR-060)', async () => {
    const html = await pageHtml(ACTIVE);
    expect(html).toContain('<title>Fundraising · Running · Alexander Webber</title>');
    expect(html).toContain(`content="Alexander Webber's fundraising for Example hospice at the Seaside Marathon, 4 April 2027: the total so far, and how to give."`);
    expect(html).toContain('/og/running-fundraising.png');
  });

  it('carries no Garmin attribution', async () => {
    expect(await pageHtml(ACTIVE)).not.toContain('data-garmin-attribution');
  });
});

describe('the story (US3, FR-044)', () => {
  const ACTIVE: PageFixture = {
    figures: [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-11-10', 1250, 37, 2000)])],
    races: [],
  };
  const story = (text: string, campaign = 'seaside-2027'): CampaignStory => ({ campaign, text, approved: { date: '2026-11-01', text_sha256: '0'.repeat(64) } });
  const TEXT = 'A made-up first paragraph.\nStill the first.\n\nA made-up second paragraph.\n';

  it('US3.2: shows the heading and exactly the approved paragraphs', async () => {
    const html = await pageHtml({ ...ACTIVE, stories: [story(TEXT)] });
    const section = html.match(/<section[^>]*data-campaign-story[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(text(section.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe("Why I'm running for Example hospice");
    expect([...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1])).toEqual(['A made-up first paragraph.\nStill the first.', 'A made-up second paragraph.']);
  });

  it('sits after the current campaign and before the chart', async () => {
    const html = await pageHtml({ ...ACTIVE, stories: [story(TEXT)] });
    const place = html.indexOf('data-campaign-story');
    expect(place).toBeGreaterThan(html.indexOf('data-fundraising-current'));
    expect(place).toBeGreaterThan(html.indexOf('Figures updated'));
    expect(place).toBeLessThan(html.indexOf('<figure'));
  });

  it('escapes anything that looks like markup', async () => {
    const html = await pageHtml({ ...ACTIVE, stories: [story('A <b>made-up</b> line & a <script>alert(1)</script>.\n')] });
    const section = html.match(/<section[^>]*data-campaign-story[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(section).toContain('A &lt;b&gt;made-up&lt;/b&gt; line &amp; a &lt;script&gt;alert(1)&lt;/script&gt;.');
    expect(section).not.toMatch(/<(b|script)\b/);
  });

  it('US3.5: with no story there is no section and no placeholder', async () => {
    const html = await pageHtml(ACTIVE);
    expect(html).not.toContain('data-campaign-story');
    expect(html).not.toContain('Why I');
    expect(html).not.toContain('campaign-story-title');
  });

  it('shows only the current campaign\'s story', async () => {
    const data = { ...ACTIVE, stories: [story(TEXT, 'harbour-2026')] };
    const html = await pageHtml({
      ...data,
      campaigns: [campaignOn('seaside-2027'), campaignOn('harbour-2026')],
      figures: [...ACTIVE.figures!, figuresOf('harbour-2026', [point('2026-09-20', 310, 14)])],
      races: [{ slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' } as Race],
    });
    expect(html).not.toContain('data-campaign-story');
  });

  it('stays off the landing card', async () => {
    const { current } = await loadFundraising('2026-11-10', pageStore({ ...ACTIVE, stories: [story(TEXT)] }));
    expect(current?.story).toEqual(['A made-up first paragraph.\nStill the first.', 'A made-up second paragraph.']);
    const card = await container.renderToString(FundraisingCard, { props: { campaign: current, now: NOW } });
    expect(card).not.toContain('A made-up');
  });
});

describe('the share image (FR-060)', () => {
  const view = async (fixture: PageFixture) => loadFundraising('2026-11-10', pageStore(fixture));

  it('shows the charity, race and total', async () => {
    const card = fundraisingCard((await view(ACTIVE)).current);
    expect(card).toMatchObject({ eyebrow: 'Running', title: '£1,250 raised for Example hospice', subtitle: 'Seaside Marathon · 4 April 2027' });
  });

  it('rounds the total down, as the page does', async () => {
    const card = fundraisingCard((await view({ figures: [figuresOf('seaside-2027', [{ date: '2026-11-10', raised_pence: 103075, supporters: 9 }])] })).current);
    expect(card.title).toBe('£1,030 raised for Example hospice');
  });

  it('has plain words if there is no campaign to show', () => {
    expect(fundraisingCard(undefined)).toMatchObject({ title: 'Fundraising' });
  });
});

// After race day (T099; US4, FR-005, FR-023, FR-033, contracts/routes.md's last three card rows). The loader's
// "today" is 10 Nov 2026, so a race on 18 Oct has passed and one on 10 Nov is today. All made up.
describe('after race day (US4)', () => {
  const RIVERSIDE: UpcomingRace = { id: 'seaside-2027', name: 'Brighton Marathon', date: '2026-10-18', distance: 'marathon' };
  const RESULT: Race = { slug: 'seaside-2027', name: 'Brighton Marathon', date: '2026-10-18', distance: 'marathon', official_time: '3:18:42' } as Race;
  const raised = (last_read_at?: string) => [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-11-10', 2340, 52, 2000)], last_read_at)];
  const AFTER: PageFixture = { upcoming: [RIVERSIDE], figures: raised() };
  const WITH_RESULT: PageFixture = { upcoming: [{ ...RIVERSIDE, result_ref: 'seaside-2027' }], races: [RESULT], figures: raised() };
  const FINISHED: PageFixture = { ...WITH_RESULT, campaigns: [campaignOn('seaside-2027', { finished: true })], figures: raised('2027-07-03T08:17:00Z') };

  async function cardHtml(fixture: PageFixture): Promise<string> {
    const { current } = await loadFundraising('2026-11-10', pageStore(fixture));
    const rendered = await container.renderToString(FundraisingCard, { props: { campaign: current, now: NOW } });
    return rendered.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
  }

  it('the loader gives each view its phase and result', async () => {
    expect((await loadFundraising('2026-11-10', pageStore(ACTIVE))).current).toMatchObject({ phase: 'before_race' });
    expect((await loadFundraising('2026-11-10', pageStore(AFTER))).current).toMatchObject({ phase: 'after_race' });
    expect((await loadFundraising('2026-11-10', pageStore(AFTER))).current?.result).toBeUndefined();
    expect((await loadFundraising('2026-11-10', pageStore(WITH_RESULT))).current).toMatchObject({ phase: 'after_race', result: { time_s: 11922, official: true, slug: 'seaside-2027' } });
    expect((await loadFundraising('2026-11-10', pageStore(FINISHED))).current).toMatchObject({ phase: 'finished', result: { time_s: 11922 } });
  });

  it('takes the watch time when no official time is recorded, as the hero does (FR-033)', async () => {
    const races = [{ ...RESULT, official_time: undefined, run_id: '2026-10-18-k3f7' } as Race];
    const runs = [{ id: '2026-10-18-k3f7', title: 'Brighton Marathon', elapsed_s: 11950 } as Run];
    const { current } = await loadFundraising('2026-11-10', pageStore({ ...WITH_RESULT, races, runs }));
    expect(current?.result).toMatchObject({ time_s: 11950, official: false });
    expect(between(await cardHtml({ ...WITH_RESULT, races, runs }), 'data-fundraising-lead')).toBe('Raised £2,340 for Example hospice · Brighton Marathon: 3:19:10');
  });

  it('a past campaign takes the same fields: its race known only under races/ reads as completed', async () => {
    const { past } = await loadFundraising('2026-11-10', pageStore({ campaigns: [campaignOn('harbour-2026')], figures: [figuresOf('harbour-2026', [point('2026-09-20', 20, 1)])], races: [{ slug: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k', official_time: '44:10' } as Race] }));
    expect(past[0]).toMatchObject({ phase: 'after_race', result: { time_s: 2650, official: true } });
    expect(past[0]?.race).toEqual({ name: 'Harbour 10k', date: '2026-09-20' });
  });

  it('race day: the card keeps its pre-race form until a result is recorded (spec edge case)', async () => {
    const card = await cardHtml({ upcoming: [{ ...RIVERSIDE, date: '2026-11-10' }], figures: raised() });
    expect(between(card, 'data-fundraising-lead')).toBe('£2,340 raised of £2,000');
    expect(between(card, 'data-fundraising-secondary')).toBe('Target beaten: 117% · 52 supporters · For Example hospice');
    const recorded = await cardHtml({ upcoming: [{ ...RIVERSIDE, date: '2026-11-10', result_ref: 'seaside-2027' }], races: [{ ...RESULT, date: '2026-11-10' } as Race], figures: raised() });
    expect(between(recorded, 'data-fundraising-lead')).toBe('Raised £2,340 for Example hospice · Brighton Marathon: 3:18:42');
  });

  it('after the race, no result yet: "Raised £X", the bar and target as detail, supporters, Donate', async () => {
    const card = await cardHtml(AFTER);
    expect(between(card, 'data-fundraising-lead')).toBe('Raised £2,340 for Example hospice');
    expect(card).not.toContain('data-fundraising-result');
    expect(between(card, 'data-fundraising-secondary')).toBe('£2,000 target beaten: 117% · 52 supporters');
    expect(card).not.toContain('data-fundraising-charity');
    expect(meter(card)).toContain('aria-valuetext="£2,340 of £2,000, 117%"');
    expect(card).toContain('Donate on JustGiving');
    expect(card).toContain('Figures updated 10 Nov 2026, 09:17');
  });

  it('below the target after the race, the share of it', async () => {
    const card = await cardHtml({ ...AFTER, figures: [figuresOf('seaside-2027', [point('2026-11-10', 1250, 37, 2000)])] });
    expect(between(card, 'data-fundraising-secondary')).toBe('62% of the £2,000 target · 37 supporters');
    expect(meter(card)).toContain('aria-valuenow="62"');
  });

  it('with no target after the race, no bar and just the supporters', async () => {
    const card = await cardHtml({ ...AFTER, figures: [figuresOf('seaside-2027', [point('2026-11-10', 1250, 37)])] });
    expect(between(card, 'data-fundraising-secondary')).toBe('37 supporters');
    expect(card).not.toContain('role="meter"');
  });

  it('US4.1: with a result, "Raised £2,340 for Martlets" with "Brighton Marathon: 3:18:42" beside it, and Donate', async () => {
    const card = await cardHtml({ ...WITH_RESULT, campaigns: [campaignOn('seaside-2027', { charity: { name: 'Martlets' } })], section: { focus_race: { race_id: 'seaside-2027', build_start: '2026-09-05', charity: { name: 'Martlets' } } } as never });
    expect(between(card, 'data-fundraising-lead')).toBe('Raised £2,340 for Martlets · Brighton Marathon: 3:18:42');
    expect(card).toContain('<span class="fundraising-result" data-fundraising-result>Brighton Marathon: 3:18:42</span>');
    expect(card).toContain('<a class="fundraising-donate" href="https://www.justgiving.com/page/example-seaside-2027">Donate on JustGiving</a>');
  });

  it('US4.2: donations after the race keep updating the total, and the card keeps its updated line and notice', async () => {
    const stale = await cardHtml({ ...WITH_RESULT, figures: raised('2026-11-08T09:17:03Z') });
    expect(between(stale, 'data-fundraising-lead')).toContain('Raised £2,340');
    expect(stale).not.toMatch(/data-fundraising-stale[^>]*hidden/);
  });

  it('US4.3: finished: "Final total" dated by the last read, the bar as detail, no Donate, no updated line, no notice', async () => {
    const card = await cardHtml(FINISHED);
    expect(between(card, 'data-fundraising-lead')).toBe('Raised £2,340 for Example hospice · Brighton Marathon: 3:18:42');
    expect(between(card, 'data-fundraising-secondary')).toBe('£2,000 target beaten: 117% · 52 supporters');
    expect(between(card, 'data-fundraising-final')).toBe('Final total, last updated 3 Jul 2027');
    expect(meter(card)).toContain('aria-valuenow="100"');
    expect(card).not.toContain('Donate');
    expect(card).not.toContain('fundraising-donate');
    expect(card).not.toContain('data-fundraising-updated');
    expect(card).not.toContain('data-fundraising-stale');
    expect(card).not.toContain('<script');
    expect(card).toContain('<a href="/running/fundraising/">See the fundraising page</a>');
  });

  it('a finished campaign is never stale, however old its last read (FR-005, FR-023)', async () => {
    const card = await cardHtml({ ...FINISHED, figures: raised('2020-01-01T08:17:00Z') });
    expect(card).not.toContain('These figures may be out of date');
    expect(between(card, 'data-fundraising-final')).toBe('Final total, last updated 1 Jan 2020');
  });

  it('finished before its race still reads as final, whatever the race state', async () => {
    const card = await cardHtml({ ...ACTIVE, campaigns: [campaignOn('seaside-2027', { finished: true })] });
    expect(between(card, 'data-fundraising-lead')).toBe('Raised £1,250 for Example hospice');
    expect(card).not.toContain('Donate');
  });

  it('the page follows the card after the race, and still names and links the charity above (FR-041)', async () => {
    const html = await pageHtml({ ...WITH_RESULT, campaigns: [campaignOn('seaside-2027', { charity: { name: 'Example hospice', url: 'https://example.org/' } })] });
    const current = html.match(/<section[^>]*data-fundraising-current[\s\S]*?<\/section>/)![0];
    expect(text(current.match(/<p[^>]*data-fundraising-lead[\s\S]*?<\/p>/)![0])).toBe('Raised £2,340 for Example hospice · Brighton Marathon: 3:18:42');
    expect(current).toContain('For <a href="https://example.org/">Example hospice</a>');
    expect(current).toContain('Donate on JustGiving');
    expect(current).toContain('Figures updated 10 Nov 2026, 09:17');
    expect(html).toContain('<figure');
  });

  it('the page, finished: "Final total", no Donate, no updated line, no notice, the chart kept (FR-023, FR-041)', async () => {
    const html = await pageHtml({ ...FINISHED, figures: raised('2020-01-01T08:17:00Z') });
    const current = html.match(/<section[^>]*data-fundraising-current[\s\S]*?<\/section>/)![0];
    expect(text(current)).toContain('Final total, last updated 1 Jan 2020');
    expect(html).not.toContain('Donate');
    expect(html).not.toContain('data-fundraising-updated');
    expect(html).not.toContain('data-fundraising-stale');
    expect(html).not.toContain('FundraisingUpdated.astro?astro&type=script'); // Running's own LastUpdated script stays
    expect(html.match(/<figure/g)).toHaveLength(1);
  });

  it('the page, finished: the chart ends at the last read, not today; an active campaign\'s runs on to today', async () => {
    const ended = [figuresOf('seaside-2027', [point('2026-10-12', 100, 2, 2000), point('2026-11-01', 2340, 52, 2000)], '2026-11-02T08:17:00Z')];
    const finished = await pageHtml({ ...FINISHED, figures: ended });
    expect(finished).toMatch(/title="Total raised: £2,340, 2 Nov 2026"/);
    expect(finished).not.toContain('10 Nov 2026"');
    expect(await pageHtml({ ...WITH_RESULT, figures: ended })).toMatch(/title="Total raised: £2,340, 10 Nov 2026"/);
  });

  it('a campaign that moves to past keeps its history, and its final total is dated by the last read (US4.4)', async () => {
    const { past } = await loadFundraising(
      '2026-11-10',
      pageStore({ ...FINISHED, section: { focus_race: { race_id: 'hove-2027', build_start: '2026-09-05', charity: { name: 'Example shelter' } } } as never, upcoming: [FINISHED.upcoming![0]!, { id: 'hove-2027', name: 'Hove 10k', date: '2027-06-06', distance: '10k' }] }),
    );
    expect(past).toHaveLength(1);
    expect(past[0]).toMatchObject({ phase: 'finished', finished: true, lastReadAt: '2027-07-03T08:17:00Z' });
    expect(past[0]?.points).toHaveLength(2);
  });
});
