import { defineConfig } from 'vitest/config';

// Unit tests only; the browser tests in tests/e2e run with Playwright (npm run test:e2e).
export default defineConfig({
  define: { __GAME_VERSION__: JSON.stringify('test') },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
