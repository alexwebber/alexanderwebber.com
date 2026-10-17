// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import running from './src/sections/running/integration.ts';

// SHELL_PREVIEW=1 adds /shell-preview/, a page of the shared shell's components over synthetic
// data, for the browser and axe checks in tests/a11y/shell.spec.ts. Deploy builds never set it.
/** @type {import('astro').AstroIntegration} */
const shellPreview = {
  name: 'alexanderwebber:shell-preview',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/shell-preview', entrypoint: './tests/fixtures/shell-preview.astro' });
    },
  },
};

export default defineConfig({
  output: 'static',
  site: 'https://alexanderwebber.com',
  trailingSlash: 'always',
  integrations: [sitemap(), running(), ...(process.env.SHELL_PREVIEW === '1' ? [shellPreview] : [])],
});
