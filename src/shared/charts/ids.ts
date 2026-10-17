// Element ids for charts (aria-labelledby, radio groups). Unique within a build, which covers
// every page; a caller can pass its own stable id instead.
let next = 0;

export function chartId(prefix: string, given?: string): string {
  return given ?? `${prefix}-${(next++).toString(36)}`;
}
