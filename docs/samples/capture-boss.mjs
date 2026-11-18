// ボスのマスの見本の下敷きを、実際のゲームから撮る（先に npm run build）。使い方: node docs/samples/capture-boss.mjs
// - bg-board-boss.png: ボスのマスの近くの盤面。ボスのマスの絵は外してある（見本で重ねるため）。情報の枠と駒も消してある
// - bg-board-boss.json: ボスのマスの中心（960×540 の座標）とマスの大きさ
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const { preview } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'));
process.chdir(root);
const server = await preview({ preview: { port: 4389, host: '127.0.0.1' } });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
await p.goto(server.resolvedUrls.local[0]);
await p.waitForFunction(() => window.__scene && document.querySelector('#ui .ls'));
await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__scene.base === 'board' && window.__scene.bmode === 'idle', null, { timeout: 30000 });
// ボスの3マス手前に立ち、ボスのマスを「何もないマス」として描かせる
await p.evaluate(() => { const s = window.__scene, r = s.run, bi = r.bossIndex; window.__bossAt = bi; r.state.midDone = true; r.state.pos = bi - 3; s.toBoard(); r.board[bi].kind = 'none'; });
await p.waitForFunction(() => window.__scene.bmode === 'idle');
await p.evaluate(() => { window.__scene.bmode = 'moving'; });   // サイコロの届く範囲の金の枠を出さない（動いている間は出ない）
await p.waitForTimeout(900);
const info = await p.evaluate(() => {
  const s = window.__scene, r = s.run, G = r.def.cell, q = r.board[window.__bossAt];
  s.scene.pause();
  const l2 = s.L[2]; l2.g.setVisible(false); for (const t of l2.texts) t.setVisible(false); for (const im of l2.imgs) im.setVisible(false);
  s.fx.setVisible(false); document.getElementById('ui').style.display = 'none';
  return { x: q.x * G + G / 2 - s.cam.x, y: q.y * G + G / 2 - s.cam.y, G };
});
await p.waitForTimeout(200);
await p.screenshot({ path: path.join(here, 'bg-board-boss.png') });
fs.writeFileSync(path.join(here, 'bg-board-boss.json'), JSON.stringify(info));
await b.close(); server.httpServer.close();
console.log('ok', JSON.stringify(info));
