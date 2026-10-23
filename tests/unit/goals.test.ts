// Goal evaluation (T094; spec US2 acceptance scenarios, FR-033..042, data-model §5), with the
// Best Effort index (T087) and body-composition averages (T088) it builds on. "Today" is pinned
// in every case.
import { describe, expect, it } from 'vitest';
import { bodyFatAverage, trailingMean } from '../../src/sections/running/domain/composition.ts';
import { buildEffortIndex, effortsAt, fastestEffort } from '../../src/sections/running/domain/efforts.ts';
import { goalAttribution, goalsViewAttribution } from '../../src/sections/running/domain/attribution.ts';
import { deadlineText, gapText, progressText, targetText } from '../../src/sections/running/domain/goal-text.ts';
import {
  achievedGoals,
  activeGoals,
  evaluateGoals,
  featuredGoals,
  type GoalEvaluation,
  type GoalInputs,
  type RaceTimeEvaluation,
  type ValueEvaluation,
} from '../../src/sections/running/domain/goals.ts';
import { latestManualMetrics } from '../../src/sections/running/domain/manual-metrics.ts';
import type { Goal, Race, Run, RunOverride } from '../../src/shared/storage/index.ts';
import { run as runFixture } from '../helpers/temp-repo.ts';

type Effort = { distance_m: number; label: string; time_s: number; plausible?: boolean };

function run(id: string, efforts: Effort[], extra: Partial<Run> = {}): Run {
  return runFixture(id, {
    distance_m: Math.max(5000, ...efforts.map((e) => e.distance_m)),
    device: 'Venu X1',
    best_efforts: efforts.map((e) => ({ plausible: true, ...e })),
    ...extra,
  }) as unknown as Run;
}

const tenK = (time_s: number, extra: Partial<Effort> = {}): Effort => ({ distance_m: 10000, label: '10k', time_s, ...extra });
const fiveK = (time_s: number, extra: Partial<Effort> = {}): Effort => ({ distance_m: 5000, label: '5k', time_s, ...extra });

function raceTimeGoal(id: string, distance: string, time: string, extra: Partial<Goal> = {}): Goal {
  return { id, type: 'race_time', title: id, priority: 1, featured: true, target: { distance, time }, ...extra } as Goal;
}

function valueGoal(id: string, metric: string, value: number, direction: 'at_most' | 'at_least', extra: Partial<Goal> = {}): Goal {
  const type = metric === 'weight_kg' || metric === 'body_fat_pct' ? 'body_composition' : 'metric';
  return { id, type, title: id, priority: 2, featured: true, target: { metric, value, direction }, ...extra } as Goal;
}

const series = (start: string, values: (number | null)[]) =>
  values.flatMap((value, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return value === null ? [] : [{ date: d.toISOString().slice(0, 10), value }];
  });

interface Setup {
  goals: Goal[];
  runs?: Run[];
  races?: Race[];
  overrides?: RunOverride[];
  health?: GoalInputs['health'];
  manual?: GoalInputs['manual'];
  today?: string;
  upcomingRaces?: GoalInputs['upcomingRaces'];
}

function evaluate(s: Setup): GoalEvaluation[] {
  return evaluateGoals({
    goals: s.goals,
    efforts: buildEffortIndex(s.runs ?? [], s.races ?? [], s.overrides ?? []),
    health: s.health ?? {},
    manual: s.manual ?? latestManualMetrics({ training_status: [], race_predictions: [] }),
    upcomingRaces: s.upcomingRaces ?? [],
    today: s.today ?? '2027-03-20',
    highlightDays: 14,
  });
}

const one = <T extends GoalEvaluation>(s: Setup) => evaluate(s)[0] as T;

