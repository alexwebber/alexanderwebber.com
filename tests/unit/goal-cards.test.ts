// Goal cards and the as-of figure (T090, T153), rendered with Astro's container API: what a
// visitor reads on each card (US2.1, US2.2, US2.5, edge cases) and where Garmin attribution sits
// (FR-077). Browser checks (layout, axe, keyboard) are in tests/e2e and tests/a11y.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import AchievedGoalCard from '../../src/sections/running/components/AchievedGoalCard.astro';
import AsOf from '../../src/sections/running/components/AsOf.astro';
import GoalCard from '../../src/sections/running/components/GoalCard.astro';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import type { Effort } from '../../src/sections/running/domain/efforts.ts';
import type { GoalEvaluation } from '../../src/sections/running/domain/goals.ts';
import type { Goal, RunningStore, SectionSettings } from '../../src/shared/storage/index.ts';

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
    expect(t).toContain('Target Under 20:00 for 5k');
    expect(t).toContain('Fastest 5k 20:25 on 5 Mar 2027, 0:25 to go');
    expect(t).toContain('Garmin predicted 20:47 (as of 1 Mar 2027)');
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

  it('shows a body-fat goal with the latest reading as headline, judged on the 7-day average, naming the scale', async () => {
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
      latest: { date: '2027-03-16', value: 21.9 },
      fraction: 4 / 8.5,
    };
    const t = await text(GoalCard, { evaluation });
    expect(t).toContain('Source: Garmin Index S2');
    expect(t).toContain('Target 17.5% or less');
    expect(t).toContain('Body fat 21.9% on 16 Mar 2027');
    expect(t).toContain('Start 26.0%');
    expect(t).toContain('7-day average 22.0%: 47% of the way from 26.0% to 17.5%');
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
    expect(await html(AchievedGoalCard, { evaluation })).toContain('data-achieved-on="2027-03-12"');
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
