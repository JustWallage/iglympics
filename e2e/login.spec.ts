import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toHaveText("Iglympics");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "alice@iglympics.nl");
    await page.fill('input[type="password"]', "iglympics2024");
    await page.click('button[type="submit"]');

    // Should redirect to scoreboard
    await expect(page.locator("h1")).toHaveText("Scoreboard");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "alice@iglympics.nl");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator(".bg-red-50")).toHaveText("Invalid credentials");
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
