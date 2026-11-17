import { defineConfig } from 'vite';

// SINGLE=1 のときは配布用: Phaser を外部(CDN)に出し、自分のコードを1ファイルにまとめる
const single = !!process.env.SINGLE;
export default defineConfig({
  base: './',   // GitHub Pages のサブフォルダでも動くように相対パスにする
  define: { __SINGLE__: JSON.stringify(single) },   // 1ファイル版では書体を読まない（src/main.ts）
  build: single
    ? { outDir: 'dist-single', lib: { entry: 'src/main.ts', formats: ['iife'], name: 'ChainBattle', fileName: () => 'game.js' },
        rollupOptions: { external: ['phaser'], output: { globals: { phaser: 'Phaser' } } } }
    : { outDir: 'dist', chunkSizeWarningLimit: 4000 },
  server: { port: 5173 },
});
