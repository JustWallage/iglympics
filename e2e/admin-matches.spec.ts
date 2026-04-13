import { test, expect } from "./fixtures";
import { loginViaModal } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Admin Settings", () => {
  test("should show and update thresholds", async ({ loggedInPage: page }) => {
    await page.click('nav a:has-text("Admin")');
    await expect(page.locator("h1")).toHaveText("Settings");

    // Should show default thresholds
    const confirmInput = page.locator('input[type="number"]').first();
    const rejectInput = page.locator('input[type="number"]').nth(1);
    await expect(confirmInput).toHaveValue("4");
    await expect(rejectInput).toHaveValue("8");

    // Update thresholds
    await confirmInput.fill("5");
    await rejectInput.fill("10");
    await page.click('button:has-text("Save Settings")');

    await expect(page.locator(".text-emerald-400")).toHaveText(
      "Settings saved!",
    );
  });
});

baseTest.describe("Admin access control", () => {
  baseTest(
    "admin link should not be visible for non-admin",
    async ({ page }) => {
      await page.goto("/");
      await loginViaModal(page, "bob", "iglympics2024");

      await baseExpect(
        page.locator('nav a:has-text("Admin")'),
      ).not.toBeVisible();
    },
  );
});
