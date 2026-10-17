// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import running from './src/sections/running/integration.ts';

export default defineConfig({
  output: 'static',
  site: 'https://alexanderwebber.com',
  trailingSlash: 'always',
  integrations: [sitemap(), running()],
});
