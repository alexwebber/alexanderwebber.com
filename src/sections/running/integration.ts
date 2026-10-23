import type { AstroIntegration } from 'astro';
import { JsonFileStore } from '../../shared/storage/index.ts';

/**
 * One area of the Running section (landing, goals, training, ...). An area is
 * added here when its user story ships; until then nothing links to it, so
 * there are no dead links between increments (FR-027).
 */
export interface RunningArea {
  /** Stable key, e.g. 'landing', 'goals'. */
  key: string;
  /** Section-nav label. */
  label: string;
  /** Canonical URL of the area's hub page (trailing slash). */
  href: string;
  /** Routes the area owns: Astro route pattern -> page entrypoint. */
  routes: { pattern: string; entrypoint: string }[];
}

/** The route registry, in nav order. Each user story adds its area when it ships. */
export const runningAreas: readonly RunningArea[] = [
  {
    key: 'goals',
    label: 'Goals',
    href: '/running/goals/',
    routes: [
      { pattern: '/running/goals', entrypoint: './src/sections/running/pages/goals.astro' },
      { pattern: '/og/running-goals.png', entrypoint: './src/sections/running/og/goals.png.ts' },
    ],
  },
];

/** Shipped areas in nav order; the section nav and landing links read this. */
export function shippedAreas(): readonly RunningArea[] {
  return runningAreas;
}

/**
 * The Running section's Astro integration: injects every shipped area's routes, and validates all
 * Running data when a build starts. Astro empties dist/ before rendering pages, so without the
 * early check a bad owner file (e.g. a goal time of "3:7x") would fail the build only after the
 * previous build was gone. Now it stops the build with the file/entry/field message (FR-070,
 * US2.7) and leaves dist/ untouched.
 */
export default function running(): AstroIntegration {
  return {
    name: 'alexanderwebber:running',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const area of runningAreas) {
          for (const route of area.routes) {
            injectRoute(route);
          }
        }
      },
      'astro:build:start': async () => {
        await new JsonFileStore().getOwner();
      },
    },
  };
}
