import { test, expect } from "@playwright/test";

// Full-stack flow against a real database (UI → API → Postgres → UI).
// Runs in CI against an ephemeral Postgres service; locally it needs a throwaway
// DB (do NOT point it at production — it writes a pool).
test.describe("create-pool flow (DB-backed)", () => {
  test("create a pool, see the dashboard, picks, and leaderboard", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const poolName = `E2E Pool ${stamp}`;
    const displayName = `E2E ${stamp}`;

    // 1. Create a pool from the home page.
    await page.goto("/");
    await page.getByRole("button", { name: /create a pool/i }).click();
    await page.getByLabel(/pool name/i).fill(poolName);
    await page.getByLabel(/your display name/i).fill(displayName);
    await page.getByRole("button", { name: /^create pool$/i }).click();

    // 2. Redirected to the pool dashboard with the join code + creator listed.
    await expect(page).toHaveURL(/\/pools\/[A-Z0-9]{6}$/);
    await expect(page.getByRole("heading", { name: poolName })).toBeVisible();
    await expect(page.getByText(displayName)).toBeVisible();

    // 3. The picks page renders for the signed-in creator (cookie + DB read).
    await page.getByRole("link", { name: /^picks$/i }).click();
    await expect(page.getByRole("heading", { name: /group winners/i })).toBeVisible();

    // 4. The leaderboard shows the creator (DB read + scoring).
    await page.getByRole("link", { name: /leaderboard/i }).click();
    await expect(page.getByText(displayName)).toBeVisible();
  });
});