describe('US2 acceptance scenarios', () => {
  it('US2.1: a 44:41 10k inside a longer run achieves "10k under 45:00" on that run\'s date', () => {
    const longRun = run('2027-03-12-k3f7', [fiveK(1320), tenK(2681), { distance_m: 15000, label: '15k', time_s: 4100 }], { distance_m: 16000 });
    const earlier = run('2027-03-01-p2rt', [tenK(2760)]);
    const e = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('10k-sub-45', '10k', '45:00')], runs: [longRun, earlier] });
    expect(e.status).toBe('achieved');
    expect(e.achievement).toMatchObject({ date: '2027-03-12', by: 'effort', effort: { time_s: 2681, run_id: '2027-03-12-k3f7', source: 'run' } });
    expect(achievedGoals([e])).toEqual([e]);
    expect(activeGoals([e])).toEqual([]);
  });

  it('US2.2: shows the target, the fastest 5k and the latest Garmin prediction with its date', () => {
    const manual = latestManualMetrics({
      training_status: [],
      race_predictions: [
        { as_of: '2027-02-01', '5k': '21:05' },
        { as_of: '2027-03-01', '5k': '20:47' },
      ],
    });
    const e = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('5k-sub-20', '5k', '20:00')], runs: [run('2027-03-05-abcd', [fiveK(1225.4)])], manual });
    expect(e.status).toBe('active');
    expect(targetText(e)).toBe('Under 20:00 for 5k');
    expect(e.fastest).toMatchObject({ time_s: 1225.4, date: '2027-03-05' });
    expect(e.prediction).toEqual({ distance: '5k', time: '20:47', seconds: 1247, as_of: '2027-03-01' });
    expect(gapText(e)).toBe('0:25 to go');
  });

  it('US2.3: body fat from a 26.0% start to a 22.0% 7-day average is about 47% of the way to 17.5%', () => {
    const readings = series('2027-03-10', [22.4, null, 21.8, 22.1, null, 21.7, 22.0]); // mean 22.0
    const e = one<ValueEvaluation>({ goals: [valueGoal('body-fat', 'body_fat_pct', 17.5, 'at_most', { start_value: 26.0 })], health: { body_fat_pct: readings } });
    expect(e.current).toEqual({ date: '2027-03-16', value: 22.0 });
    expect(e.latest).toEqual({ date: '2027-03-16', value: 22.0 });
    expect(e.fraction).toBeCloseTo(4 / 8.5, 5);
    expect(Math.round(e.fraction! * 100)).toBe(47);
    expect(progressText(e)).toBe('7-day average 22.0%: 47% of the way from 26.0% to 17.5%');
  });

  it('US2.4: a revised target is the only target, and is judged against the revised time', () => {
    const marathon = run('2027-04-04-race', [{ distance_m: 42195, label: 'marathon', time_s: 12300 }], { distance_m: 42400 }); // 3:25:00
    const revised = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('brighton', 'marathon', '3:20:00')], runs: [marathon], today: '2027-04-04' });
    expect(targetText(revised)).toBe('Under 3:20:00 for marathon');
    expect(revised.target_s).toBe(12000);
    expect(revised.status).toBe('active');
  });

  it('US2.5: a passed deadline shows "deadline passed" until revised; a retired goal is not shown', () => {
    const goal = raceTimeGoal('10k-sub-40', '10k', '40:00', { deadline: '2027-03-01' });
    const passed = one({ goals: [goal], runs: [run('2027-02-01-aaaa', [tenK(2500)])] });
    expect(passed.status).toBe('deadline_passed');
    expect(passed.daysToDeadline).toBe(-19);
    expect(deadlineText(passed.daysToDeadline!)).toBe('Deadline passed');
    expect(activeGoals([passed])).toEqual([passed]);

    const revised = one({ goals: [{ ...goal, deadline: '2027-06-01' }] });
    expect(revised.status).toBe('active');
    expect(deadlineText(revised.daysToDeadline!)).toBe('73 days left');

    expect(evaluate({ goals: [{ ...goal, retired: true }] })).toEqual([]);
  });

  it('US2.6: an achieved weight goal stays achieved with its original date when weight rises again', () => {
    const weight = series('2027-02-01', [94.0, 93.4, 92.9, 92.8, 93.5, 94.1, 95.0]);
    const e = one<ValueEvaluation>({ goals: [valueGoal('weight-93', 'weight_kg', 93, 'at_most')], health: { weight_kg: weight } });
    expect(e.status).toBe('achieved');
    expect(e.achievement).toEqual({ date: '2027-02-03', by: 'reading', reading: { date: '2027-02-03', value: 92.9 } });
    expect(e.current?.value).toBe(95.0);
  });
});

