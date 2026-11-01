// The fundraising card (T057; US1.1, US1.6, US1.7, FR-030, FR-032, FR-061, FR-063, FR-065),
// rendered with Astro's container API over the data loader: each before-race row of
// specs/002-fundraising/contracts/routes.md. Its place on the landing page is in
// tests/unit/landing.test.ts; browser checks (layout, axe, keyboard, the freshness script) are in
// tests/e2e/fundraising.spec.ts and tests/a11y/fundraising.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import FundraisingCard from '../../src/sections/running/components/FundraisingCard.astro';
import { loadFundraising } from '../../src/sections/running/data/fundraising.ts';
import type { Campaign, CampaignFigures, RunningStore } from '../../src/sections/running/data/store/index.ts';
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
    const link = (await html(store({ raised_pence: 0, target_pence: 50000, supporters: 0 }))).match(/<a [\s\S]*?<\/a>/g)!;
    expect(link).toHaveLength(1);
    expect(link[0]).toBe('<a class="fundraising-donate" href="https://www.justgiving.com/page/example-seaside-2027">Donate on JustGiving</a>');
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
