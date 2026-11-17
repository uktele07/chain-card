// 段階5の見本の材料を、実際のゲームから撮る（先に npm run build）。使い方: node docs/samples/capture-board.mjs
// - now-board-<場面>.png: 今の見た目（比べるため）
// - bg-board-<場面>.png: 盤面と行き先の印だけ（情報の枠・駒・いまのマスの枠を消したもの）。見本の下敷き
// - bg-board.json: 駒の位置、マスの大きさ、全体図の材料（マスの並び）
// - bg-icon-mon.png: モンスターのマスの絵
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const { preview } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'));
process.chdir(root);
const server = await preview({ preview: { port: 4390, host: '127.0.0.1' } });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
await p.goto(server.resolvedUrls.local[0]);
await p.waitForFunction(() => window.__scene && document.querySelector('#ui .ls'));
await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__scene.base === 'board' && window.__scene.bmode === 'idle', null, { timeout: 30000 });
await p.evaluate(() => { const s = window.__scene; s.save.gold = 310; s.save.loot.fire_shard = 2; s.input2.padStatus = 'ok'; });
const mode = m => p.waitForFunction(x => window.__scene.bmode === x, m, { timeout: 30000 });
const info = {};
async function take(name) {
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(here, `now-board-${name}.png`) });
  info[name] = await p.evaluate(() => {
    const s = window.__scene, run = s.run, G = run.def.cell, q = run.square;
    s.scene.pause();                                         // 動きを止めて、情報の層（層2）と演出を隠す
    const l2 = s.L[2]; l2.g.setVisible(false); for (const t of l2.texts) t.setVisible(false); for (const im of l2.imgs) im.setVisible(false);
    s.fx.setVisible(false);
    return { piece: { x: s.piece.x - s.cam.x, y: s.piece.y - s.cam.y }, here: { x: q.x * G + G / 2 - s.cam.x, y: q.y * G + G / 2 - s.cam.y }, G,
      board: run.board.map(o => [o.x, o.y, o.kind]), pos: run.state.pos, midDone: run.state.midDone, size: run.def.size, cam: s.cam };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(here, `bg-board-${name}.png`) });
  await p.evaluate(() => { const s = window.__scene, l2 = s.L[2]; l2.g.setVisible(true); s.fx.setVisible(true); s.scene.resume(); });
}
// 1. サイコロを振る前（途中のマス、HP 72、アイテム1つ使用済み）
await p.evaluate(() => { const s = window.__scene; s.run.state.pos = 4; s.run.state.hp = 72; s.run.state.used = [true, false, false]; s.toBoard(); });
await mode('idle'); await take('idle');
// 2. マスに止まった（敵が出た）
await p.evaluate(() => { const s = window.__scene; s.run.state.pos = 1; s.toBoard(); s.run.rng = () => 0; });
await mode('idle'); await p.keyboard.press('Enter'); await mode('rolling'); await p.keyboard.press('Enter'); await mode('landed'); await take('landed');
// 3. 分かれ道
await p.evaluate(() => { const s = window.__scene; s.effect = null; s.run.state.pending = null; s.run.state.pos = 11; s.toBoard(); s.run.rng = () => 0; });
await mode('idle'); await p.keyboard.press('Enter'); await mode('rolling'); await p.keyboard.press('Enter'); await mode('choose'); await take('choose');
// 4. 踏破
await p.evaluate(() => { const s = window.__scene; s.run.state.pos = s.run.bossIndex; s.run.state.cleared = true; s.reward = { accessory: 'flame_ring' }; s.bmode = 'cleared'; });
await take('cleared');
fs.writeFileSync(path.join(here, 'bg-board.json'), JSON.stringify(info));
// マスの絵（モンスター）を、見本で使うために画像にする
const icon = await p.evaluate(() => window.__scene.textures.getBase64('sq-mon'));
fs.writeFileSync(path.join(here, 'bg-icon-mon.png'), Buffer.from(icon.split(',')[1], 'base64'));
await b.close(); server.httpServer.close();
console.log('ok', Object.keys(info).join(' '));
