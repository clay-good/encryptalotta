import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8765',
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Emulate reduced-motion globally so axe-core measures final-state colors,
    // not partial-opacity values from fadeIn animations. Real users with
    // prefers-reduced-motion: reduce see exactly this rendering.
    reducedMotion: 'reduce',
    colorScheme: 'light',
  },
  webServer: {
    command: 'python3 -m http.server 8765 --directory ..',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 20_000,
  },
});
