// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import running from './src/sections/running/integration.ts';
import cv from './src/sections/cv/integration.ts';

// SHELL_PREVIEW=1 adds test-only pages over synthetic data, for the browser and axe checks:
// /shell-preview/, the shared shell's components (tests/a11y/shell.spec.ts), and /race-preview/,
// the races page and race pages over synthetic races, with maps and photos (tests/e2e/races.spec.ts,
// tests/a11y/races.spec.ts; there are no real races yet), /health-preview/, the health page over
// synthetic data with lab results (tests/e2e/health.spec.ts, tests/a11y/health.spec.ts; there are
// no real lab results yet), and /fundraising-preview/<state>/, the fundraising page and card over
// synthetic campaigns, in the states the real one can't show yet (tests/e2e/fundraising.spec.ts,
// tests/a11y/fundraising.spec.ts), /story-preview/<state>/, the journey story page over made-up
// chapters, before the real story is in the repo (tests/e2e/story.spec.ts, tests/a11y/story.spec.ts),
// and /cv-preview/<state>/, the CV page over made-up CVs imported from tests/fixtures/cv-export/
// (tests/e2e/cv-phone.spec.ts, tests/e2e/cv-noscript.spec.ts, tests/a11y/cv.spec.ts).
// Deploy builds never set it.
/** @type {import('astro').AstroIntegration} */
const shellPreview = {
  name: 'alexanderwebber:shell-preview',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/shell-preview', entrypoint: './tests/fixtures/shell-preview.astro' });
      const races = './tests/fixtures/race-preview';
      injectRoute({ pattern: '/race-preview', entrypoint: `${races}/index.astro` });
      injectRoute({ pattern: '/race-preview/[slug]', entrypoint: `${races}/[slug].astro` });
      injectRoute({ pattern: '/race-preview/[slug]/route.json', entrypoint: `${races}/route.json.ts` });
      injectRoute({ pattern: '/og/race-preview-[slug].png', entrypoint: `${races}/og.ts` });
      injectRoute({ pattern: '/health-preview', entrypoint: './tests/fixtures/health-preview/index.astro' });
      injectRoute({ pattern: '/fundraising-preview/[state]', entrypoint: './tests/fixtures/fundraising-preview/[state].astro' });
      injectRoute({ pattern: '/story-preview/[state]', entrypoint: './tests/fixtures/story-preview/[state].astro' });
      injectRoute({ pattern: '/cv-preview/[state]', entrypoint: './tests/fixtures/cv-preview/[state].astro' });
    },
  },
};

// Sections: Running, then the CV (spec 004), which adds nothing until data/cv/page.yaml exists
// (its build hook checks the CV's files and approvals before dist/ is emptied).
export default defineConfig({
  output: 'static',
  site: 'https://alexanderwebber.com',
  trailingSlash: 'always',
  integrations: [sitemap(), running(), cv(), ...(process.env.SHELL_PREVIEW === '1' ? [shellPreview] : [])],
  // The CV's fonts (spec 004 research.md R5, R17), self-hosted from the @fontsource packages through
  // the Fonts API's local provider, latin only: Space Grotesk 700 for the name and headings, Inter
  // Tight 400 and 600 for text. Astro generates fallback faces with matched metrics from the last
  // generic fallback (sans-serif). Only pages that render <Font /> (CvPage.astro) load them, and
  // Space Grotesk is the one preloaded.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Space Grotesk',
      cssVariable: '--font-cv-display',
      fallbacks: ['sans-serif'],
      options: { variants: [{ src: ['@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2'], weight: 700, style: 'normal' }] },
    },
    {
      provider: fontProviders.local(),
      name: 'Inter Tight',
      cssVariable: '--font-cv-text',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          { src: ['@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff2'], weight: 400, style: 'normal' },
          { src: ['@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff2'], weight: 600, style: 'normal' },
        ],
      },
    },
  ],
  // maplibre-gl (~1.1 MB) is its own chunk, fetched only when a visitor clicks "Load interactive
  // map" on a race page (RaceMap.astro), so its size isn't a page-weight problem.
  vite: { build: { chunkSizeWarningLimit: 1200 } },
});
