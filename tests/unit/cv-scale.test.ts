// The career scale and packing (spec 004 T042, T043, T058; data-model.md *Derived values*): the join
// into the magnified latest year is continuous, a bar crossing it is unbroken, as_of anywhere in its
// year, a CV inside one year, the axis's ticks, zoom's domain; and packing into the fewest rows with
// no two marks in a row overlapping at the minimum width.
import { describe, expect, it } from 'vitest';
import { parseWhen, type YearMonth } from '../../src/sections/cv/domain/dates.ts';
import { extent, GAP, MIN_MARK, pack, type Mark } from '../../src/sections/cv/domain/pack.ts';
import { careerScale, JOIN } from '../../src/sections/cv/domain/scale.ts';

const ym = (year: number, month = 1): YearMonth => ({ year, month });
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

describe('careerScale', () => {
  const scale = careerScale([ym(2016, 5), ym(2006, 3), ym(2020)], ym(2026, 11));

  it("runs from the start of the earliest year to the end of as_of's month", () => {
    expect(scale.start).toEqual(ym(2006));
    expect(scale.x(ym(2006), 'start')).toBe(0);
    expect(scale.x(ym(2026, 11), 'end')).toBe(1);
  });

  it("gives the years before the latest one four fifths, linearly, and the latest year's months the rest", () => {
    expect(scale.x(ym(2026), 'start')).toBeCloseTo(JOIN, 12);
    // 20 years over 0.8: each 0.04.
    expect(scale.x(ym(2007)) - scale.x(ym(2006))).toBeCloseTo(0.04, 12);
    expect(scale.x(ym(2016)) - scale.x(ym(2015))).toBeCloseTo(0.04, 12);
    // 11 months over 0.2.
    expect(scale.x(ym(2026, 2)) - scale.x(ym(2026, 1))).toBeCloseTo(0.2 / 11, 12);
  });

  it('is continuous across the join, so a bar crossing it is one unbroken span', () => {
    expect(scale.x(ym(2025, 12), 'end')).toBeCloseTo(scale.x(ym(2026, 1), 'start'), 12);
    const when = parseWhen('2025–2026 Mar', '2026-11').when!;
    const [x0, x1] = scale.span(when);
    expect(x0).toBeCloseTo(scale.x(ym(2025)), 12);
    expect(x1).toBeCloseTo(scale.x(ym(2026, 3), 'end'), 12);
    expect(x0).toBeLessThan(JOIN);
    expect(x1).toBeGreaterThan(JOIN);
  });

  it('only ever increases, month by month across the whole career', () => {
    let last = -1;
    for (let y = 2006; y <= 2026; y++) {
      for (let m = 1; m <= (y === 2026 ? 11 : 12); m++) {
        const x = scale.x(ym(y, m));
        expect(x).toBeGreaterThan(last);
        last = x;
      }
    }
  });

  it.each([1, 6, 12])('handles as_of in month %i of its year', (month) => {
    const s = careerScale([ym(2010)], ym(2026, month));
    expect(s.x(ym(2026), 'start')).toBeCloseTo(JOIN, 12);
    expect(s.x(ym(2026, month), 'end')).toBe(1);
    expect(s.x(ym(2026, month), 'start')).toBeCloseTo(JOIN + 0.2 * ((month - 1) / month), 12);
    expect(s.ticks().at(-1)).toEqual({ x: 1, label: `${SHORT[month - 1]} 2026`, datetime: `2026-${String(month).padStart(2, '0')}`, kind: 'last' });
  });

  it('spreads a CV inside the latest year over its months alone (a single-change CV)', () => {
    const s = careerScale([ym(2026, 3)], ym(2026, 11));
    expect(s.x(ym(2026), 'start')).toBe(0);
    expect(s.x(ym(2026, 11), 'end')).toBe(1);
    expect(s.x(ym(2026, 2))).toBeCloseTo(1 / 11, 12);
    expect(s.ticks().map((t) => t.label)).toEqual(['Jan 2026', 'Nov 2026']);
    expect(careerScale([], ym(2026, 1)).ticks().map((t) => t.label)).toEqual(['Jan 2026']);
  });

  it("ticks the first year, a middle year, the latest year and as_of's month", () => {
    expect(scale.ticks().map((t) => [t.kind, t.label, t.datetime])).toEqual([
      ['first', '2006', '2006'],
      ['middle', '2016', '2016'],
      ['latest', '2026', '2026'],
      ['last', 'Nov 2026', '2026-11'],
    ]);
    expect(scale.ticks()[2]!.x).toBeCloseTo(JOIN, 12);
    // No middle year when there's none between the first and the latest.
    expect(careerScale([ym(2025)], ym(2026, 4)).ticks().map((t) => t.kind)).toEqual(['first', 'latest', 'last']);
  });

  it('zooms to a domain that fills 0..1 and keeps the months magnified inside it', () => {
    const zoom = scale.domain(ym(2024), ym(2026, 11));
    expect(zoom.x(ym(2024))).toBe(0);
    expect(zoom.x(ym(2026, 11), 'end')).toBe(1);
    expect(zoom.x(ym(2026, 2)) - zoom.x(ym(2026, 1))).toBeGreaterThan(zoom.x(ym(2025, 2)) - zoom.x(ym(2025, 1)));
  });
});

