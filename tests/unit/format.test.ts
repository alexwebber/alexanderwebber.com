import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDate,
  formatDuration,
  formatKg,
  formatKm,
  formatPace,
  londonDate,
  londonMidnight,
  parseDistance,
  parseTime,
  weekStart,
} from '../../src/shared/format/index.ts';

describe('parse', () => {
  it('parses h:mm:ss and mm:ss', () => {
    expect(parseTime('3:30:00')).toBe(12_600);
    expect(parseTime('44:59')).toBe(2699);
    expect(parseTime('1:41:07')).toBe(6067);
    expect(parseTime('105:00')).toBe(6300);
  });

  it('rejects malformed and out-of-range times', () => {
    for (const bad of ['3:7x', '44:7x', '44:60', '3:60:00', '0:00', '24:00:00', '45', '', ' 44:59']) {
      expect(parseTime(bad), bad).toBeUndefined();
    }
  });

  it('parses distance names and metres', () => {
    expect(parseDistance('marathon')).toBe(42_195);
    expect(parseDistance('half')).toBe(21_097.5);
    expect(parseDistance('10mi')).toBeCloseTo(16_093.44);
    expect(parseDistance(5000)).toBe(5000);
    expect(parseDistance('10km')).toBeUndefined();
    expect(parseDistance(-1)).toBeUndefined();
  });
});

describe('dates', () => {
  it('formats UK dates', () => {
    expect(formatDate('2027-04-04')).toBe('4 Apr 2027');
    expect(formatDate('2026-09-30')).toBe('30 Sep 2026');
  });

  it('converts instants to Europe/London dates across BST and GMT', () => {
    expect(londonDate(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02'); // BST
    expect(londonDate(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01'); // GMT
    expect(londonDate(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25'); // 01:30 BST, clocks go back
    expect(londonDate(new Date('2027-03-28T00:30:00Z'))).toBe('2027-03-28'); // 00:30 GMT, clocks go forward
  });

  it('finds the instant a UK day starts, in BST, in GMT and on both clock-change days', () => {
    expect(londonMidnight('2026-07-01')).toBe(Date.parse('2026-06-30T23:00:00Z')); // BST
    expect(londonMidnight('2026-12-01')).toBe(Date.parse('2026-12-01T00:00:00Z')); // GMT
    expect(londonMidnight('2026-10-25')).toBe(Date.parse('2026-10-24T23:00:00Z')); // clocks go back at 02:00 BST
    expect(londonMidnight('2026-10-26')).toBe(Date.parse('2026-10-26T00:00:00Z'));
    expect(londonMidnight('2027-03-28')).toBe(Date.parse('2027-03-28T00:00:00Z')); // clocks go forward at 01:00 GMT
    expect(londonMidnight('2027-03-29')).toBe(Date.parse('2027-03-28T23:00:00Z'));
  });

  it('counts calendar days across clock changes', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
    expect(daysBetween('2026-10-17', '2027-04-04')).toBe(169);
    expect(daysBetween('2027-04-05', '2027-04-04')).toBe(-1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // Friday, across a year
  });
});

describe('units', () => {
  it('formats distance, durations, pace and weight', () => {
    expect(formatKm(8234)).toBe('8.2 km');
    expect(formatKm(1_234_567)).toBe('1,234.6 km');
    expect(formatDuration(2681)).toBe('44:41');
    expect(formatDuration(12_520)).toBe('3:28:40');
    expect(formatDuration(3599.6)).toBe('1:00:00');
    expect(formatPace(299.6)).toBe('5:00 /km');
    expect(formatKg(100.71)).toBe('100.7 kg');
  });
});
