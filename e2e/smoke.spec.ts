import { test, expect } from "@playwright/test";

// These hit only the public pages that never touch Prisma/Neon, so they pass
// against a plain `next dev` with no database configured.

test.describe("home page", () => {
  test("shows the hero banner and create/join controls", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /2026 FIFA World Cup Pool/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /create a pool/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /join with code/i })).toBeVisible();
  });

  test("exposes How it works and Architecture in the nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /how it works/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    await expect(page.getByRole("link", { name: /architecture/i })).toHaveAttribute(
      "href",
      "/architecture",
    );
  });
});

test.describe("how it works page", () => {
  test("renders the scoring explanation", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { name: /how it works/i })).toBeVisible();
    await expect(page.getByText(/Group Winners/i).first()).toBeVisible();
    await expect(page.getByText(/Winner/).first()).toBeVisible();
  });
});

test.describe("architecture page", () => {
  test("renders the architecture overview for developers", async ({ page }) => {
    await page.goto("/architecture");
    await expect(
      page.getByRole("heading", { name: /architecture/i }).first(),
    ).toBeVisible();
    // The system diagram and at least one deep-dive section should be present.
    await expect(page.getByText(/Neon/i).first()).toBeVisible();
    await expect(page.getByText(/Prisma/i).first()).toBeVisible();
    await expect(page.getByText(/data model/i).first()).toBeVisible();
  });
});
