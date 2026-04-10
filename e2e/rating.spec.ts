import { test, expect, Page } from "@playwright/test";

async function loginAsJust(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="text"]', "just");
  await page.fill('input[type="password"]', "iglympics2024");
  await page.click('button[type="submit"]');
  await expect(page.locator("h1")).toHaveText("Scoreboard");
}

test.describe("Rating", () => {
  test("should rate another user from their profile", async ({ page }) => {
    await loginAsJust(page);

    // Navigate to bob's profile
    await page.click('a:has-text("bob")');
    await expect(page.locator("h1")).toHaveText("bob");

    // Rate bob 4 stars
    const stars = page.locator("button:has-text('★')");
    await stars.nth(3).click(); // 4th star
    await page.click('button:has-text("Submit")');

    // Verify rating was updated (avg should now show)
    await expect(page.locator("text=4.00")).toBeVisible({ timeout: 5000 });
  });
});
