// ビルドの設定（vite.config.ts の define）と、CSS の読み込みの型
declare const __SINGLE__: boolean;   // 1ファイル版（npm run page）のときだけ true
declare module '*.css?inline' { const css: string; export default css; }
declare module '*.css';
