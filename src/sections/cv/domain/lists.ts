// Lists for the drill (specs/004-interactive-cv/data-model.md *Derived values* **Lists for the
// drill**): pure. Each theme's changes by start then end, the roles, each thread's changes in time
// order, the next items, and the previous and next item within the list the reader came from.
// Items are anything with an id and parsed dates; next items have no dates and keep file order.
import { monthIndex, type ParsedWhen } from './dates.ts';

export interface Dated {
  id: string;
  when: Pick<ParsedWhen, 'start' | 'end'>;
}

/** Oldest first: by start, then end; equal items keep their order. */
export function byTime<T extends Dated>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => monthIndex(a.item.when.start) - monthIndex(b.item.when.start) || monthIndex(a.item.when.end) - monthIndex(b.item.when.end) || a.index - b.index)
    .map(({ item }) => item);
}

/** A theme's changes, oldest first. */
export const themeList = <T extends Dated & { theme: string }>(changes: readonly T[], theme: string): T[] => byTime(changes.filter((c) => c.theme === theme));

/**
 * A thread's changes in time order, or undefined when fewer than two name it: a thread with one
 * change never forms a list (the import and the build refuse it; this keeps the page safe anyway).
 */
export function threadList<T extends Dated & { thread?: string }>(changes: readonly T[], thread: string): T[] | undefined {
  const list = byTime(changes.filter((c) => c.thread === thread));
  return list.length >= 2 ? list : undefined;
}

export interface Neighbours<T> {
  previous?: T;
  next?: T;
  /** 1-based position in the list. */
  position: number;
  total: number;
}

/** The items before and after `id` in `list`; none at the ends. Throws if `id` isn't in it. */
export function neighbours<T extends { id: string }>(list: readonly T[], id: string): Neighbours<T> {
  const at = list.findIndex((item) => item.id === id);
  if (at === -1) throw new Error(`${id} is not in this list`);
  return { previous: list[at - 1], next: list[at + 1], position: at + 1, total: list.length };
}
