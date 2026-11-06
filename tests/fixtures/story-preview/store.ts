// The journey story preview's stores (SHELL_PREVIEW=1 builds only; see generate.ts): one over each
// made-up state's data tree, validated against the repository's schemas like the real data, with
// "today" pinned so the states don't drift. Paths resolve from the repo root, where builds and tests
// run. The states' photos are imported for astro:assets in [state].astro: import.meta.glob is Vite's,
// and the Playwright specs import this file too.
import { resolve } from 'node:path';
import { JsonFileStore } from '../../../src/sections/running/data/store/index.ts';

export const PREVIEW_TODAY = '2026-11-10';
export const PREVIEW_STATES = ['one-chapter', 'three-chapters', 'long', 'figures', 'no-closing', 'same-day', 'four-chapters', 'photos'] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

/** A state's data root (holding data/running/). */
export const previewRoot = (state: PreviewState) => resolve(`tests/fixtures/story-preview/data/${state}`);

const stores = new Map(PREVIEW_STATES.map((state) => [state, new JsonFileStore(previewRoot(state), process.cwd())]));

export const previewStore = (state: PreviewState): JsonFileStore => stores.get(state)!;

/** Where a state's chapter folders sit among the photos' root-relative paths ([state].astro). */
export const previewPhotoFolder = (state: PreviewState) => `/tests/fixtures/story-preview/data/${state}/data/running/owner/journey/chapters`;
