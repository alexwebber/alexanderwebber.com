// The CV preview's stores (SHELL_PREVIEW=1 builds only; see generate.ts): one CvStore over each
// made-up state's data tree, validated against the repository's schemas like real data. Paths resolve
// from the repo root, where builds and tests run. No import.meta.glob: Playwright specs and plain
// Node import this file too.
import { resolve } from 'node:path';
import { CvStore } from '../../../src/sections/cv/data/store/index.ts';

export const PREVIEW_STATES = ['typical', 'stress', 'minimal', 'unlisted-off'] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

/** A state's data root (holding data/cv/). */
export const previewRoot = (state: PreviewState) => resolve(`tests/fixtures/cv-preview/data/${state}`);

const stores = new Map(PREVIEW_STATES.map((state) => [state, new CvStore(previewRoot(state), process.cwd())]));

export const previewStore = (state: PreviewState): CvStore => stores.get(state)!;
