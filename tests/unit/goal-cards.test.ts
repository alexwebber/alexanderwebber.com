// Goal cards and the as-of figure (T090, T153), rendered with Astro's container API: what a
// visitor reads on each card (US2.1, US2.2, US2.5, edge cases) and where Garmin attribution sits
// (FR-077). Browser checks (layout, axe, keyboard) are in tests/e2e and tests/a11y.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import AchievedGoalCard from '../../src/sections/running/components/AchievedGoalCard.astro';
import AsOf from '../../src/sections/running/components/AsOf.astro';
import GoalCard from '../../src/sections/running/components/GoalCard.astro';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import type { Goal, RunningStore, SectionSettings } from '../../src/sections/running/data/store/index.ts';
import type { Effort } from '../../src/sections/running/domain/efforts.ts';
import type { GoalEvaluation } from '../../src/sections/running/domain/goals.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com' } });
});

function fakeStore(section?: Partial<SectionSettings>): RunningStore {
  return {
    listRuns: async () => [],
    getRun: async () => undefined,
    getRaceTrack: async () => undefined,
    getHealthSeries: async () => [],
    getRefreshRecord: async () => undefined,
    getCampaignFigures: async () => [],
    getOwner: async () => ({
      section: section as SectionSettings | undefined,
      goals: [],
      upcomingRaces: [],
      races: [],
      overrides: [],
      exclusions: [],
      lab: [],
      manualMetrics: { training_status: [], race_predictions: [] },
      campaigns: [],
    }),
  };
}

beforeEach(() => setRunningStore(fakeStore()));
afterEach(() => setRunningStore(undefined));

/** The visible text, whitespace collapsed. */
async function text(component: Parameters<AstroContainer['renderToString']>[0], props: Record<string, unknown>): Promise<string> {
  const html = await container.renderToString(component, { props });
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.)])/g, '$1')
    .replace(/\( /g, '(')
    .trim();
}

async function html(component: Parameters<AstroContainer['renderToString']>[0], props: Record<string, unknown>): Promise<string> {
  return (await container.renderToString(component, { props })).replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
}

const goal = (extra: Partial<Goal>): Goal => ({ id: 'g', type: 'race_time', title: '5k under 20 minutes', priority: 1, featured: true, target: { distance: '5k', time: '20:00' }, ...extra }) as Goal;
const effort = (extra: Partial<Effort> = {}): Effort => ({ distance_m: 5000, time_s: 1225.4, date: '2027-03-05', source: 'run', run_id: '2027-03-05-abcd', device: 'Venu X1', ...extra });

describe('AsOf', () => {
  it('shows a figure with its UK "as of" date', async () => {
    expect(await text(AsOf, { label: 'Garmin predicted', value: '20:47', asOf: '2027-03-01' })).toBe('Garmin predicted 20:47 (as of 1 Mar 2027)');
    // Garmin's predictions are for current fitness, so the words after the value replace "as of".
    expect(await text(AsOf, { label: 'Garmin predicts', value: '3:25:18', after: 'at current fitness', asOf: '2026-10-23' })).toBe(
      'Garmin predicts 3:25:18 at current fitness (23 Oct 2026)',
    );
    expect(await html(AsOf, { value: 'Productive', asOf: '2026-10-23' })).toContain('<time datetime="2026-10-23">23 Oct 2026</time>');
  });

  it('says "not recorded yet" with no entry', async () => {
    expect(await text(AsOf, { label: 'Training status' })).toBe('Training status: not recorded yet');
  });
});

