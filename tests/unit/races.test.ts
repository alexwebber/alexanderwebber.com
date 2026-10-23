// Upcoming races and the focus race (T108 for T096; FR-020, FR-026, FR-056, quickstart 7d). "Today"
// is pinned in every case.
import { describe, expect, it } from 'vitest';
import {
  countdownText,
  daysRemaining,
  focusRace,
  raceDistance,
  raceResult,
  raceState,
  shortRaceName,
  targetLabel,
  upcomingRaces,
} from '../../src/sections/running/domain/races.ts';
import type { Race, Run, UpcomingRace } from '../../src/shared/storage/index.ts';
import { run } from '../helpers/temp-repo.ts';

const brighton: UpcomingRace = { id: 'brighton-2027', name: 'Brighton Marathon', date: '2027-04-04', distance: 'marathon', target_time: '3:30:00' };
const section = { focus_race: { race_id: 'brighton-2027', build_start: '2026-11-16', charity: { name: 'Martlets hospice' } } };

describe('days remaining', () => {
  it('counts 182 days from 4 Oct 2026 to 4 Apr 2027 (US1.1)', () => {
    expect(daysRemaining(brighton, '2026-10-04')).toBe(182);
  });

  it('counts calendar days across the clocks changing (BST to GMT, GMT to BST)', () => {
    expect(daysRemaining({ date: '2026-10-26' }, '2026-10-24')).toBe(2); // clocks go back 25 Oct
    expect(daysRemaining({ date: '2027-03-29' }, '2027-03-27')).toBe(2); // clocks go forward 28 Mar
  });
});

describe('state machine (quickstart 7d)', () => {
  it('is upcoming the day before, race day on the day, and awaiting a result after', () => {
    expect(raceState(brighton, '2027-04-03')).toBe('upcoming');
    expect(raceState(brighton, '2027-04-04')).toBe('race_day');
    expect(raceState(brighton, '2027-04-05')).toBe('awaiting_result');
  });

  it('is completed once result_ref is set, whatever the date', () => {
    expect(raceState({ ...brighton, result_ref: 'brighton-marathon-2027' }, '2027-04-05')).toBe('completed');
    expect(raceState({ ...brighton, result_ref: 'brighton-marathon-2027' }, '2027-04-04')).toBe('completed');
  });

  it('words the countdown for each state', () => {
    expect(countdownText(182)).toEqual(['182', 'days to go']);
    expect(countdownText(1)).toEqual(['1', 'day to go']);
    expect(countdownText(0)).toEqual(['Race day', '']);
    expect(countdownText(-1)).toEqual(['Result coming soon', '']);
  });
});

describe('the focus race and upcoming order', () => {
  const paris: UpcomingRace = { id: 'paris-2027', name: 'Paris 10k', date: '2027-02-01', distance: '10k' };
  const done: UpcomingRace = { id: 'hastings-2026', name: 'Hastings Half', date: '2026-09-01', distance: 'half', result_ref: 'hastings-2026' };

  it('resolves the focus race from section.yaml, and none without it or a match (FR-026)', () => {
    expect(focusRace(section, [paris, brighton])).toBe(brighton);
    expect(focusRace(undefined, [brighton])).toBeUndefined();
    expect(focusRace({ focus_race: { ...section.focus_race, race_id: 'nope' } }, [brighton])).toBeUndefined();
  });

  it('lists the focus race first, then by date, without completed races (FR-056)', () => {
    expect(upcomingRaces([done, brighton, paris], 'brighton-2027', '2026-10-04').map((r) => r.id)).toEqual(['brighton-2027', 'paris-2027']);
    expect(upcomingRaces([done, brighton, paris], undefined, '2026-10-04').map((r) => r.id)).toEqual(['paris-2027', 'brighton-2027']);
  });

  it('reads named and metre distances', () => {
    expect(raceDistance(brighton)).toBe(42195);
    expect(raceDistance({ distance_m: 8000 } as UpcomingRace)).toBe(8000);
  });
});

describe('words', () => {
  it('labels targets, dropping zero seconds past an hour (US1.1, US1.2)', () => {
    expect(targetLabel('3:30:00')).toBe('sub-3:30');
    expect(targetLabel('3:20:00')).toBe('sub-3:20');
    expect(targetLabel('3:29:30')).toBe('sub-3:29:30');
    expect(targetLabel('44:30')).toBe('sub-44:30');
    expect(targetLabel('3:7x')).toBeUndefined();
  });

  it('shortens race names for the share image', () => {
    expect(shortRaceName('Brighton Marathon')).toBe('Brighton');
    expect(shortRaceName('Hastings Half Marathon')).toBe('Hastings');
    expect(shortRaceName('Paris 10k')).toBe('Paris');
    expect(shortRaceName('Marathon')).toBe('Marathon');
  });
});

describe('the result of a completed race', () => {
  const runs = [run('2027-04-04-abcd', { is_race: true, distance_m: 42400, elapsed_s: 12_400 }) as unknown as Run];

  it('takes the official time over the device time (FR-051)', () => {
    const races = [{ slug: 'brighton-marathon-2027', date: '2027-04-04', distance: 'marathon', run_id: '2027-04-04-abcd', official_time: '3:24:10' }] as Race[];
    expect(raceResult({ result_ref: 'brighton-marathon-2027' }, races, runs)).toEqual({ time_s: 12_250, official: true, slug: 'brighton-marathon-2027', run_id: '2027-04-04-abcd' });
  });

  it("falls back to the linked run's elapsed time, and has no time without either", () => {
    const linked = [{ slug: 'b', date: '2027-04-04', distance: 'marathon', run_id: '2027-04-04-abcd' }] as Race[];
    expect(raceResult({ result_ref: 'b' }, linked, runs)).toEqual({ time_s: 12_400, official: false, slug: 'b', run_id: '2027-04-04-abcd' });
    const bare = [{ slug: 'b', date: '2027-04-04', distance: 'marathon' }] as Race[];
    expect(raceResult({ result_ref: 'b' }, bare, runs)).toEqual({ official: false, slug: 'b' });
    expect(raceResult({ result_ref: 'missing' }, bare, runs)).toBeUndefined();
  });
});
