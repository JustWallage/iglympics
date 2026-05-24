import { test, expect, dismissSplash } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

test.describe("Minigames Page (authenticated)", () => {
  test("should navigate to games page and see snake game card", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Games")');
    await expect(page.locator("h1")).toHaveText("Minigames");
    await expect(page.locator("text=Snake")).toBeVisible();
    await expect(page.locator("text=🐍")).toBeVisible();
  });

  test("should open snake game modal with scoreboard and start button", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Games")');

    // Click on the Snake card
    await page.locator("text=Snake").click();
    await expect(page.locator("h2:has-text('Snake')")).toBeVisible();
    await expect(page.locator("text=High Scores")).toBeVisible();
    await expect(page.locator('button:has-text("Start Game")')).toBeVisible();
  });

  test("should start snake game and see score and controls", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Games")');
    await page.locator("text=Snake").click();
    await page.click('button:has-text("Start Game")');

    // Should see score badge and d-pad controls
    await expect(page.locator("text=Score:")).toBeVisible();
    // D-pad arrows should be visible for mobile controls
    await expect(page.locator("button:has(svg.lucide-arrow-up)")).toBeVisible();
    await expect(
      page.locator("button:has(svg.lucide-arrow-down)"),
    ).toBeVisible();
    await expect(
      page.locator("button:has(svg.lucide-arrow-left)"),
    ).toBeVisible();
    await expect(
      page.locator("button:has(svg.lucide-arrow-right)"),
    ).toBeVisible();
  });

  test("should save score after game over", async ({ loggedInPage: page }) => {
    await page.click('nav a:has-text("Games")');
    await page.locator("text=Snake").click();
    await page.click('button:has-text("Start Game")');

    // Drive snake into a wall to trigger game over quickly: go LEFT immediately (opposite won't work, so go UP then LEFT to hit wall)
    await page.keyboard.press("ArrowUp");
    // Wait for game over by repeatedly pressing up to hit the top wall
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(150);
      if (
        await page
          .locator("text=Game Over!")
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
    }

    await expect(page.locator("text=Game Over!")).toBeVisible();
    await expect(page.locator('button:has-text("Play Again")')).toBeVisible();
    await expect(page.locator('button:has-text("Back")')).toBeVisible();
  });

  test("should submit score via API and appear in scoreboard", async ({
    loggedInPage: page,
  }) => {
    // Directly submit a score via API
    const res = await page.request.post("/api/minigame-scores", {
      data: { game: "snake", score: 42 },
    });
    expect(res.ok()).toBe(true);

    // Navigate to games page and check the score appears
    await page.click('nav a:has-text("Games")');
    await expect(page.locator("text=High score: 42")).toBeVisible();

    // Open modal and verify the leaderboard
    await page.locator("text=Snake").click();
    await expect(page.getByText("42", { exact: true })).toBeVisible();
  });

  test("should show global leaderboard with points from high scores", async ({
    loggedInPage: page,
  }) => {
    // Submit scores for the logged-in user
    await page.request.post("/api/minigame-scores", {
      data: { game: "snake", score: 100 },
    });

    await page.click('nav a:has-text("Games")');

    // Expand the global leaderboard
    await page.locator("text=Minigame Champions").click();

    // The logged-in user (just) should appear with 3 points (first place in snake = 3 pts)
    await expect(page.locator("text=3 pts")).toBeVisible();
  });

  test("should open flappy bird game modal and start game", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Games")');
    await expect(page.locator("text=Flappy Bird")).toBeVisible();

    // Click on Flappy Bird card
    await page.locator("text=Flappy Bird").click();
    await expect(page.locator("h2:has-text('Flappy Bird')")).toBeVisible();
    await expect(page.locator("text=High Scores")).toBeVisible();
    await expect(page.locator('button:has-text("Start Game")')).toBeVisible();

    // Start the game
    await page.click('button:has-text("Start Game")');
    await expect(page.locator("text=Score:")).toBeVisible();
    // Tap-to-flap button should be visible
    await expect(page.locator('button:has-text("Tap to flap")')).toBeVisible();
  });

  test("should open lingo game modal and start game", async ({
    loggedInPage: page,
  }) => {
    await page.click('nav a:has-text("Games")');
    await expect(page.locator("text=Lingo")).toBeVisible();

    await page.locator("text=Lingo").click();
    await expect(page.locator("h2:has-text('Lingo')")).toBeVisible();
    await expect(page.locator("text=High Scores")).toBeVisible();
    await expect(page.locator('button:has-text("Start Game")')).toBeVisible();

    await page.click('button:has-text("Start Game")');
    await expect(page.getByText(/^Score: \d+$/)).toBeVisible();
    await expect(page.locator('input[aria-label="Lingo guess"]')).toBeVisible();
    await expect(page.locator('button:has-text("Submit Guess")')).toBeVisible();
  });

  test("should submit lingo score via API and appear in scoreboard", async ({
    loggedInPage: page,
  }) => {
    const res = await page.request.post("/api/minigame-scores", {
      data: { game: "lingo", score: 25 },
    });
    expect(res.ok()).toBe(true);

    await page.click('nav a:has-text("Games")');
    await expect(page.locator("text=High score: 25")).toBeVisible();

    await page.locator("text=Lingo").click();
    await expect(page.getByText("25", { exact: true })).toBeVisible();
  });
});

baseTest.describe("Minigames Page (unauthenticated)", () => {
  baseTest.beforeEach(async ({ page }) => {
    await page.request.post("/api/test/reset");
  });

  baseTest(
    "should show games page without login and display login note",
    async ({ page }) => {
      await page.goto("/games");
      await dismissSplash(page);
      await baseExpect(page.locator("h1")).toHaveText("Minigames");
      await baseExpect(page.locator("text=Snake")).toBeVisible();

      // Open snake modal
      await page.locator("text=Snake").click();
      await baseExpect(
        page.locator('button:has-text("Start Game")'),
      ).toBeVisible();
      await baseExpect(
        page.locator("text=Log in to save your scores"),
      ).toBeVisible();
    },
  );

  baseTest(
    "should show help modal explaining the points system",
    async ({ page }) => {
      await page.goto("/games");
      await dismissSplash(page);

      await page.click('button[aria-label="How minigames work"]');
      await baseExpect(
        page.locator('h2:has-text("How it works")'),
      ).toBeVisible();
      await baseExpect(page.locator("text=3 points")).toBeVisible();
      await baseExpect(page.locator("text=2 points")).toBeVisible();
      await baseExpect(page.locator("text=1 point")).toBeVisible();

      // Close via close button
      await page.getByTestId("games-help-close").click();
      await baseExpect(
        page.locator('h2:has-text("How it works")'),
      ).not.toBeVisible();
    },
  );
});