describe('GoalCard', () => {
  it('US2.2: target, fastest effort with its gap, and the Garmin prediction as of its date', async () => {
    const evaluation: GoalEvaluation = {
      kind: 'race_time',
      goal: goal({}),
      status: 'active',
      newlyAchieved: false,
      distance_m: 5000,
      target_s: 1200,
      fastest: effort(),
      gap_s: 25,
      fraction: 1200 / 1225.4,
      prediction: { distance: '5k', time: '20:47', seconds: 1247, as_of: '2027-03-01' },
    };
    const t = await text(GoalCard, { evaluation });
    expect(t).toContain('Target Sub-20:00 5k');
    expect(t).toContain('Fastest 5k 20:25 on 5 Mar 2027, 0:25 to go');
    expect(t).toContain('Garmin race predictor 20:47 at current fitness (1 Mar 2027)');
    expect(t).toContain('Source: Garmin Venu X1');
    const h = await html(GoalCard, { evaluation });
    expect(h).toMatch(/<h3 class="goal-card-title" id="goal-g">5k under 20 minutes<\/h3>\s*<p class="garmin-attribution"/);
    expect(h).toContain('role="meter"');
    expect(h).toContain('aria-valuenow="98"');
    // Run pages ship with the landing page (T102), so the effort links to its run.
    expect(h).toContain('<a href="/running/runs/2027-03-05-abcd/">20:25</a>');
  });

  it('says "No data yet" instead of a 0% bar, and flags a passed deadline', async () => {
    const evaluation: GoalEvaluation = {
      kind: 'race_time',
      goal: goal({ title: '10k under 40 minutes', target: { distance: '10k', time: '40:00' }, deadline: '2027-03-01' }),
      status: 'deadline_passed',
      newlyAchieved: false,
      daysToDeadline: -19,
      distance_m: 10000,
      target_s: 2400,
    };
    const t = await text(GoalCard, { evaluation });
    expect(t).toContain('Deadline passed');
    expect(t).toContain('Fastest 10k No data yet');
    expect(t).toContain('Deadline 1 Mar 2027 · Deadline passed');
    const h = await html(GoalCard, { evaluation });
    expect(h).not.toContain('role="meter"');
    expect(h).not.toContain('data-garmin-attribution'); // nothing from Garmin on this card
    expect(h).not.toContain('Garmin predicted');
  });

  it('shows a body-fat goal by its 7-day average throughout, naming the scale', async () => {
    setRunningStore(fakeStore({ garmin_devices: { scale: 'Index S2' } }));
    const evaluation: GoalEvaluation = {
      kind: 'value',
      goal: { id: 'bf', type: 'body_composition', title: 'Body fat 17.5%', priority: 5, featured: true, start_value: 26, target: { metric: 'body_fat_pct', value: 17.5, direction: 'at_most' } },
      status: 'active',
      newlyAchieved: false,
      metric: 'body_fat_pct',
      direction: 'at_most',
      target: 17.5,
      averaged: true,
      start: 26,
      current: { date: '2027-03-16', value: 22 },
      latest: { date: '2027-03-16', value: 22 },
      fraction: 4 / 8.5,
    };
    const t = await text(GoalCard, { evaluation });
    expect(t).toContain('Source: Garmin Index S2');
    expect(t).toContain('Target 17.5% or less');
    expect(t).toContain('Body fat (7-day average) 22.0% on 16 Mar 2027');
    const compact = await text(GoalCard, { evaluation, compact: true });
    expect(compact).toContain('4.5% to go');
    expect(compact).toContain('Now 22.0% (7-day average)');
    expect(t).toContain('Start 26.0%');
    expect(t).not.toContain('All time');
    expect(t).toContain('7-day average 22.0%: 47% of the way from 26.0% to 17.5%');
  });

  it('dates the start and shows the all-time change, on both cards', async () => {
    setRunningStore(fakeStore({ garmin_devices: { scale: 'Index S2' } }));
    const evaluation: GoalEvaluation = {
      kind: 'value',
      goal: { id: 'w', type: 'body_composition', title: 'Weight 93 kg', priority: 5, featured: true, start_value: 127.6, start_date: '2025-06-02', all_time_start: { value: 133.2, date: '2023-01-31' }, target: { metric: 'weight_kg', value: 93, direction: 'at_most' } },
      status: 'active',
      newlyAchieved: false,
      metric: 'weight_kg',
      direction: 'at_most',
      target: 93,
      averaged: true,
      start: 127.6,
      startDate: '2025-06-02',
      allTimeStart: { value: 133.2, date: '2023-01-31' },
      current: { date: '2026-10-23', value: 101.1 },
      latest: { date: '2026-10-23', value: 101.1 },
      fraction: 26.5 / 34.6,
    };
    const t = await text(GoalCard, { evaluation });
    expect(t).toContain('Start 127.6 kg on 2 Jun 2025');
    expect(t).toContain('All time 32.1 kg down since 31 Jan 2023 (133.2 kg)');
    const compact = await text(GoalCard, { evaluation, compact: true });
    expect(compact).toContain('Now 101.1 kg (7-day average) · Target 93 kg');
    expect(compact).toContain('32.1 kg down since 31 Jan 2023 (133.2 kg)');
  });

  it('shows a linked race and the days to it', async () => {
    const evaluation: GoalEvaluation = {
      kind: 'race_time',
      goal: goal({ title: 'Brighton Marathon under 3:25', target: { distance: 'marathon', time: '3:25:00' }, deadline: '2027-04-04', linked_race: 'brighton-2027' }),
      status: 'active',
      newlyAchieved: false,
      daysToDeadline: 163,
      linkedRace: { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon' },
      distance_m: 42195,
      target_s: 12300,
    };
    expect(await text(GoalCard, { evaluation })).toContain('Race day Brighton Marathon, 4 Apr 2027 · 163 days left');
  });
});

describe('AchievedGoalCard', () => {
  it('US2.1: celebrates the date and the achieving effort', async () => {
    const achieving = effort({ distance_m: 10000, time_s: 2681, date: '2027-03-12', run_id: '2027-03-12-k3f7' });
    const evaluation: GoalEvaluation = {
      kind: 'race_time',
      goal: goal({ id: '10k-sub-45', title: '10k under 45:00', target: { distance: '10k', time: '45:00' } }),
      status: 'achieved',
      achievement: { date: '2027-03-12', by: 'effort', effort: achieving },
      newlyAchieved: true,
      distance_m: 10000,
      target_s: 2700,
      fastest: achieving,
      gap_s: -19,
      fraction: 1,
    };
    const t = await text(AchievedGoalCard, { evaluation });
    expect(t).toContain('Achieved 12 Mar 2027 New');
    expect(t).toContain('Achieved with 44:41 for 10k on 12 Mar 2027');
    expect(t).toContain('Source: Garmin Venu X1');
    const h = await html(AchievedGoalCard, { evaluation });
    expect(h).toContain('data-achieved-on="2027-03-12"');
    // While new, the achieving time is the card's big figure.
    expect(h).toMatch(/<p class="goal-celebrate" data-celebrate[^>]*>\s*44:41\s*<\/p>/);
    expect(await html(AchievedGoalCard, { evaluation: { ...evaluation, newlyAchieved: false } })).not.toContain('data-celebrate');
  });

  it("shows the owner's note for a goal marked achieved by hand, without Garmin attribution", async () => {
    const evaluation: GoalEvaluation = {
      kind: 'milestone',
      goal: { id: 'ultra', type: 'milestone', title: 'Finish a trail ultra', priority: 8, featured: false, achieved_override: { date: '2027-05-01', note: 'South Downs 50k' } },
      status: 'achieved',
      achievement: { date: '2027-05-01', by: 'override', note: 'South Downs 50k' },
      newlyAchieved: false,
    };
    const t = await text(AchievedGoalCard, { evaluation });
    expect(t).toContain('Achieved 1 May 2027');
    expect(t).not.toContain('New');
    expect(t).toContain('Note South Downs 50k');
    expect(t).not.toContain('Garmin');
  });
});
