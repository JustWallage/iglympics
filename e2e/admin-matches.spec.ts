import { test, expect } from "./fixtures";
import { loginViaModal } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Admin Match Submission", () => {
  test("should create a match as admin", async ({ loggedInPage: page }) => {
    // Navigate to admin page
    await page.click('a:has-text("Admin")');
    await expect(page.locator("h1")).toHaveText("Submit Match");

    // Fill in match details
    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Chess");

    // Add alice to Team A and bob to Team B
    const playerRows = page.locator(
      ".flex.items-center.justify-between.border",
    );
    const aliceRow = playerRows.filter({ hasText: "alice" });
    const bobRow = playerRows.filter({ hasText: "bob" });

    await aliceRow.locator('button:has-text("A")').click();
    await bobRow.locator('button:has-text("B")').click();

    // Select Team A wins
    await page.selectOption("select", "team_a");

    // Submit
    await page.click('button:has-text("Submit Match")');

    // Should show success
    await expect(page.locator(".bg-green-50")).toHaveText("Match created!");
  });
});

baseTest.describe("Admin access control", () => {
  baseTest(
    "admin link should not be visible for non-admin",
    async ({ page }) => {
      await page.goto("/");
      await loginViaModal(page, "bob", "iglympics2024");

      // Admin link should not be visible
      await baseExpect(
        page.locator('a:has-text("Admin")'),
      ).not.toBeVisible();
    },
  );
});
