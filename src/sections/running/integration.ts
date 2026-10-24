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
  /** One line for the landing page's links to the area (SectionLinks). */
  description?: string;
  /** false: the area has no entry in the section nav or the landing links. */
  inNav?: boolean;
  /** Routes the area owns: Astro route pattern -> page entrypoint. */
  routes: { pattern: string; entrypoint: string }[];
}

/** The route registry, in nav order. Each user story adds its area when it ships. */
export const runningAreas: readonly RunningArea[] = [
  {
    key: 'landing',
    label: 'Overview',
    href: '/running/',
    routes: [
      { pattern: '/running', entrypoint: './src/sections/running/pages/index.astro' },
      { pattern: '/og/running.png', entrypoint: './src/sections/running/og/landing.ts' },
    ],
  },
  {
    key: 'goals',
    label: 'Goals',
    href: '/running/goals/',
    description: 'Everything Alex is working towards, and what he has achieved.',
    routes: [
      { pattern: '/running/goals', entrypoint: './src/sections/running/pages/goals.astro' },
      { pattern: '/og/running-goals.png', entrypoint: './src/sections/running/og/goals.png.ts' },
    ],
  },
  {
    key: 'training',
    label: 'Training',
    href: '/running/training/',
    description: 'Weekly, monthly and yearly totals, and every run in detail.',
    routes: [
      { pattern: '/running/training', entrypoint: './src/sections/running/pages/training.astro' },
      { pattern: '/running/training/[year]', entrypoint: './src/sections/running/pages/training/[year].astro' },
      // Run pages (US1's minimal page, T102, extended by T121) belong to Training since US3.
      { pattern: '/running/runs/[id]', entrypoint: './src/sections/running/pages/runs/[id].astro' },
      { pattern: '/og/running-training.png', entrypoint: './src/sections/running/og/training.png.ts' },
      { pattern: '/og/running-year.png', entrypoint: './src/sections/running/og/year.png.ts' },
      { pattern: '/og/running-run.png', entrypoint: './src/sections/running/og/run.png.ts' },
    ],
  },
  {
    key: 'races',
    label: 'Races',
    href: '/running/races/',
    description: 'Upcoming races, personal bests and race results.',
    routes: [
      { pattern: '/running/races', entrypoint: './src/sections/running/pages/races.astro' },
      { pattern: '/running/races/[slug]', entrypoint: './src/sections/running/pages/races/[slug].astro' },
      { pattern: '/running/races/[slug]/route.json', entrypoint: './src/sections/running/pages/races/route.json.ts' },
      { pattern: '/og/running-races.png', entrypoint: './src/sections/running/og/races.png.ts' },
      { pattern: '/og/running-races-[slug].png', entrypoint: './src/sections/running/og/race.ts' },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    href: '/running/health/',
    description: "Weight, body fat, VO2 max, Garmin's race predictions, fitness and heart rate.",
    routes: [
      { pattern: '/running/health', entrypoint: './src/sections/running/pages/health.astro' },
      { pattern: '/og/running-health.png', entrypoint: './src/sections/running/og/health.png.ts' },
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
