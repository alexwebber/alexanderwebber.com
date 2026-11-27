// Lists for the drill (spec 004 T044, T058; data-model.md *Derived values* **Lists for the drill**):
// orders, neighbours at the ends, and a one-change thread forming no list.
import { describe, expect, it } from 'vitest';
import { byTime, neighbours, themeList, threadList } from '../../src/sections/cv/domain/lists.ts';

const item = (id: string, start: [number, number], end: [number, number], theme = 'a', thread?: string) => ({
  id,
  theme,
  thread,
  when: { start: { year: start[0], month: start[1] }, end: { year: end[0], month: end[1] } },
});

const ITEMS = [
  item('late', [2020, 1], [2020, 12]),
  item('long', [2010, 1], [2016, 12], 'a', 't'),
  item('short', [2010, 1], [2010, 12], 'b', 't'),
  item('tie-1', [2014, 1], [2014, 12], 'a'),
  item('tie-2', [2014, 1], [2014, 12], 'a', 'u'),
];

describe('lists', () => {
  it('orders by start, then end, keeping ties in file order', () => {
    expect(byTime(ITEMS).map((i) => i.id)).toEqual(['short', 'long', 'tie-1', 'tie-2', 'late']);
  });

  it("gives a theme's changes oldest first", () => {
    expect(themeList(ITEMS, 'a').map((i) => i.id)).toEqual(['long', 'tie-1', 'tie-2', 'late']);
    expect(themeList(ITEMS, 'none')).toEqual([]);
  });

  it("gives a thread's changes in time order, across themes", () => {
    expect(threadList(ITEMS, 't')!.map((i) => i.id)).toEqual(['short', 'long']);
  });

  it('forms no list from a thread with one change, or none', () => {
    expect(threadList(ITEMS, 'u')).toBeUndefined();
    expect(threadList(ITEMS, 'nothing')).toBeUndefined();
  });

  it('gives previous and next within the list, none at the ends', () => {
    const list = themeList(ITEMS, 'a');
    expect(neighbours(list, 'long')).toMatchObject({ previous: undefined, next: { id: 'tie-1' }, position: 1, total: 4 });
    expect(neighbours(list, 'tie-1')).toMatchObject({ previous: { id: 'long' }, next: { id: 'tie-2' }, position: 2 });
    expect(neighbours(list, 'late')).toMatchObject({ previous: { id: 'tie-2' }, next: undefined, position: 4 });
    expect(neighbours([{ id: 'only' }], 'only')).toEqual({ previous: undefined, next: undefined, position: 1, total: 1 });
    expect(() => neighbours(list, 'short')).toThrow();
  });
});