describe('pack', () => {
  const period = (id: string, x0: number, x1: number): Mark => ({ id, x0, x1, point: false });
  const point = (id: string, x0: number, x1: number): Mark => ({ id, x0, x1, point: true });

  it("puts marks that don't overlap in one row", () => {
    const packed = pack([period('a', 0, 0.2), period('b', 0.3, 0.5), point('c', 0.6, 0.64)]);
    expect(packed.rows).toBe(1);
    expect(packed.marks.map((m) => m.row)).toEqual([0, 0, 0]);
  });

  it('uses the fewest rows: as many as marks overlap at once', () => {
    const marks = [period('a', 0, 0.5), period('b', 0.1, 0.2), period('c', 0.3, 0.4), period('d', 0.55, 0.9), period('e', 0.6, 0.7)];
    const packed = pack(marks);
    expect(packed.rows).toBe(2);
    // Keeps the input's order in its output.
    expect(packed.marks.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('gives back-to-back periods their own rows, so they read as two', () => {
    expect(pack([period('a', 0, 0.2), period('b', 0.2, 0.4)]).rows).toBe(2);
    expect(pack([period('a', 0, 0.2), period('b', 0.25, 0.4)]).rows).toBe(1);
  });

  it('never lets two marks in a row overlap at the minimum width (many in one year and lane)', () => {
    // Twelve points and short bars inside one year of a 20-year axis (0.04 wide).
    const marks = Array.from({ length: 12 }, (_, i) => (i % 2 ? point(`p${i}`, 0.5, 0.54) : period(`b${i}`, 0.5 + i * 0.002, 0.505 + i * 0.002)));
    const packed = pack(marks);
    for (const a of packed.marks) {
      expect(a.to - a.from).toBeGreaterThanOrEqual(MIN_MARK - 1e-12);
      for (const b of packed.marks) {
        if (a === b || a.row !== b.row) continue;
        expect(a.to + GAP <= b.from + 1e-12 || b.to + GAP <= a.from + 1e-12, `${a.id} and ${b.id} overlap in row ${a.row}`).toBe(true);
      }
    }
    expect(packed.rows).toBe(12);
  });

  it("centres a point's mark on its middle and widens a short period from its start", () => {
    const [from, to] = extent({ x0: 0.5, x1: 0.54, point: true });
    expect(from).toBeCloseTo(0.52 - MIN_MARK / 2, 12);
    expect(to).toBeCloseTo(0.52 + MIN_MARK / 2, 12);
    expect(extent({ x0: 0.5, x1: 0.501, point: false })).toEqual([0.5, 0.5 + MIN_MARK]);
    expect(extent({ x0: 0.1, x1: 0.6, point: false })).toEqual([0.1, 0.6]);
  });

  it('packs nothing into no rows', () => {
    expect(pack([])).toEqual({ marks: [], rows: 0 });
  });
});
