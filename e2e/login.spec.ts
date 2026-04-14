import { test, expect } from "@playwright/test";
import { loginViaModal } from "./fixtures";

test.describe("Login", () => {
  test("should show dashboard without login", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Enter")');
    await expect(
      page.locator("h1", { hasText: "Dashboard" }).first(),
    ).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });

  test("should show player profile without login", async ({ page }) => {
    await page.goto("/scoreboard");
    await page.click('button:has-text("Enter")');
    // Click on the first player row in the scoreboard table
    await page.locator("table tbody tr").first().click();
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

    // Should still be on dashboard
    await expect(page.locator("h1")).toHaveText("Dashboard");
    // Bottom nav should show Profile link (only visible when logged in)
    await expect(
      page.locator("nav").locator('a:has-text("Profile")'),
    ).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Enter")');
    await page.click('button:has-text("Login")');
    await page.fill("#modal-name", "just");
    await page.fill("#modal-password", "wrongpassword");
    await page.click('button:has-text("Sign in")');

    await expect(page.locator("form .text-red-400")).toHaveText(
      "Invalid credentials",
    );
  });

  test("should persist login across page refresh", async ({ page }) => {
    await page.goto("/");
    await loginViaModal(page, "just", "iglympics2024");
    await expect(
      page.locator("nav").locator('a:has-text("Profile")'),
    ).toBeVisible();

    await page.reload();
    await page.click('button:has-text("Enter")');

    // Should still be logged in (Profile link visible in bottom nav)
    await expect(
      page.locator("nav").locator('a:has-text("Profile")'),
    ).toBeVisible();
    // Login button should not be visible when logged in
    await expect(
      page.locator('nav button:has-text("Login")'),
    ).not.toBeVisible();
  });
});
