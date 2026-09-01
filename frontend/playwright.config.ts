import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const isFedoraHost = () => {
  if (process.platform !== "linux") return false;
  try {
    return readFileSync("/etc/os-release", "utf8").includes('ID="fedora"');
  } catch {
    return false;
  }
};

// Playwright validates Ubuntu package names even when its Fedora fallback can
// launch with user-local compatibility libraries. Browser launch still fails
// normally if an actual shared library is absent.
if (isFedoraHost()) {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
