import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 4000);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'cmd /c "npm.cmd run build && set NODE_ENV=development && set ALLOW_INSECURE_COOKIES=true && npm.cmd run start"',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});