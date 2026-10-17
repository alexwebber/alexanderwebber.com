import type { AstroIntegration } from 'astro';

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

/** The route registry. Empty until US1/US2 ship. */
export const runningAreas: readonly RunningArea[] = [];

/** Shipped areas in nav order; the section nav and landing links read this. */
export function shippedAreas(): readonly RunningArea[] {
  return runningAreas;
}

/** The Running section's Astro integration: injects every shipped area's routes. */
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
    },
  };
}
