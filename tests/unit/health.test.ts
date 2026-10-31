// Health and performance metrics (T143, T156; US5.1–US5.7, FR-060–FR-069): the pure domain
// functions, then the health page rendered with Astro's container API over a fake store with only
// `Date` faked. Every value here is synthetic. Browser checks are in tests/e2e/health.spec.ts.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import { allTimeText, startChangeText } from '../../src/sections/running/domain/goal-text.ts';
import type { ValueEvaluation } from '../../src/sections/running/domain/goals.ts';
import {
  FITNESS_MODEL_LABEL,
  chartRanges,
  compareLab,
  dailyMetric,
  describeTrend,
  fitnessNote,
  fitnessSeries,
  fitnessStart,
  goalFor,
  hrvNote,
  hrvStart,
  inRange,
  labPoints,
  predictionRows,
  startingFrom,
  targetLine,
} from '../../src/sections/running/domain/health.ts';
import type { Goal, HealthMetric, LabMeasurement, OwnerData, Run, RunningStore } from '../../src/sections/running/data/store/index.ts';
import { predictionHistory, trainingStatusHistory, type ManualMetrics } from '../../src/sections/running/domain/manual-metrics.ts';
import Health from '../../src/sections/running/pages/health.astro';
import { addDays } from '../../src/shared/format/dates.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

const lab = (date: string, type: LabMeasurement['type'], values: LabMeasurement['values']): LabMeasurement => ({ date, type, provider: 'Example Clinic', values });

describe('ranges (FR-068)', () => {
  it('offers 3 months, 1 year and all time once the data reaches back past a year', () => {
    expect(chartRanges('2025-01-01', '2026-10-24')).toEqual([
      { key: '3m', from: '2026-07-25', to: '2026-10-24' },
      { key: '1y', from: '2025-10-24', to: '2026-10-24' },
      { key: 'all', from: '2025-01-01', to: '2026-10-24' },
    ]);
  });

  it('never starts before the data, and leaves out a range that would repeat a shorter one', () => {
    // HRV from 1 Dec 2025: "all time" would be the same as "1 year".
    expect(chartRanges('2025-12-01', '2026-10-24')).toEqual([
      { key: '3m', from: '2026-07-25', to: '2026-10-24' },
      { key: '1y', from: '2025-12-01', to: '2026-10-24' },
    ]);
    expect(chartRanges('2026-09-01', '2026-10-24')).toEqual([{ key: '3m', from: '2026-09-01', to: '2026-10-24' }]);
    expect(chartRanges(undefined, '2026-10-24')).toEqual([]);
  });

  it('offers a longer range only once it adds at least a month', () => {
    // Today's weight: data from 21 Oct 2025, so "all time" would add 3 days over "1 year".
    expect(chartRanges('2025-10-21', '2026-10-24').map((r) => r.key)).toEqual(['3m', '1y']);
    // 30 days past the year (24 Sep 2025) is enough; 29 is not.
    expect(chartRanges('2025-09-24', '2026-10-24').map((r) => r.key)).toEqual(['3m', '1y', 'all']);
    expect(chartRanges('2025-09-25', '2026-10-24').map((r) => r.key)).toEqual(['3m', '1y']);
    // The same margin applies to "1 year" over "3 months" (3 months back is 25 Jul 2026).
    expect(chartRanges('2026-06-25', '2026-10-24').map((r) => r.key)).toEqual(['3m', '1y']);
    expect(chartRanges('2026-06-26', '2026-10-24').map((r) => r.key)).toEqual(['3m']);
  });

  it('slices points to a range and to a chart start', () => {
    const points = ['2026-01-01', '2026-02-01', '2026-03-01'].map((date, i) => ({ date, value: i }));
    expect(inRange(points, '2026-01-15', '2026-02-28').map((p) => p.date)).toEqual(['2026-02-01']);
    expect(startingFrom(points, '2026-02-01')).toHaveLength(2);
    expect(startingFrom(points, undefined)).toHaveLength(3);
  });

  it('describes a range in words for the text alternative', () => {
    const kg = (v: number) => `${v} kg`;
    expect(describeTrend([{ date: '2025-10-24', value: 112.3 }, { date: '2026-10-24', value: 101.1 }], kg)).toBe('From 112.3 kg on 24 Oct 2025 to 101.1 kg on 24 Oct 2026.');
    expect(describeTrend([], kg)).toBe('No readings in this range.');
  });
});

