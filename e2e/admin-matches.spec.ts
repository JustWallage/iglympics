import { test, expect, Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  // Admin is alice@iglympics.nl (set via ADMIN_EMAIL env var)
  await page.fill('input[type="email"]', "alice@iglympics.nl");
  await page.fill('input[type="password"]', "iglympics2024");
  await page.click('button[type="submit"]');
  await expect(page.locator("h1")).toHaveText("Scoreboard");
}

test.describe("Admin Match Submission", () => {
  test("should create a match as admin", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to admin page
    await page.click('a:has-text("Admin")');
    await expect(page.locator("h1")).toHaveText("Submit Match");

    // Fill in match details
    await page.fill('input[placeholder="e.g. Chess, Mario Kart"]', "Chess");

    // Add Alice to Team A and Bob to Team B
    const playerRows = page.locator(
      ".flex.items-center.justify-between.border",
    );
    const aliceRow = playerRows.filter({ hasText: "Alice Johnson" });
    const bobRow = playerRows.filter({ hasText: "Bob Smith" });

    await aliceRow.locator('button:has-text("A")').click();
    await bobRow.locator('button:has-text("B")').click();

    // Select Team A wins
    await page.selectOption("select", "team_a");

    // Submit
    await page.click('button:has-text("Submit Match")');

    // Should show success
    await expect(page.locator(".bg-green-50")).toHaveText("Match created!");
  });

  test("admin link should not be visible for non-admin", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bob@iglympics.nl");
    await page.fill('input[type="password"]', "iglympics2024");
    await page.click('button[type="submit"]');
    await expect(page.locator("h1")).toHaveText("Scoreboard");

    // Admin link should not be visible
    await expect(page.locator('a:has-text("Admin")')).not.toBeVisible();
  });
});
