import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests for the public, no-database pages (home, how-it-works,
// architecture) plus navigation wiring. These never hit Prisma/Neon, so they
// run against a plain `next dev` server with no DATABASE_URL required.
//
// Run with `npm run test:e2e` (auto-starts the dev server) after installing the
// browser once: `npx playwright install chromium`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
