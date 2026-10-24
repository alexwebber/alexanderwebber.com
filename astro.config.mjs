// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import running from './src/sections/running/integration.ts';

// SHELL_PREVIEW=1 adds test-only pages over synthetic data, for the browser and axe checks:
// /shell-preview/, the shared shell's components (tests/a11y/shell.spec.ts), and /race-preview/,
// the races page and race pages over synthetic races, with maps and photos (tests/e2e/races.spec.ts,
// tests/a11y/races.spec.ts; there are no real races yet). Deploy builds never set it.
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
    },
  },
};

export default defineConfig({
  output: 'static',
  site: 'https://alexanderwebber.com',
  trailingSlash: 'always',
  integrations: [sitemap(), running(), ...(process.env.SHELL_PREVIEW === '1' ? [shellPreview] : [])],
  // maplibre-gl (~1.1 MB) is its own chunk, fetched only when a visitor clicks "Load interactive
  // map" on a race page (RaceMap.astro), so its size isn't a page-weight problem.
  vite: { build: { chunkSizeWarningLimit: 1200 } },
});
