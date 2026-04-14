import { test, expect, loginViaModal, dismissSplash } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Chat", () => {
  test("should send and display a message", async ({ loggedInPage: page }) => {
    await page.click('nav a:has-text("Chat")');

    // Should see empty state
    await expect(
      page.locator("text=No messages yet. Start the conversation!"),
    ).toBeVisible();

    // Type and send a message
    await page.fill('input[placeholder="Message..."]', "Hello everyone!");
    await page.click('button[type="submit"]');

    // Message should appear
    await expect(page.locator("text=Hello everyone!")).toBeVisible();
  });

  test("should show sender name on messages", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Chat")');
    await page.fill('input[placeholder="Message..."]', "Test message");
    await page.click('button[type="submit"]');

    // Own messages don't show name (WhatsApp-style), so check via API
    const res = await page.request.get("/api/messages");
    const data = (await res.json()) as {
      messages: { user_name: string; content: string }[];
    };
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].user_name).toBe("just");
    expect(data.messages[0].content).toBe("Test message");
  });

  test("should not allow empty messages", async ({ loggedInPage: page }) => {
    await page.click('nav a:has-text("Chat")');

    // Send button should be disabled with empty input
    const sendBtn = page.locator('button[type="submit"]');
    await expect(sendBtn).toBeDisabled();

    // Type spaces only
    await page.fill('input[placeholder="Message..."]', "   ");
    await expect(sendBtn).toBeDisabled();
  });

  test("message sent by one user is visible to another", async ({
    loggedInPage: page,
    browser,
  }) => {
    // User 1 (just) sends a message
    await page.click('nav a:has-text("Chat")');
    await page.fill('input[placeholder="Message..."]', "Hello from just!");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Hello from just!")).toBeVisible();

    // User 2 (bob) opens chat in a new context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await loginViaModal(page2, "bob", "iglympics2024");
    await page2.click('nav a:has-text("Chat")');

    // Should see the message from just, with sender name shown
    await baseExpect(page2.locator("text=Hello from just!")).toBeVisible();
    await baseExpect(
      page2.locator(".text-accent-light", { hasText: "just" }),
    ).toBeVisible();

    await context2.close();
  });
});

baseTest.describe("Chat (unauthenticated)", () => {
  baseTest("should show chat but not input", async ({ page }) => {
    await page.goto("/chat");
    await dismissSplash(page);
    await baseExpect(
      page.locator("text=Log in to send messages"),
    ).toBeVisible();
    await baseExpect(
      page.locator('input[placeholder="Message..."]'),
    ).not.toBeVisible();
  });
});
