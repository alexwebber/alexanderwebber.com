// The race preview's store (SHELL_PREVIEW=1 builds only; see generate.ts): the synthetic data tree
// beside this file, validated against the repository's schemas like the real data, and "today"
// pinned so the countdowns and "New" highlights don't drift. Paths resolve from the repo root,
// where builds and tests run.
import { resolve } from 'node:path';
import type { ImageMetadata } from 'astro';
import { JsonFileStore } from '../../../src/sections/running/data/store/index.ts';

export const PREVIEW_TODAY = '2026-10-24';
export const previewStore = new JsonFileStore(resolve('tests/fixtures/race-preview'), process.cwd());
export const PREVIEW_PHOTO_FOLDER = '/tests/fixtures/race-preview/data/running/owner/races';
export const PREVIEW_PHOTOS = import.meta.glob<ImageMetadata>('/tests/fixtures/race-preview/data/running/owner/races/*/*.{jpg,webp,avif}', { eager: true, import: 'default' });
export const previewRaceHref = (slug: string) => `/race-preview/${slug}/`;
/** Synthetic runs have no run pages. */
export const noRunPage = () => undefined;
