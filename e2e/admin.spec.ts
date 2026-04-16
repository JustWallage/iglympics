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

test.describe("Admin Activity Deletion", () => {
  async function createActivity(page: import("@playwright/test").Page) {
    await page.click('nav a:has-text("Admin")');
    await expect(page.locator("h1")).toHaveText("Settings");

    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="Activity title"]', "Test Activity");
    await page.click('button:has-text("Create Activity")');
    await expect(page.locator("text=Test Activity")).toBeVisible();
  }

  test("should show confirmation dialog when clicking delete", async ({
    loggedInPage: page,
  }) => {
    await createActivity(page);

    // Click the delete button (Trash2 icon)
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click();

    // Confirmation dialog should appear
    await expect(page.locator("text=Delete Activity")).toBeVisible();
    await expect(
      page.locator("text=Are you sure? This action cannot be undone."),
    ).toBeVisible();
    await expect(page.getByTestId("confirm-delete")).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test("should cancel deletion when clicking cancel", async ({
    loggedInPage: page,
  }) => {
    await createActivity(page);

    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click();
    await expect(page.getByTestId("confirm-delete")).toBeVisible();

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Dialog should close and activity should still exist
    await expect(page.getByTestId("confirm-delete")).not.toBeVisible();
    await expect(page.locator("text=Test Activity")).toBeVisible();
  });

  test("should delete activity when confirming", async ({
    loggedInPage: page,
  }) => {
    await createActivity(page);

    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click();
    await expect(page.getByTestId("confirm-delete")).toBeVisible();

    // Confirm deletion
    await page.getByTestId("confirm-delete").click();

    // Dialog should close and activity should be gone
    await expect(page.getByTestId("confirm-delete")).not.toBeVisible();
    await expect(page.locator("text=Test Activity")).not.toBeVisible();
  });

  test("should open edit modal when clicking activity card", async ({
    loggedInPage: page,
  }) => {
    await createActivity(page);

    // Click the activity card itself (not the delete button)
    await page.locator("text=Test Activity").click();

    // Edit modal should appear with pre-filled title
    await expect(
      page.locator('button:has-text("Update Activity")'),
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Activity title"]'),
    ).toHaveValue("Test Activity");
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
