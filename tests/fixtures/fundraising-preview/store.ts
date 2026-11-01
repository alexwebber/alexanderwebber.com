// The fundraising preview's stores (SHELL_PREVIEW=1 builds only; see generate.ts): one over each
// synthetic state's data tree, validated against the repository's schemas like the real data, with
// "today" and the clock pinned so the states don't drift. Paths resolve from the repo root, where
// builds and tests run.
import { resolve } from 'node:path';
import { JsonFileStore } from '../../../src/sections/running/data/store/index.ts';

export const PREVIEW_TODAY = '2026-11-10';
export const PREVIEW_NOW = new Date('2026-11-10T12:00:00Z');
export const PREVIEW_STATES = ['active', 'first-day', 'no-target', 'zero', 'beaten', 'stale', 'second-campaign', 'no-current'] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

const stores = new Map(PREVIEW_STATES.map((state) => [state, new JsonFileStore(resolve(`tests/fixtures/fundraising-preview/data/${state}`), process.cwd())]));

export const previewStore = (state: PreviewState): JsonFileStore => stores.get(state)!;