describe('edge cases', () => {
  it('no data yet: no progress figure rather than 0%', () => {
    const [race, vo2] = evaluate({ goals: [raceTimeGoal('marathon', 'marathon', '3:25:00'), valueGoal('vo2', 'vo2max', 52.5, 'at_least')] }) as [RaceTimeEvaluation, ValueEvaluation];
    expect(race.fastest).toBeUndefined();
    expect(race.fraction).toBeUndefined();
    expect(progressText(race)).toBeUndefined();
    expect(vo2.current).toBeUndefined();
    expect(vo2.start).toBeUndefined();
    expect(vo2.fraction).toBeUndefined();
    expect(vo2.status).toBe('active');
  });

  it('ignores indoor/treadmill and implausible efforts', () => {
    const treadmill = run('2027-03-02-tttt', [fiveK(1150)], { type: 'indoor', treadmill: true });
    const gpsGlitch = run('2027-03-03-gggg', [fiveK(540, { plausible: false })]);
    const excluded = run('2027-03-04-xxxx', [fiveK(1160)], { flags: { excluded_from_records: true } });
    const ok = run('2027-03-05-oooo', [fiveK(1230)]);
    const e = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [treadmill, gpsGlitch, excluded, ok] });
    expect(e.status).toBe('active');
    expect(e.fastest?.run_id).toBe('2027-03-05-oooo');
  });

  it('counts a treadmill run the owner included, by override or by the published flag', () => {
    const treadmill = run('2027-03-02-tttt', [fiveK(1150)], { type: 'indoor', treadmill: true });
    const byOverride = one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [treadmill], overrides: [{ id: '2027-03-02-tttt', include_in_records: true }] });
    expect(byOverride.achievement?.date).toBe('2027-03-02');
    const flagged = run('2027-03-02-tttt', [fiveK(1150)], { type: 'indoor', treadmill: true, flags: { include_indoor_in_records: true } });
    expect(one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [flagged] }).status).toBe('achieved');
  });

  it('applies the owner file over published flags (exclusion added since the last refresh)', () => {
    const fast = run('2027-03-02-ffff', [fiveK(1150)]);
    const e = one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [fast], overrides: [{ id: '2027-03-02-ffff', exclude_from_records: true }] });
    expect(e.status).toBe('active');
  });

  it('counts a hand-entered race result (FR-035)', () => {
    const race: Race = { slug: 'parkrun-2027', name: 'Hove parkrun', date: '2027-01-09', distance: '5k', official_time: '19:58' };
    const e = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('5k', '5k', '20:00')], races: [race] });
    expect(e.achievement).toMatchObject({ date: '2027-01-09', effort: { source: 'race', time_s: 1198, race: { slug: 'parkrun-2027', name: 'Hove parkrun' } } });
    expect(e.achievement?.effort?.run_id).toBeUndefined();
    // A hand-entered result isn't Garmin data, so the card carries no Garmin attribution.
    expect(goalAttribution(e)).toBeUndefined();
  });

  it("uses a linked race's official time instead of the device time at the race distance", () => {
    const raced = run('2027-02-14-rrrr', [fiveK(1195), tenK(2595)], { is_race: true });
    const race: Race = { slug: 'brighton-10k', run_id: '2027-02-14-rrrr', name: 'Brighton 10k', date: '2027-02-14', distance: '10k', official_time: '43:05' };
    const index = buildEffortIndex([raced], [race]);
    expect(effortsAt(index, 10000)).toEqual([
      { distance_m: 10000, time_s: 2585, date: '2027-02-14', source: 'race', run_id: '2027-02-14-rrrr', device: 'Venu X1', race: { slug: 'brighton-10k', name: 'Brighton 10k' } },
    ]);
    // Other distances inside the race still count from the device.
    expect(fastestEffort(index, 5000)?.time_s).toBe(1195);
    expect(one({ goals: [raceTimeGoal('10k', '10k', '43:00')], runs: [raced], races: [race] }).status).toBe('active');
  });

  it('owner overrides: achieved_override wins; status_override keeps a goal active', () => {
    const fast = run('2027-03-02-ffff', [fiveK(1150)]);
    const manual = one({ goals: [raceTimeGoal('5k', '5k', '20:00', { achieved_override: { date: '2026-06-01', note: 'Official chip time at a race not on Garmin' } })], runs: [fast] });
    expect(manual.achievement).toEqual({ date: '2026-06-01', by: 'override', note: 'Official chip time at a race not on Garmin' });
    const kept = one({ goals: [raceTimeGoal('5k', '5k', '20:00', { status_override: 'active' })], runs: [fast] });
    expect(kept.status).toBe('active');
    const milestone = one({ goals: [{ id: 'ultra', type: 'milestone', title: 'Finish a trail ultra', priority: 3, featured: false }] });
    expect(milestone.status).toBe('active');
    const done = one({ goals: [{ id: 'ultra', type: 'milestone', title: 'Finish a trail ultra', priority: 3, featured: false, achieved_override: { date: '2027-03-01' } }] });
    expect(done.achievement).toEqual({ date: '2027-03-01', by: 'override' });
  });

  it('no prediction entry: none attached; a non-predicted distance never gets one', () => {
    const none = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('half', 'half', '1:40:00')] });
    expect(none.prediction).toBeUndefined();
    const manual = latestManualMetrics({ training_status: [], race_predictions: [{ as_of: '2027-03-01', '10k': '41:00' }] });
    const tenMile = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('10mi', '10mi', '1:15:00')], manual });
    expect(tenMile.prediction).toBeUndefined();
    const half = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('half', 'half', '1:40:00')], manual });
    expect(half.prediction).toBeUndefined();
  });

  it('an effort that rounds to the target time does not count as under it', () => {
    const close = run('2027-03-02-cccc', [fiveK(1199.6)]);
    expect(one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [close] }).status).toBe('active');
    const under = run('2027-03-02-cccc', [fiveK(1199.4)]);
    expect(one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs: [under] }).status).toBe('achieved');
  });

  it('achieves on the first qualifying date, with the fastest effort that day', () => {
    const runs = [run('2027-03-10-bbbb', [fiveK(1100)]), run('2027-03-02-aaaa', [fiveK(1190)]), run('2027-03-02-cccc', [fiveK(1180)])];
    const e = one<RaceTimeEvaluation>({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs });
    expect(e.achievement?.effort).toMatchObject({ date: '2027-03-02', time_s: 1180, run_id: '2027-03-02-cccc' });
    expect(e.fastest?.time_s).toBe(1100);
  });

  it('only counts data from `created` on, for achievement and the start value', () => {
    const weight = series('2025-09-25', [92.0, 92.5, null, null, null, null, null, 101.0, 100.4]); // 2025-09-25 .. 2025-10-03
    const e = one<ValueEvaluation>({ goals: [valueGoal('weight', 'weight_kg', 93, 'at_most', { created: '2025-10-01' })], health: { weight_kg: weight }, today: '2025-10-03' });
    expect(e.status).toBe('active');
    expect(e.start).toBe(101.0);
    expect(e.current).toEqual({ date: '2025-10-03', value: 100.4 });
    expect(e.fraction).toBeCloseTo(0.6 / 8, 5);
    // Without `created`, the first reading in the series is the start.
    expect(one<ValueEvaluation>({ goals: [valueGoal('weight', 'weight_kg', 85, 'at_most')], health: { weight_kg: weight } }).start).toBe(92.0);
  });

  it('judges metric goals on the recorded value, at least or at most', () => {
    const vo2 = series('2026-10-01', [50, 51, 52, 53, 52]);
    const e = one<ValueEvaluation>({ goals: [valueGoal('vo2', 'vo2max', 52.5, 'at_least', { start_value: 50 })], health: { vo2max: vo2 } });
    expect(e.achievement).toMatchObject({ date: '2026-10-04', reading: { value: 53 } });
    const rhr = one<ValueEvaluation>({ goals: [valueGoal('rhr', 'resting_hr', 45, 'at_most')], health: { resting_hr: series('2026-10-01', [52, 50, 48]) } });
    expect(rhr.status).toBe('active');
    expect(rhr.fraction).toBeCloseTo(4 / 7, 5);
    expect(progressText(rhr)).toBe('Latest 48 bpm: 57% of the way from 52 bpm to 45 bpm');
  });

  it('flags goals achieved within the highlight window as newly achieved', () => {
    const runs = [run('2027-03-07-aaaa', [fiveK(1190)])];
    expect(one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs, today: '2027-03-20' }).newlyAchieved).toBe(true); // 13 days
    expect(one({ goals: [raceTimeGoal('5k', '5k', '20:00')], runs, today: '2027-03-21' }).newlyAchieved).toBe(false); // 14 days
  });

  it('orders active goals by priority, achieved goals newest first, and limits featured goals', () => {
    const goals = [
      raceTimeGoal('c', '10k', '40:00', { priority: 3 }),
      raceTimeGoal('a', '10k', '40:00', { priority: 1 }),
      raceTimeGoal('b', '10k', '40:00', { priority: 2, featured: false }),
      raceTimeGoal('old', '5k', '25:00', { priority: 4 }),
      raceTimeGoal('new', '5k', '20:00', { priority: 5 }),
    ];
    const runs = [run('2027-01-01-aaaa', [fiveK(1400)]), run('2027-03-01-bbbb', [fiveK(1190)])];
    const all = evaluate({ goals, runs });
    expect(activeGoals(all).map((e) => e.goal.id)).toEqual(['a', 'b', 'c']);
    expect(achievedGoals(all).map((e) => e.goal.id)).toEqual(['new', 'old']);
    // Featured goals keep their priority order whether achieved or not (the landing page shows both).
    expect(featuredGoals(all, 6).map((e) => e.goal.id)).toEqual(['a', 'c', 'old', 'new']);
    expect(featuredGoals(all, 3).map((e) => e.goal.id)).toEqual(['a', 'c', 'old']);
    expect(featuredGoals(all, 1).map((e) => e.goal.id)).toEqual(['a']);
  });

  it('attaches the linked upcoming race', () => {
    const brighton = { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon' as const, target_time: '3:25:00' };
    const e = one({ goals: [raceTimeGoal('brighton', 'marathon', '3:25:00', { linked_race: 'brighton-2027', deadline: '2027-04-04' })], upcomingRaces: [brighton] });
    expect(e.linkedRace).toEqual(brighton);
    expect(e.daysToDeadline).toBe(15);
  });
});

