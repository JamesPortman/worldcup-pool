import { test, expect } from "@playwright/test";

// Group-of-8 (standalone quarter-finalists) picks flow against a real database.
// Verifies the new section stays hidden until all 12 group winners are chosen,
// then unlocks, accepts 8 standalone picks, and that those picks persist.
// Runs in CI against an ephemeral Postgres seeded with the 48 teams.
test.describe("Group of 8 picks (DB-backed)", () => {
  test("unlocks after 12 group winners, saves 8 picks, and persists them", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);

    // Create a pool (the creator is signed in via cookie).
    await page.goto("/");
    await page.getByRole("button", { name: /create a pool/i }).click();
    await page.getByLabel(/pool name/i).fill(`G8 ${stamp}`);
    await page.getByLabel(/your display name/i).fill(`G8 ${stamp}`);
    await page.getByRole("button", { name: /^create pool$/i }).click();
    await expect(page).toHaveURL(/\/pools\/[A-Z0-9]{6}$/);

    await page.getByRole("link", { name: /^picks$/i }).click();
    await expect(page.getByRole("heading", { name: /group winners/i })).toBeVisible();

    // The bracket total now includes the extra 8-team round: 12 + 8 + 4 + 2 + 1 = 27.
    await expect(page.getByText(/of 27 picks made/i)).toBeVisible();

    // Group of 8 stays hidden until every group winner is picked.
    const g8heading = page.getByRole("heading", { name: "Group of 8" });
    await expect(g8heading).toHaveCount(0);

    // Pick the first real team in each of the 12 group selects.
    const selects = page.locator("select");
    await expect(selects).toHaveCount(12);
    for (let i = 0; i < 12; i++) {
      const sel = selects.nth(i);
      const value = await sel.locator("option").nth(1).getAttribute("value"); // [0] is the placeholder
      await sel.selectOption(value!);
    }

    // Now the Group of 8 section unlocks.
    await expect(g8heading).toBeVisible();
    await expect(page.getByText(/12 of 27 picks made/i)).toBeVisible();

    // Select 8 quarter-finalists from within the Group of 8 section only.
    const g8section = g8heading.locator("xpath=ancestor::section[1]");
    const g8buttons = g8section.getByRole("button");
    for (let i = 0; i < 8; i++) await g8buttons.nth(i).click();
    await expect(page.getByText(/20 of 27 picks made/i)).toBeVisible();

    // Save, reload, and confirm the 8 standalone picks persisted (still 20/27).
    await page.getByRole("button", { name: /save picks/i }).click();
    await expect(page.getByText(/picks saved/i)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/20 of 27 picks made/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Group of 8" })).toBeVisible();
  });
});
