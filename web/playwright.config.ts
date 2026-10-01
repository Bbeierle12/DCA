import { defineConfig, devices } from '@playwright/test';

// Software GL so WebGL works headless and in sandboxes without a GPU.
const glArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: {
    timeout: 20_000
  },
  // One worker: software WebGL is CPU-heavy and parallel runs starve each other.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: glArgs
    }
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }
    }
  ]
});
