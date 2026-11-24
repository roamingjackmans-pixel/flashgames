import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// The whole loop in a browser: Shoallhell's server (from ../Shoallhell, a throwaway data folder) and this page on
// Vite, with the stand-in game in tests/fixtures/fg-test. npm run test:e2e
export const SERVER_PORT = 3041;
export const PAGE_PORT = 5187;
export const ADMIN = 'e2e-admin';
const data = path.join(os.tmpdir(), `fg-e2e-${Date.now()}`);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  // reduced motion also stops the PLAY button's pulse, which Playwright would wait on forever
  use: { baseURL: `http://localhost:${PAGE_PORT}`, viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `node ../Shoallhell/server/index.js`,
      url: `http://localhost:${SERVER_PORT}/games/shoallhell/api/ping`,
      env: { PORT: String(SERVER_PORT), DATA_DIR: data, FG_ADMIN_TOKEN: ADMIN, FG_TEST_CLOCK: '1' },
      reuseExistingServer: false,
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${PAGE_PORT} --strictPort`,
      url: `http://localhost:${PAGE_PORT}/games/flashgames/`,
      env: { SHOALLHELL_SERVER: `http://localhost:${SERVER_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
