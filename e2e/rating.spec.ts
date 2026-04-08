import { test, expect, Page } from "@playwright/test";

async function loginAsAlice(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "alice@iglympics.nl");
  await page.fill('input[type="password"]', "iglympics2024");
  await page.click('button[type="submit"]');
  await expect(page.locator("h1")).toHaveText("Scoreboard");
}

test.describe("Rating", () => {
  test("should rate another user from their profile", async ({ page }) => {
    await loginAsAlice(page);

    // Navigate to Bob's profile (user 2)
    await page.click('a:has-text("Bob Smith")');
    await expect(page.locator("h1")).toHaveText("Bob Smith");

    // Rate Bob 4 stars
    const stars = page.locator("button:has-text('★')");
    await stars.nth(3).click(); // 4th star
    await page.click('button:has-text("Submit")');

    // Verify rating was updated (avg should now show)
    await expect(page.locator("text=4.00")).toBeVisible({ timeout: 5000 });
  });
});
