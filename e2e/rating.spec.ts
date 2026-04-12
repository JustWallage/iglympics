import { test, expect } from "./fixtures";

test.describe("Rating", () => {
  test("should rate another user with a note", async ({
    loggedInPage: page,
  }) => {
    // Navigate to bob's profile via scoreboard row
    await page.locator("table tbody tr", { hasText: "bob" }).click();
    await expect(page.locator("h1")).toHaveText("bob");

    // Rate bob 4 stars with a note
    const stars = page.locator("button:has-text('★')");
    await stars.nth(3).click(); // 4th star
    await page.fill("textarea", "Great chess player!");
    await page.click('button:has-text("Submit Rating")');

    // Verify rating appears in the list
    await expect(page.locator("text=Great chess player!")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should require a note to submit rating", async ({
    loggedInPage: page,
  }) => {
    await page.locator("table tbody tr", { hasText: "bob" }).click();
    await expect(page.locator("h1")).toHaveText("bob");

    // Select stars but don't write a note
    const stars = page.locator("button:has-text('★')");
    await stars.nth(2).click(); // 3rd star

    // Submit button should be disabled without a note
    await expect(
      page.locator('button:has-text("Submit Rating")'),
    ).toBeDisabled();
  });

  test("should allow multiple ratings from same user", async ({
    loggedInPage: page,
  }) => {
    await page.locator("table tbody tr", { hasText: "alice" }).click();
    await expect(page.locator("h1")).toHaveText("alice");

    // Submit first rating
    const stars = page.locator("button:has-text('★')");
    await stars.nth(4).click(); // 5 stars
    await page.fill("textarea", "First rating!");
    await page.click('button:has-text("Submit Rating")');
    await expect(page.locator("text=First rating!")).toBeVisible({
      timeout: 5000,
    });

    // Submit second rating — wait for form to reset after first submission
    await expect(page.locator("textarea")).toHaveValue("");
    await stars.nth(2).click(); // 3 stars
    await page.fill("textarea", "Second rating!");
    await page.click('button:has-text("Submit Rating")');
    await expect(page.locator("text=Second rating!")).toBeVisible({
      timeout: 5000,
    });

    // Both ratings should be visible with correct count
    await expect(page.locator("text=First rating!")).toBeVisible();
    await expect(page.locator("text=Second rating!")).toBeVisible();
    await expect(page.locator("text=Ratings (2)")).toBeVisible();
  });
});
