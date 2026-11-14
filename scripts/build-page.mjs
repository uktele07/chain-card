// 配布用の1ページ（dist-single/chain-battle.html）を作る。使い方: npm run page
import { readFileSync, writeFileSync } from 'node:fs';
const js = readFileSync('dist-single/game.js', 'utf8').replace(/<\/script/g, '<\\/script');
writeFileSync('dist-single/chain-battle.html', `<title>Chain Battle 試作</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* 画面いっぱいに16:9の盤面を1つ置くだけの構成。暗い単一テーマ */
  :root { --bg: #0d1017; --fg: #e6e9ef; color-scheme: dark; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--fg); overflow: hidden; }
  .wrap { height: 100%; box-sizing: border-box; padding-block: 8px;
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  #game { width: 100%; height: 100%; touch-action: none; }
</style>
<div class="wrap"><div id="game"></div></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>
<script>${js}</script>
`);
// 単体で開ける版（Phaserも埋め込み。ダブルクリックでブラウザから開ける）
const esc = t => t.replace(/<\/script/g, '<\\/script');
const phaser = esc(readFileSync('node_modules/phaser/dist/phaser.min.js', 'utf8'));
writeFileSync('dist-single/chain-battle-standalone.html', `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chain Battle 試作</title>
<style>html, body { margin: 0; height: 100%; background: #0d1017; overflow: hidden; } #game { width: 100vw; height: 100vh; }</style>
</head><body><div id="game"></div>
<script>${phaser}</script>
<script>${js}</script>
</body></html>
`);
console.log('dist-single/chain-battle.html', (js.length / 1024).toFixed(0) + 'KB');
