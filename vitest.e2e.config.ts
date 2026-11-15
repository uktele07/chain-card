import { defineConfig } from 'vitest/config';

// 画面を通しで動かす確認（e2e）。先に npm run build で dist/ を作っておくこと。
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/setup.ts'],
    testTimeout: 90_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