describe('Garmin attribution for goal views (FR-077)', () => {
  it('names the watch behind the effort, the scale for body composition, and plain Garmin otherwise', () => {
    const manual = latestManualMetrics({ training_status: [], race_predictions: [{ as_of: '2027-03-01', marathon: '3:25:18' }] });
    const [tenk, marathon, weight, vo2, milestone] = evaluate({
      goals: [
        raceTimeGoal('10k', '10k', '43:00'),
        raceTimeGoal('m', 'marathon', '3:25:00'),
        valueGoal('w', 'weight_kg', 93, 'at_most'),
        valueGoal('v', 'vo2max', 52.5, 'at_least'),
        { id: 'ultra', type: 'milestone', title: 'Ultra', priority: 9, featured: false },
      ],
      runs: [run('2027-03-01-aaaa', [tenK(2760)]), run('2026-09-01-bbbb', [tenK(2900)], { device: 'Venu 2 Plus' })],
      health: { weight_kg: series('2027-03-01', [101]), vo2max: series('2027-03-01', [51]) },
      manual,
    });
    expect(goalAttribution(tenk!)).toEqual({ device: 'Venu X1' });
    expect(goalAttribution(marathon!)).toEqual({}); // the prediction only: plain "Garmin"
    expect(goalAttribution(weight!)).toEqual({ scale: true });
    expect(goalAttribution(vo2!)).toEqual({});
    expect(goalAttribution(milestone!)).toBeUndefined();
    expect(goalsViewAttribution([tenk!, marathon!, weight!, vo2!, milestone!], 'Index S2')).toEqual({ device: ['Venu X1', 'Index S2'] });
    expect(goalsViewAttribution([milestone!], 'Index S2')).toBeUndefined();
  });
});

