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

    // Should show countdown timer
    await expect(page.getByTestId("countdown")).toBeVisible();
    // Countdown should have time segments (days, hrs, min, sec)
    const countdown = page.getByTestId("countdown");
    await expect(countdown.locator("text=days")).toBeVisible();
    await expect(countdown.locator("text=hrs")).toBeVisible();
    await expect(countdown.locator("text=min")).toBeVisible();
    await expect(countdown.locator("text=sec")).toBeVisible();
  });

  test("activity auto-unblurs when countdown expires", async ({
    loggedInPage: page,
  }) => {
    // Create activity with release_at a few seconds from now via API
    const releaseAt = new Date(Date.now() + 5000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    const response = await page.request.post("/api/activities", {
      data: {
        title: "Surprise Party",
        date: "2025-08-01",
        time: "18:00",
        release_at: releaseAt,
      },
    });
    expect(response.ok()).toBeTruthy();

    // Navigate to schedule page
    await page.click('nav a:has-text("Schedule")');

    // Should initially show blurred "Coming soon" card
    await expect(page.locator("text=Coming soon")).toBeVisible();
    await expect(page.locator("text=Surprise Party")).not.toBeVisible();

    // Wait for the countdown to expire and the activity to auto-unblur
    // (release in ~5s + 1.5s delay for refetch = ~6.5s, use 15s timeout for safety)
    await expect(page.locator("text=Surprise Party")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("text=Coming soon")).not.toBeVisible();
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
