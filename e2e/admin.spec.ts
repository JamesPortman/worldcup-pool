import { test, expect } from "@playwright/test";

// Admin dashboard + locked-pool behaviour against a real database
// (UI → API → Postgres → UI). The /admin page renders nothing sensitive until
// the ADMIN_TOKEN is verified; CI sets ADMIN_TOKEN=test-token for this run.
// Locally this needs a throwaway DB — it creates and locks a pool.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "test-token";

test.describe("admin dashboard (DB-backed)", () => {
  test("token gate, reveals pools, locks one, and the pool goes read-only", async ({ page }) => {
    // Seed a pool so the admin list has a concrete row to act on.
    const stamp = Date.now().toString().slice(-6);
    const poolName = `Admin E2E ${stamp}`;
    const displayName = `Admin ${stamp}`;

    await page.goto("/");
    await page.getByRole("button", { name: /create a pool/i }).click();
    await page.getByLabel(/pool name/i).fill(poolName);
    await page.getByLabel(/your display name/i).fill(displayName);
    await page.getByRole("button", { name: /^create pool$/i }).click();
    await expect(page).toHaveURL(/\/pools\/[A-Z0-9]{6}$/);
    const code = page.url().match(/\/pools\/([A-Z0-9]{6})$/)![1];

    // 1. /admin leaks nothing before the token is verified.
    await page.goto("/admin");
    await expect(page.getByLabel(/admin token/i)).toBeVisible();
    await expect(page.getByText(poolName)).toHaveCount(0);

    // 2. A wrong token reveals nothing and reports the error.
    await page.getByLabel(/admin token/i).fill("wrong-token");
    await page.getByRole("button", { name: /unlock/i }).click();
    await expect(page.getByText(/invalid admin token/i)).toBeVisible();
    await expect(page.getByText(poolName)).toHaveCount(0);

    // 3. The correct token reveals the pool, its join code, and the creator.
    await page.getByLabel(/admin token/i).fill(ADMIN_TOKEN);
    await page.getByRole("button", { name: /unlock/i }).click();
    await expect(page.getByText(poolName)).toBeVisible();
    await expect(page.getByText(code)).toBeVisible();
    await expect(page.getByText(displayName)).toBeVisible();

    // 4. Lock the pool from the admin (writes through /api/admin/results → DB).
    const row = page.locator("li", { hasText: poolName }).first();
    await row.getByRole("button", { name: /^lock picks$/i }).click();
    await expect(row.getByRole("button", { name: /^unlock picks$/i })).toBeVisible();

    // 5. The creator can still VIEW their picks, but the page is now read-only.
    await page.goto(`/pools/${code}/picks`);
    await expect(page.getByText(/picks are locked/i)).toBeVisible();

    // 6. The leaderboard remains viewable while locked.
    await page.goto(`/pools/${code}/leaderboard`);
    await expect(page.getByText(displayName)).toBeVisible();
  });
});