describe('daily metrics: readings and their 7-day average', () => {
  it('averages the trailing 7 days (US5.2 figures give 100.7)', () => {
    const readings = [101.2, 100.6, 101.0, 100.4, 100.8, 100.2, 100.5].map((value, i) => ({ date: addDays('2026-10-18', i), value }));
    const { average } = dailyMetric(readings);
    expect(average.at(-1)).toEqual({ date: '2026-10-24', value: 100.7 });
  });
});

describe('lab comparison (FR-065)', () => {
  const vo2 = [
    { date: '2026-03-10', value: 53 },
    { date: '2026-03-14', value: 54 },
    { date: '2026-03-30', value: 55 },
  ];

  it('US5.4: a lab VO2 max of 51.0 against Garmin 54 differs by -3.0', () => {
    const [point] = labPoints([lab('2026-03-15', 'lab_vo2max', { vo2max: 51.0 })], 'vo2max');
    expect(point).toMatchObject({ label: 'Lab test', value: 51 });
    expect(compareLab(point!, vo2)).toEqual({ lab: point, device: { date: '2026-03-14', value: 54 }, diff: -3 });
  });

  it('compares only within 7 days either side, and prefers the earlier reading on a tie', () => {
    const [point] = labPoints([lab('2026-03-22', 'lab_vo2max', { vo2max: 50 })], 'vo2max');
    expect(compareLab(point!, vo2)).toEqual({ lab: point }); // 8 days from either
    const [tie] = labPoints([lab('2026-03-12', 'lab_vo2max', { vo2max: 52.5 })], 'vo2max');
    expect(compareLab(tie!, vo2).device).toEqual({ date: '2026-03-10', value: 53 });
    expect(compareLab(tie!, vo2).diff).toBe(-0.5);
  });

  it('US5.5: two DEXA scans a year apart are two labelled body-fat points', () => {
    const entries = [lab('2026-06-09', 'dexa', { body_fat_pct: 26.1, weight_kg: 101.5 }), lab('2025-06-10', 'dexa', { body_fat_pct: 31.2 })];
    expect(labPoints(entries, 'body_fat_pct')).toEqual([
      { date: '2025-06-10', type: 'dexa', label: 'DEXA scan', provider: 'Example Clinic', value: 31.2 },
      { date: '2026-06-09', type: 'dexa', label: 'DEXA scan', provider: 'Example Clinic', value: 26.1 },
    ]);
    expect(labPoints(entries, 'weight_kg')).toHaveLength(1);
    expect(labPoints(entries, 'vo2max')).toEqual([]);
  });
});

describe('HRV start (US5.7)', () => {
  const hrv = [
    { date: '2025-12-02', value: 54 },
    { date: '2025-12-01', value: 45 },
  ];
  const runs = [
    { date: '2025-11-28', device: 'Venu 2 Plus' },
    { date: '2025-10-07', device: 'Venu 2 Plus' },
    { date: '2025-12-01', device: 'Venu X1' },
    { date: '2025-12-03', device: 'Venu X1' },
  ];

  it('names the watch change when the runs show one at the first reading', () => {
    const start = hrvStart(hrv, runs)!;
    expect(start).toEqual({ date: '2025-12-01', before: 'Venu 2 Plus', after: 'Venu X1' });
    expect(hrvNote(start)).toBe('HRV readings start on 1 Dec 2025, when the Venu X1 replaced the Venu 2 Plus.');
  });

  it('falls back to the date alone when the watch did not change around it', () => {
    const same = runs.map((r) => ({ ...r, device: 'Venu X1' }));
    expect(hrvNote(hrvStart(hrv, same)!)).toBe('HRV readings start on 1 Dec 2025.');
    const late = [{ date: '2025-11-20', device: 'Venu 2 Plus' }, { date: '2026-01-10', device: 'Venu X1' }];
    expect(hrvNote(hrvStart(hrv, late)!)).toBe('HRV readings start on 1 Dec 2025.');
    expect(hrvStart([], runs)).toBeUndefined();
  });
});

