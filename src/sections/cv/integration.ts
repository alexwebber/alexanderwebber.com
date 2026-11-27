// The CV section's Astro integration (specs/004-interactive-cv/research.md R1; contracts/routes.md).
// The CV exists only once data/cv/page.yaml does, checked from files while the config loads
// (cvExists), so no visitor can reach an empty page and nothing about the CV shows before the content
// PR: /cv/ is injected only then. The build's first hook loads CvStore, so a bad or unapproved file
// stops the build before Astro empties dist/.
import type { AstroIntegration } from 'astro';
import { CvStore, cvExists } from './data/store/index.ts';

export { cvExists };

export default function cv(): AstroIntegration {
  return {
    name: 'alexanderwebber:cv',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (cvExists()) injectRoute({ pattern: '/cv', entrypoint: './src/sections/cv/pages/cv.astro' });
      },
      'astro:build:start': async () => {
        if (cvExists()) new CvStore().load();
      },
    },
  };
}
