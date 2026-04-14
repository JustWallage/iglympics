import { test as base, expect, Page } from "@playwright/test";

async function dismissSplash(page: Page) {
  const enterBtn = page.locator('button:has-text("Enter")');
  if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enterBtn.click();
    await expect(enterBtn).not.toBeVisible({ timeout: 2000 });
  }
}

async function loginViaModal(page: Page, name: string, password: string) {
  await dismissSplash(page);
  await page.click('button:has-text("Login")');
  await page.fill("#modal-name", name);
  await page.fill("#modal-password", password);
  await page.click('button:has-text("Sign in")');
  // Wait for modal to close and user to be logged in
  await expect(page.locator("#modal-name")).not.toBeVisible({ timeout: 5000 });
}

type Fixtures = {
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    // Reset test data before each test
    await page.request.post("/api/test/reset");

    // Go to home and login via modal
    await page.goto("/");
    await loginViaModal(page, "just", "iglympics2024");

    await use(page);
  },
});

export { expect, loginViaModal, dismissSplash };
