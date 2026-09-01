import { defineConfig, devices } from "@playwright/test";
import { BASE_PATH } from "./lib/site";

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
    // Origin only. Specs navigate with absolute paths that already carry BASE_PATH;
    // a baseURL with a path would be discarded when resolving those.
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
    // The readiness probe has to hit a page that exists. The app is mounted at
    // BASE_PATH, so the bare root 404s and Playwright would wait out its timeout
    // without ever starting a test.
    url: `http://localhost:3000${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