describe('composition (T088)', () => {
  it('takes a trailing 7-day mean, with no value for a day whose window has no reading', () => {
    const readings = [
      { date: '2027-01-01', value: 26.0 },
      { date: '2027-01-03', value: 25.0 },
      { date: '2027-01-12', value: 24.0 },
    ];
    const avg = bodyFatAverage(readings);
    expect(avg.slice(0, 3)).toEqual([
      { date: '2027-01-01', value: 26.0 },
      { date: '2027-01-02', value: 26.0 },
      { date: '2027-01-03', value: 25.5 },
    ]);
    expect(avg.find((p) => p.date === '2027-01-07')).toEqual({ date: '2027-01-07', value: 25.5 });
    expect(avg.find((p) => p.date === '2027-01-08')).toEqual({ date: '2027-01-08', value: 25.0 }); // 1 Jan left the window
    expect(avg.find((p) => p.date === '2027-01-10')).toBeUndefined(); // gap: nothing carried forward
    expect(avg.at(-1)).toEqual({ date: '2027-01-12', value: 24.0 });
    expect(trailingMean([], '2027-01-01')).toEqual([]);
    expect(trailingMean(readings, '2027-01-14').at(-1)).toEqual({ date: '2027-01-14', value: 24.0 });
  });

  it('judges body-fat goals on the 7-day average, not a single low reading', () => {
    const readings = series('2027-03-01', [18.0, 17.2, 18.2]); // one reading under 17.5, the average never is
    const e = one<ValueEvaluation>({ goals: [valueGoal('bf', 'body_fat_pct', 17.5, 'at_most')], health: { body_fat_pct: readings } });
    expect(e.status).toBe('active');
    expect(e.current?.value).toBe(17.8);
    expect(e.latest?.value).toBe(18.2); // the headline is the latest recorded reading
  });
});
