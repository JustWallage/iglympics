import { test as base, expect, Page } from "@playwright/test";

type Fixtures = {
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    // Reset test data before each test
    await page.request.post("/api/test/reset");

    // Login as "just" (admin)
    await page.goto("/login");
    await page.fill('input[type="text"]', "just");
    await page.fill('input[type="password"]', "iglympics2024");
    await page.click('button[type="submit"]');
    await expect(page.locator("h1")).toHaveText("Scoreboard");

    await use(page);
  },
});

export { expect };