describe('fitness, fatigue and form (T156)', () => {
  const ctl = [
    { date: '2025-10-07', value: 0 },
    { date: '2025-10-08', value: 10.5 },
    { date: '2025-10-09', value: 30.25 },
  ];
  const atl = [
    { date: '2025-10-07', value: 0 },
    { date: '2025-10-09', value: 37.75 },
  ];

  it('derives form = fitness - fatigue on days with both', () => {
    expect(fitnessSeries(ctl, atl)).toEqual([
      { date: '2025-10-07', fitness: 0, fatigue: 0, form: 0 },
      { date: '2025-10-09', fitness: 30.25, fatigue: 37.75, form: -7.5 },
    ]);
  });

  it('starts the chart 42 days after the first point, and says why', () => {
    const start = fitnessStart(ctl)!;
    expect(start).toEqual({ historyStart: '2025-10-07', chartStart: '2025-11-18' });
    expect(fitnessNote(start)).toBe(
      "intervals.icu's history starts on 7 Oct 2025, so fitness and fatigue climb from zero for their first 42 days because of where the data starts, not because of training. The chart starts on 18 Nov 2025.",
    );
    expect(fitnessStart([])).toBeUndefined();
  });

  it("is labelled as intervals.icu's model, not Garmin's", () => {
    expect(FITNESS_MODEL_LABEL).toBe("intervals.icu's fitness and fatigue model, not Garmin's training load");
  });
});

