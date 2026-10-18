import { describe, expect, it } from 'vitest';
import { PLOT, dayNumber, linePath, linearScale, monthTicks, niceStep, niceTicks, percent } from '../../src/shared/charts/scales.ts';

describe('linearScale', () => {
  it('maps the domain onto the range, inverted for a y axis', () => {
    const y = linearScale([90, 100], [PLOT, 0]);
    expect(y(90)).toBe(1000);
    expect(y(100)).toBe(0);
    expect(y(95)).toBe(500);
  });

  it('puts everything mid-range for a zero-width domain', () => {
    expect(linearScale([5, 5], [0, 1000])(5)).toBe(500);
  });
});

describe('niceStep and niceTicks', () => {
  it('picks 1, 2, 2.5 or 5 x 10^n', () => {
    expect(niceStep(10, 4)).toBe(2.5);
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(0.3, 4)).toBe(0.1);
  });

  it('hugs the data for trends and rounds out to clean ticks', () => {
    const t = niceTicks(98.3, 101.2);
    expect(t.domain).toEqual([98, 102]);
    expect(t.values[0]).toBe(98);
    expect(t.values).toEqual([98, 99, 100, 101, 102]);
    expect(t.values.every((v) => Number.isFinite(v) && String(v).length < 6)).toBe(true);
  });

  it('keeps zero for bars', () => {
    expect(niceTicks(12, 47, { zero: true }).domain[0]).toBe(0);
  });

  it('pads a flat series so the line sits mid-plot', () => {
    const t = niceTicks(50, 50);
    expect(t.domain[0]).toBeLessThan(50);
    expect(t.domain[1]).toBeGreaterThan(50);
  });

  it('has no floating-point noise', () => {
    for (const v of niceTicks(0.1, 0.7).values) expect(String(v)).toMatch(/^\d+(\.\d)?$/);
  });
});

describe('dates', () => {
  it('numbers days', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2027-04-04') - dayNumber('2026-10-17')).toBe(169);
  });

  it('labels month starts inside the range, thinned', () => {
    const ticks = monthTicks('2025-10-18', '2026-10-17');
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(ticks[0]).toEqual({ date: '2025-11-01', label: 'Nov 2025' });
    expect(ticks.every((t) => t.date >= '2025-10-18' && t.date <= '2026-10-17')).toBe(true);
  });

  it('labels the end dates of a short range', () => {
    expect(monthTicks('2026-10-03', '2026-10-17')).toEqual([
      { date: '2026-10-03', label: '3 Oct' },
      { date: '2026-10-17', label: '17 Oct' },
    ]);
  });
});

describe('linePath', () => {
  const x = linearScale([0, 2], [0, 1000]);
  const y = linearScale([0, 10], [1000, 0]);

  it('draws through the points', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: 10 }], x, y)).toBe('M0 1000L500 500L1000 0');
  });

  it('breaks the line at gaps instead of drawing zero', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: null }, { x: 2, y: 10 }], x, y)).toBe('M0 1000M1000 0');
  });
});

it('percent converts plot units', () => {
  expect(percent(250)).toBe('25%');
  expect(percent(333.333)).toBe('33.33%');
});
