import { test as base, expect, Page } from "@playwright/test";

async function loginViaModal(page: Page, name: string, password: string) {
  await page.click('button:has-text("Login")');
  await page.fill('#modal-name', name);
  await page.fill('#modal-password', password);
  await page.click('button:has-text("Sign in")');
  // Wait for modal to close and user to be logged in
  await expect(page.locator('#modal-name')).not.toBeVisible({ timeout: 5000 });
}

type Fixtures = {
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    // Reset test data before each test
    await page.request.post("/api/test/reset");

    // Go to scoreboard and login via modal
    await page.goto("/");
    await loginViaModal(page, "just", "iglympics2024");

    await use(page);
  },
});

export { expect, loginViaModal };