describe('manual Garmin figures, dated by as_of (FR-069)', () => {
  const manual: ManualMetrics = {
    training_status: [
      { as_of: '2026-10-23', status: 'productive' },
      { as_of: '2026-04-02', status: 'maintaining' },
    ],
    race_predictions: [
      { as_of: '2026-10-23', '5k': '19:31', '10k': '40:56', half: '1:32:01', marathon: '3:25:18' },
      { as_of: '2026-07-01', '5k': '20:10', marathon: '3:31:00' },
    ],
  };

  it('orders training status and prediction history by as_of', () => {
    expect(trainingStatusHistory(manual).map((s) => s.as_of)).toEqual(['2026-04-02', '2026-10-23']);
    expect(predictionHistory(manual, 'marathon').map((p) => p.time)).toEqual(['3:31:00', '3:25:18']);
  });

  it('puts each prediction beside its goal: "sub-3:20" and Brighton for the marathon, "achieved" for the 5k', () => {
    const rows = predictionRows(manual, [raceGoal('marathon', 42195, 12000, 'active', { linkedRace: { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon' } }), raceGoal('5k', 5000, 1200, 'achieved')]);
    expect(rows.map((r) => r.label)).toEqual(['5k', '10k', 'Half marathon', 'Marathon']);
    expect(rows[0]).toMatchObject({ latest: { time: '19:31', as_of: '2026-10-23' }, goal: { target: 'sub-20:00', achieved: true, achievedOn: '2026-10-17' } });
    expect(rows[1]!.goal).toBeUndefined();
    expect(rows[3]).toMatchObject({ latest: { time: '3:25:18' }, goal: { target: 'sub-3:20', achieved: false }, race: { name: 'Brighton Marathon', date: '2027-04-04' } });
    expect(rows[3]!.history).toHaveLength(2);
    expect(predictionRows({ training_status: [], race_predictions: [] }, [])[0]!.latest).toBeUndefined();
  });
});

describe('targets (FR-063) and the weight header', () => {
  const weight = valueGoal('weight-93', 'weight_kg', 93, 5, 'active', { start: 127.6, startDate: '2025-06-02', allTimeStart: { date: '2023-01-31', value: 133.2 }, current: { date: '2026-10-24', value: 101.1 } });

  it('marks the open goal with the highest priority, else the latest achieved one', () => {
    const later = valueGoal('weight-90', 'weight_kg', 90, 9, 'active');
    expect(goalFor([later, weight], 'weight_kg')).toBe(weight);
    const done = valueGoal('vo2-52', 'vo2max', 52.5, 7, 'achieved');
    expect(goalFor([done], 'vo2max')).toBe(done);
    expect(goalFor([], 'hrv')).toBeUndefined();
    expect(targetLine(weight)).toEqual({ value: 93, label: 'Target 93 kg' });
  });

  it('leads with the change since the goal start, then the all-time reference (as the Goals card)', () => {
    expect(startChangeText(weight)).toBe('26.5 kg down since 2 Jun 2025 (127.6 kg)');
    expect(allTimeText(weight)).toBe('32.1 kg down since 31 Jan 2023 (133.2 kg)');
  });
});

// --- Helpers for evaluations -------------------------------------------------------------

function raceGoal(id: string, distance_m: number, target_s: number, status: 'active' | 'achieved', extra: Partial<Record<string, unknown>> = {}) {
  return {
    kind: 'race_time',
    goal: { id, type: 'race_time', title: id, priority: 1, featured: true, target: { distance_m, time: '0:00' } } as unknown as Goal,
    status,
    newlyAchieved: false,
    distance_m,
    target_s,
    ...(status === 'achieved' ? { achievement: { date: '2026-10-17', by: 'effort' } } : {}),
    ...extra,
  } as never;
}

function valueGoal(id: string, metric: ValueEvaluation['metric'], target: number, priority: number, status: 'active' | 'achieved', extra: Partial<ValueEvaluation> = {}): ValueEvaluation {
  return {
    kind: 'value',
    goal: { id, type: 'metric', title: id, priority, featured: true } as unknown as Goal,
    status,
    newlyAchieved: false,
    metric,
    direction: metric === 'vo2max' ? 'at_least' : 'at_most',
    target,
    averaged: metric === 'weight_kg' || metric === 'body_fat_pct',
    ...(status === 'achieved' ? { achievement: { date: '2026-10-01', by: 'reading' as const } } : {}),
    ...extra,
  };
}

// --- The page ----------------------------------------------------------------------------

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com', trailingSlash: 'always' } });
});

const days = (from: string, n: number, value: (i: number) => number | undefined) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), value: value(i) })).filter((p): p is { date: string; value: number } => p.value !== undefined);

const SERIES: Partial<Record<HealthMetric, { date: string; value: number }[]>> = {
  weight_avg7: days('2025-10-21', 369, (i) => Math.round((123.7 - (22.6 * i) / 368) * 10) / 10),
  body_fat_pct: days('2025-10-21', 368, (i) => (i % 2 ? undefined : Math.round((32.5 - (6.5 * i) / 368) * 10) / 10)),
  vo2max: days('2025-10-17', 372, (i) => (i % 3 ? undefined : Math.round(37 + (15 * i) / 372))),
  fitness_ctl: days('2025-10-07', 383, (i) => i * 0.08),
  fatigue_atl: days('2025-10-07', 383, (i) => i * 0.1),
  resting_hr: days('2025-10-17', 373, (i) => 50 - Math.round(i / 60)),
  hrv: days('2025-12-01', 328, (i) => 45 + (i % 9)),
};
const GOALS = [
  { id: 'brighton-sub-3-20', type: 'race_time', title: 'Brighton', priority: 1, featured: true, linked_race: 'brighton-2027', target: { distance: 'marathon', time: '3:20:00' } },
  { id: 'weight-93', type: 'body_composition', title: 'Weight 93 kg', priority: 5, featured: true, created: '2025-10-01', start_value: 127.6, start_date: '2025-06-02', all_time_start: { value: 133.2, date: '2023-01-31' }, target: { metric: 'weight_kg', value: 93, direction: 'at_most' } },
  { id: 'body-fat-17-5', type: 'body_composition', title: 'Body fat 17.5%', priority: 6, featured: true, created: '2025-10-01', start_value: 33.7, start_date: '2025-06-02', target: { metric: 'body_fat_pct', value: 17.5, direction: 'at_most' } },
  { id: 'vo2max-52-5', type: 'metric', title: 'VO2 max 52.5', priority: 7, featured: true, created: '2025-10-01', target: { metric: 'vo2max', value: 52.5, direction: 'at_least' } },
] as unknown as Goal[];
const RUNS = [runFixture('2025-11-28-abcd', { device: 'Venu 2 Plus' }), runFixture('2025-12-01-efgh', { device: 'Venu X1' })] as unknown as Run[];

