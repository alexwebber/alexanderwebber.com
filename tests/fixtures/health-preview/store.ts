// The health preview's store (SHELL_PREVIEW=1 builds only; see generate.ts): the synthetic data
// tree beside this file, validated against the repository's schemas like the real data, with
// "today" pinned so the ranges don't drift. Paths resolve from the repo root, where builds and
// tests run.
import { resolve } from 'node:path';
import { JsonFileStore } from '../../../src/sections/running/data/store/index.ts';

export const PREVIEW_TODAY = '2026-10-24';
export const previewStore = new JsonFileStore(resolve('tests/fixtures/health-preview'), process.cwd());
