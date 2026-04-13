import { test, expect } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Matches Page", () => {
  test("should show matches page after creating a match", async ({
    loggedInPage: page,
  }) => {
    // First create a match via admin
    await page.click('nav a:has-text("Admin")');
    await expect(page.locator("h1")).toHaveText("Submit Match");

    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Chess");

    const playerRows = page.locator(".flex.items-center.justify-between");
    const aliceRow = playerRows.filter({ hasText: "alice" });
    const bobRow = playerRows.filter({ hasText: "bob" });

    await aliceRow.locator('button:has-text("A")').click();
    await bobRow.locator('button:has-text("B")').click();
    await page.selectOption("select", "team_a");
    await page.click('button:has-text("Submit Match")');
    await expect(page.locator("form .text-emerald-400")).toHaveText(
      "Match created!",
    );

    // Navigate to Matches page
    await page.click('nav a:has-text("Matches")');
    await expect(page.locator("h1")).toHaveText("Matches");

    // Should show the match we just created
    await expect(page.locator("text=Chess")).toBeVisible();
    await expect(page.locator("text=alice")).toBeVisible();
    await expect(page.locator("text=bob")).toBeVisible();
  });

  test("should open match detail modal", async ({ loggedInPage: page }) => {
    // Create a match first
    await page.click('nav a:has-text("Admin")');
    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Poker");

    const playerRows = page.locator(".flex.items-center.justify-between");
    await playerRows
      .filter({ hasText: "alice" })
      .locator('button:has-text("A")')
      .click();
    await playerRows
      .filter({ hasText: "bob" })
      .locator('button:has-text("B")')
      .click();
    await page.selectOption("select", "team_b");
    await page.click('button:has-text("Submit Match")');
    await expect(page.locator("form .text-emerald-400")).toBeVisible();

    // Go to Matches and click the match
    await page.click('nav a:has-text("Matches")');
    await page.locator("text=Poker").click();

    // Modal should show full details
    await expect(page.locator("h2:has-text('Poker')")).toBeVisible();
    await expect(page.locator("text=Team A")).toBeVisible();
    await expect(page.locator("text=Team B")).toBeVisible();
  });
});

baseTest.describe("Matches Page (unauthenticated)", () => {
  baseTest("should show matches page without login", async ({ page }) => {
    await page.goto("/matches");
    await baseExpect(page.locator("h1")).toHaveText("Matches");
  });
});
