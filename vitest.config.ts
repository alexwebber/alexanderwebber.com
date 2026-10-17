/// <reference types="vitest/config" />
// getViteConfig adds Astro's Vite plugins, so tests can render .astro components with the
// container API (tests/unit/shell-components.test.ts).
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/contract/**/*.test.ts'],
    passWithNoTests: true,
  },
});
