// The one memo every Running data loader uses: a result is kept per store (and per day, for
// loaders dated by `today`), so a build reads and sums thousands of runs once, not once per page.
// A test or a test-only preview that passes its own store gets its own results, so nothing needs
// clearing.
import type { RunningStore } from './store/index.ts';

/** `load` once per store. */
export function perStore<T>(load: (store: RunningStore) => T): (store: RunningStore) => T {
  const cache = new WeakMap<RunningStore, T>();
  return (store) => {
    if (!cache.has(store)) cache.set(store, load(store));
    return cache.get(store)!;
  };
}

/** `load` once per store and day. */
export function perStoreAndDay<T>(load: (today: string, store: RunningStore) => T): (today: string, store: RunningStore) => T {
  const days = perStore(() => new Map<string, T>());
  return (today, store) => {
    const byDay = days(store);
    if (!byDay.has(today)) byDay.set(today, load(today, store));
    return byDay.get(today)!;
  };
}
