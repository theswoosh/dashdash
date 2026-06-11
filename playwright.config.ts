import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite. Requires a production build first: `pnpm build`.
// The webServer script assembles a prod-like instance (compiled backend
// serving the built SPA) on a throwaway config/data dir under e2e/.runtime.
export default defineConfig({
  testDir: './e2e',
  workers: 1,            // tests share one server + one services.yml
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4317',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: 'http://127.0.0.1:4317/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
