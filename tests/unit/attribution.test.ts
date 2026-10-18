// Which watches a multi-run view's Garmin attribution names (FR-077, T152).
import { describe, expect, it } from 'vitest';
import { MAX_DEVICES, runDevices } from '../../src/sections/running/domain/attribution.ts';

describe('runDevices', () => {
  it('names each watch once, in the order given (newest first), skipping unknown ones', () => {
    const runs = [{ device: 'Venu X1' }, {}, { device: 'Venu X1' }, { device: 'Venu 2 Plus' }];
    expect(runDevices(runs)).toEqual(['Venu X1', 'Venu 2 Plus']);
  });

  it('falls back to plain Garmin (no names) with no known device or too many', () => {
    expect(runDevices([{}, {}])).toEqual([]);
    const many = Array.from({ length: MAX_DEVICES + 1 }, (_, i) => ({ device: `Model ${i}` }));
    expect(runDevices(many)).toEqual([]);
  });
});
