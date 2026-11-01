// Fundraising's pure rules (T056; FR-005, FR-032, FR-061, FR-063): amounts and percentages round
// down, a target is only ever "reached" when it is, and the staleness edge is exact.
import { describe, expect, it } from 'vitest';
import { barValueText, campaignProgress, isStale, poundsText, supportersText, targetNote } from '../../src/sections/running/domain/fundraising.ts';

describe('poundsText (FR-063)', () => {
  it.each([
    [0, '£0'],
    [99, '£0'],
    [100, '£1'],
    [125099, '£1,250'],
    [103075, '£1,030'], // JustGiving's page shows £1,031
    [100000000, '£1,000,000'],
  ])('%d pence reads %s', (pence, text) => {
    expect(poundsText(pence)).toBe(text);
  });
});

describe('campaignProgress (FR-032)', () => {
  it('rounds down, so £1,250 of £2,000 is 62, not 63', () => {
    expect(campaignProgress(125000, 200000)).toEqual({ percent: 62, fraction: 0.62, reached: false, beaten: false });
  });

  it('never shows 99.9% as complete', () => {
    expect(campaignProgress(199800, 200000)).toEqual({ percent: 99, fraction: 0.99, reached: false, beaten: false });
    expect(campaignProgress(199999, 200000)?.percent).toBe(99);
  });

  it('is reached exactly at the target', () => {
    expect(campaignProgress(200000, 200000)).toEqual({ percent: 100, fraction: 1, reached: true, beaten: false });
  });

  it('caps the bar when the target is beaten, and keeps the real percentage', () => {
    expect(campaignProgress(216000, 200000)).toEqual({ percent: 108, fraction: 1, reached: false, beaten: true });
  });

  it('starts empty', () => {
    expect(campaignProgress(0, 50000)).toEqual({ percent: 0, fraction: 0, reached: false, beaten: false });
  });

  it('has no progress at all without a target', () => {
    expect(campaignProgress(125000, undefined)).toBeUndefined();
  });
});

describe('barValueText and targetNote', () => {
  it('gives the bar its value in words (FR-061)', () => {
    expect(barValueText(125000, 200000, campaignProgress(125000, 200000)!)).toBe('£1,250 of £2,000, 62%');
  });

  it('says nothing below the target, or without one', () => {
    expect(targetNote(campaignProgress(199999, 200000))).toBeUndefined();
    expect(targetNote(undefined)).toBeUndefined();
  });

  it('celebrates the target with the percentage', () => {
    expect(targetNote(campaignProgress(200000, 200000))).toBe('Target reached: 100%');
    expect(targetNote(campaignProgress(216000, 200000))).toBe('Target beaten: 108%');
  });
});

describe('supportersText', () => {
  it.each([
    [0, 'No supporters yet'],
    [1, '1 supporter'],
    [2, '2 supporters'],
    [37, '37 supporters'],
    [1234, '1,234 supporters'],
  ])('%d reads %s', (count, text) => {
    expect(supportersText(count)).toBe(text);
  });
});

describe('isStale (FR-005)', () => {
  const read = '2026-11-10T09:00:00Z';

  it('is fresh at exactly the threshold', () => {
    expect(isStale(read, new Date('2026-11-10T21:00:00Z'), 12)).toBe(false);
  });

  it('is stale a second past it', () => {
    expect(isStale(read, new Date('2026-11-10T21:00:01Z'), 12)).toBe(true);
  });

  it('follows the configured threshold', () => {
    expect(isStale(read, new Date('2026-11-10T15:00:01Z'), 6)).toBe(true);
  });
});
