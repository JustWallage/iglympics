import { test, expect, dismissSplash } from "./fixtures";
import { test as baseTest } from "@playwright/test";

test.describe("Schedule", () => {
  test("admin should create and see a released activity", async ({
    loggedInPage: page,
  }) => {
    // Create an activity via admin
    await page.click('nav a:has-text("Admin")');
    await page.click('button:has-text("Add")');
    await expect(page.locator("h2:has-text('New Activity')")).toBeVisible();

    await page.fill('input[placeholder="Activity title"]', "Beach Volleyball");
    await page.fill('input[type="date"]', "2025-07-20");
    await page.fill('input[type="time"]', "14:00");
    // No release_at = immediately visible
    await page.click('button:has-text("Create Activity")');

    // Verify it appears in admin list
    await expect(page.locator("text=Beach Volleyball")).toBeVisible();

    // Navigate to schedule and verify
    await page.click('nav a:has-text("Schedule")');
    await expect(page.locator("text=Beach Volleyball")).toBeVisible();
  });

  test("unreleased activity shows blurred card", async ({
    loggedInPage: page,
  }) => {
    // Create activity with future release
    await page.click('nav a:has-text("Admin")');
    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="Activity title"]', "Secret Event");
    await page.fill('input[type="datetime-local"]', "2099-12-31T23:59");
    await page.click('button:has-text("Create Activity")');

    // Go to schedule
    await page.click('nav a:has-text("Schedule")');

    // Should show "Coming soon" but not the title
    await expect(page.locator("text=Coming soon")).toBeVisible();
    await expect(page.locator("text=Secret Event")).not.toBeVisible();
  });
});

baseTest.describe("Schedule (unauthenticated)", () => {
  baseTest("should show schedule page without login", async ({ page }) => {
    await page.goto("/schedule");
    await dismissSplash(page);
    await expect(
      page.locator("h1", { hasText: "Schedule" }).first(),
    ).toBeVisible();
  });
});
