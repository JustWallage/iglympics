import { test, expect } from "@playwright/test";
import { loginViaModal } from "./fixtures";

test.describe("Login", () => {
  test("should show scoreboard without login", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Scoreboard");
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });

  test("should show player profile without login", async ({ page }) => {
    await page.goto("/");
    // Click on the first player link in the scoreboard
    await page.locator("table a").first().click();
    // Should see the profile page
    await expect(page.locator("h1")).toBeVisible();
    // Should show "Login to rate" button instead of rating form
    await expect(
      page.locator('button:has-text("Login to rate")'),
    ).toBeVisible();
  });

  test("should login via modal", async ({ page }) => {
    await page.goto("/");
    await loginViaModal(page, "just", "iglympics2024");

    // Should still be on scoreboard, now with user name in nav
    await expect(page.locator("h1")).toHaveText("Scoreboard");
    await expect(
      page.locator("nav").locator('a:has-text("just")'),
    ).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Login")');
    await page.fill("#modal-name", "just");
    await page.fill("#modal-password", "wrongpassword");
    await page.click('button:has-text("Sign in")');

    await expect(page.locator(".bg-red-50")).toHaveText("Invalid credentials");
  });

  test("should persist login across page refresh", async ({ page }) => {
    await page.goto("/");
    await loginViaModal(page, "just", "iglympics2024");
    await expect(
      page.locator("nav").locator('a:has-text("just")'),
    ).toBeVisible();

    await page.reload();

    // Should still be logged in
    await expect(
      page.locator("nav").locator('a:has-text("just")'),
    ).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).not.toBeVisible();
  });
});