function store(owner: Partial<OwnerData> = {}): RunningStore {
  return {
    listRuns: async () => RUNS,
    getRun: async () => undefined,
    getRaceTrack: async () => undefined,
    getHealthSeries: async (metric, range = {}) => (SERIES[metric] ?? []).filter((p) => (!range.from || p.date >= range.from) && (!range.to || p.date <= range.to)),
    getRefreshRecord: async () => ({ schema_version: 1, generated_at: '2026-10-24T08:00:00Z', sources: { intervals: { last_data_change_at: '2026-10-24T08:00:00Z', last_success_at_build: '2026-10-24T08:00:00Z' } } }),
    getCampaignFigures: async () => [],
    getOwner: async () => ({
      section: { focus_race: { race_id: 'brighton-2027', build_start: '2026-09-05', charity: { name: 'Martlets' } }, garmin_devices: { scale: 'Index S2' } },
      goals: GOALS,
      upcomingRaces: [{ id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon', target_time: '3:20:00' }],
      races: [],
      overrides: [],
      exclusions: [],
      lab: [],
      manualMetrics: { training_status: [{ as_of: '2026-10-23', status: 'productive' }], race_predictions: [{ as_of: '2026-10-23', '5k': '19:31', '10k': '40:56', half: '1:32:01', marathon: '3:25:18' }] },
      campaigns: [],
      ...owner,
    }) as OwnerData,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  setRunningStore(undefined);
});

const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
const text = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.):])/g, '$1')
    .trim();
const render = async (owner?: Partial<OwnerData>) => {
  setRunningStore(store(owner));
  return clean(await container.renderToString(Health, { request: new Request('https://alexanderwebber.com/running/health/') }));
};

