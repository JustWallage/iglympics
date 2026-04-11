import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = isCI ? process.env.E2E_BASE_URL : "http://localhost:5173";
if (!baseURL) throw new Error("E2E_BASE_URL must be set in CI environment");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry" /* https://playwright.dev/docs/trace-viewer */,
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
