import { defineConfig, devices } from '@playwright/test';

const port = 4321;

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'a11y/**/*.spec.ts'],
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