describe('the health page', () => {
  it('shows the metrics body first, in the owner order', async () => {
    const html = await render();
    const order = ['weight-figure-title', 'body-fat-figure-title', 'vo2max-figure-title', 'race-predictions-heading', 'training-status-heading', 'fitness-figure-title', 'resting-hr-figure-title', 'hrv-figure-title'].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('leads weight with the change since the start, then the all-time line, then the 7-day average (FR-061)', async () => {
    const t = text(await render());
    expect(t).toContain('26.5 kg down since 2 Jun 2025 (127.6 kg) 32.1 kg down since 31 Jan 2023 (133.2 kg) Now 101.1 kg (7-day average) · 24 Oct 2026 Target 93 kg: 8.1 kg to go');
  });

  it('leads body fat with the change since the start, from the 7-day average (owner, PR #57)', async () => {
    const t = text(await render());
    expect(t).toMatch(/[\d.]+% down since 2 Jun 2025 \(33\.7%\) Now 26\.\d% \(7-day average\)/);
  });

  it('labels the averaged headlines, marks the targets, and opens every chart on 1 year (FR-063, FR-068)', async () => {
    const html = await render();
    const t = text(html);
    expect(t).toMatch(/Body fat .*Now 26\.\d% \(7-day average\)/);
    expect(t).toMatch(/Resting heart rate .*Now [\d.]+ bpm \(7-day average\)/);
    expect(t).toMatch(/HRV .*Now [\d.]+ ms \(7-day average\)/);
    expect(html).toContain('Target 93 kg');
    expect(html).toContain('Target 17.5%');
    expect(html).toContain('Target 52.5');
    const checked = [...html.matchAll(/<input[^>]*value="(3m|1y|all)"[^>]*checked/g)].map((m) => m[1]);
    expect(checked.length).toBeGreaterThanOrEqual(6);
    expect(new Set(checked)).toEqual(new Set(['1y']));
  });

  it('draws daily readings as dots under the average line for body fat, resting HR and HRV, never for weight', async () => {
    const html = await render();
    const figure = (id: string) => html.slice(html.indexOf(`id="${id}-figure-title"`), html.indexOf('</figure>', html.indexOf(`id="${id}-figure-title"`)));
    for (const id of ['body-fat', 'resting-hr', 'hrv']) expect(figure(id)).toContain('class="chart-dots"');
    expect(figure('weight')).not.toContain('chart-dots');
    expect(figure('weight')).toContain('Weight (7-day average)');
  });

  it("labels fitness, fatigue and form as intervals.icu's model, starting 42 days in, with derived attribution", async () => {
    const html = await render();
    const t = text(html);
    expect(t).toContain("intervals.icu's fitness and fatigue model, not Garmin's training load");
    expect(t).toContain('The chart starts on 18 Nov 2025.');
    expect(t).toContain('Derived in part from Garmin device-sourced data');
    expect(html).not.toMatch(/fitness-1y[\s\S]{0,4000}Oct 2025/);
  });

  it('shows the HRV note from the data and the runs, with no baseline band (intervals.icu has none)', async () => {
    const html = await render();
    expect(text(html)).toContain('HRV readings start on 1 Dec 2025, when the Venu X1 replaced the Venu 2 Plus.');
    expect(html).not.toContain('chart-band');
  });

  it('shows race predictions beside their goals, training status "as of", and no trend from one entry', async () => {
    const html = await render();
    const t = text(html);
    expect(t).toContain('Marathon 3:25:18 (as of 23 Oct 2026) Goal sub-3:20 Brighton Marathon, 4 Apr 2027');
    expect(t).toContain('Productive (as of 23 Oct 2026)');
    expect(html).not.toContain('prediction-marathon-figure');
  });

  it('shows the prediction trend once there are two dated entries', async () => {
    const html = await render({ manualMetrics: { training_status: [], race_predictions: [{ as_of: '2026-07-01', marathon: '3:31:00' }, { as_of: '2026-10-23', marathon: '3:25:18' }] } });
    expect(html).toContain('id="prediction-marathon-figure-title"');
    expect(html).not.toContain('id="prediction-5k-figure-title"');
    expect(text(html)).toContain('Garmin training status not recorded yet');
  });

  it('US5.4/US5.5: lab results are labelled markers with a comparison', async () => {
    const html = await render({ lab: [lab('2025-11-10', 'dexa', { body_fat_pct: 30.0 }), lab('2026-10-20', 'dexa', { body_fat_pct: 25.1 }), lab('2026-03-15', 'lab_vo2max', { vo2max: 51.0 })] });
    expect(html.match(/class="chart-marker"/g)!.length).toBeGreaterThanOrEqual(3);
    const t = text(html);
    expect(t).toMatch(/Lab test, 15 Mar 2026 \(Example Clinic\): 51\.0\. Garmin, \d+ Mar 2026: \d+\.0\. Difference \(lab minus Garmin\): \+8\.0\./);
    expect(t.match(/DEXA scan, /g)).toHaveLength(2);
  });

  it('shows nothing that is not approved: no daily weights, sleep, stress, Body Battery, steps or SpO2', async () => {
    const t = text(await render()).toLowerCase();
    for (const word of ['sleep', 'stress', 'body battery', 'steps', 'spo2', 'pulse ox']) expect(t).not.toContain(word);
    expect(t).not.toMatch(/weigh-in[^s]/);
  });
});
