import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4188',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {})
      }
    }
  ],
  webServer: {
    command: 'node scripts/verification/study-e2e-server.mjs',
    url: 'http://localhost:4188/api/health',
    reuseExistingServer: false,
    timeout: 120000
  }
})
