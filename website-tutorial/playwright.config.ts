import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {timeout: 7000},
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: {width: 1280, height: 1000},
    launchOptions: {
      executablePath: resolve('node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe'),
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3100 --strictPort',
    url: 'http://127.0.0.1:3100/Workday-Khmer-Guide',
    reuseExistingServer: true,
  },
});
