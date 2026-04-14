import { test, expect, dismissSplash } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Matches Page", () => {
  test("should create a match from matches page", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Matches")');
    await expect(page.locator("h1")).toHaveText("Matches");

    // Open create modal
    await page.click('button:has-text("New Match")');
    await expect(page.locator("h2:has-text('New Match')")).toBeVisible();

    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Chess");

    const playerRows = page.locator(
      ".flex.items-center.justify-between.rounded-xl",
    );
    await playerRows
      .filter({ hasText: "alice" })
      .locator('button:has-text("A")')
      .click();
    await playerRows
      .filter({ hasText: "bob" })
      .locator('button:has-text("B")')
      .click();
    await page.selectOption("select", "team_a");
    await page.click('button:has-text("Create Match")');

    // Modal should close and match should appear
    await expect(page.locator("h2:has-text('New Match')")).not.toBeVisible();
    await expect(page.locator("text=Chess")).toBeVisible();
  });

  test("should show vote buttons and allow voting", async ({
    loggedInPage: page,
  }) => {
    // Create a match
    await page.click('nav a:has-text("Matches")');
    await page.click('button:has-text("New Match")');
    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Poker");

    const playerRows = page.locator(
      ".flex.items-center.justify-between.rounded-xl",
    );
    await playerRows
      .filter({ hasText: "alice" })
      .locator('button:has-text("A")')
      .click();
    await playerRows
      .filter({ hasText: "bob" })
      .locator('button:has-text("B")')
      .click();
    await page.click('button:has-text("Create Match")');
    await expect(page.locator("text=Poker")).toBeVisible();

    // Creator's confirm vote should already be counted
    const confirmBtn = page.locator('button:has-text("Confirm")');
    await expect(confirmBtn).toBeVisible();
    // The creator auto-confirms, so we expect "Confirm (1)"
    await expect(confirmBtn).toHaveText(/Confirm \(1\)/);
  });

  test("should open match detail modal with vote info", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Matches")');
    await page.click('button:has-text("New Match")');
    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Darts");

    const playerRows = page.locator(
      ".flex.items-center.justify-between.rounded-xl",
    );
    await playerRows
      .filter({ hasText: "alice" })
      .locator('button:has-text("A")')
      .click();
    await playerRows
      .filter({ hasText: "bob" })
      .locator('button:has-text("B")')
      .click();
    await page.click('button:has-text("Create Match")');

    // Click on the match card content to open detail modal
    await page.locator("text=Darts").click();
    await expect(page.locator("h2:has-text('Darts')")).toBeVisible();
    await expect(page.locator("text=Team A")).toBeVisible();
    await expect(page.locator("text=Team B")).toBeVisible();
    await expect(page.locator("text=1 confirms")).toBeVisible();
  });
});

baseTest.describe("Matches Page (unauthenticated)", () => {
  baseTest("should show matches page without login", async ({ page }) => {
    await page.goto("/matches");
    await dismissSplash(page);
    await expect(
      page.locator("h1", { hasText: "Matches" }).first(),
    ).toBeVisible();
    // New Match button should not be visible
    await baseExpect(
      page.locator('button:has-text("New Match")'),
    ).not.toBeVisible();
  });
});
