// マスの「ぼんやり光る」演出の見本（3案）を動画で撮る。ゲームのコードは変えず、ページの中で描画に足す。
// 使い方: node docs/samples/capture-glow.mjs（ONLY=ABC で案を選ぶ。既定は AB。出力は docs/samples/style-S7-glow-<案>.webm と .png）
// A にじみ: マスの絵に、種類の色の光を加算で重ね、ばらばらの間合いで明滅（1周 2.0秒。2回目の見本で 2.8 → 2.0、明暗を強く）
// B 波: 同じ光を、駒の位置から道に沿って先へ流れる波にする（1周 2.3秒。同じく 3.2 → 2.3）。進む向きが分かる
// C 縁: 光は敷かず、マスの縁の細い線だけを明滅（1周 2.8秒）。いちばん控えめ
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const { createServer } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'));
process.chdir(root);
const server = await createServer({ server: { port: 4396, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const tmp = process.env.TMPV || path.join(here, 'tmp-video');
const b = await chromium.launch();
const NAMES = { A: 'にじみ', B: '波', C: '縁' };
for (const v of (process.env.ONLY || 'AB').split('')) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: tmp, size: { width: 960, height: 540 } } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4396/');
  await p.waitForFunction(() => window.__scene && document.querySelector('#ui .ls'), null, { timeout: 60000 });
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__scene.base === 'board' && window.__scene.bmode === 'idle', null, { timeout: 60000 });
  await p.evaluate(({ v, name }) => {
    const s = window.__scene, run = s.run, G = run.def.cell;
    run.state.pos = 22; s.toBoard();
    const COL = { monster: 0xd9534a, heal: 0x4fae6a, maxhp: 0xe07ab0, item: 0x3fb7c9, event: 0xf2a23a, random: 0x9b7be0, mid: 0xc8453c, key: 0xf0c75e, door: 0xd0874a };
    // 白いぼかしの丸（色は tint で付ける）
    if (!s.textures.exists('glow-soft')) {
      const t = s.textures.createCanvas('glow-soft', 128, 128), x = t.getContext(), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); t.refresh();
    }
    const phase = {}; run.board.forEach(q => { phase[q.id] = Math.random(); });
    // B: 駒の位置から道に沿った歩数（先にあるマスほど遅れて光る）
    const dist = {}; { const q = [[run.state.pos, 0]]; dist[run.state.pos] = 0; while (q.length) { const [i, d] = q.shift(); for (const n of run.board[i].next) if (dist[n] === undefined) { dist[n] = d + 1; q.push([n, d + 1]); } } }
    const lit = q => COL[q.kind] !== undefined;
    const l1 = s.L[1], end1 = l1.end.bind(l1);
    l1.endGlow = () => {
      if (v !== 'C') {
        const ahead = s.aheadOf(run.state.pos), t = s.clock;
        for (const q of run.board) {
          if (!lit(q) || !ahead.has(q.id)) continue;
          const x = q.x * G + G / 2 - s.cam.x, y = q.y * G + G / 2 - s.cam.y;
          if (x < -G || x > 960 + G || y < -G || y > 540 + G) continue;
          const k = v === 'A' ? (t / 2.0 + phase[q.id]) : (t / 2.3 - (dist[q.id] ?? 0) * 0.08);
          const w = 0.5 - 0.5 * Math.cos(k * Math.PI * 2);          // 0〜1 をゆっくり往復
          // マスの絵の上に、加算で重ねる（絵が内側から光って見える）
          l1.image('glow-soft', x, y, G * 1.35, 0.85 * w * w, COL[q.kind]);   // 暗いときは消える。2乗で明るい時間を短く、明暗をはっきり
          l1.imgs[l1.ii - 1].setBlendMode(1);
        }
      }
    };
    l1.end = () => {
      l1.endGlow();
      if (v === 'C') {
        const ahead = s.aheadOf(run.state.pos), t = s.clock;
        for (const q of run.board) {
          if (!lit(q) || !ahead.has(q.id)) continue;
          const x = q.x * G + G / 2 - s.cam.x, y = q.y * G + G / 2 - s.cam.y;
          if (x < -G || x > 960 + G || y < -G || y > 540 + G) continue;
          const w = 0.5 - 0.5 * Math.cos((t / 2.8 + phase[q.id]) * Math.PI * 2), c = '#' + COL[q.kind].toString(16).padStart(6, '0');
          l1.rect(x - 26, y - 26, 52, 52, { stroke: c, sw: 2, rx: 6, alpha: 0.15 + 0.7 * w });
          l1.rect(x - 29, y - 29, 58, 58, { stroke: c, sw: 3, rx: 8, alpha: 0.08 + 0.22 * w });
        }
      }
      end1();
    };
    const tag = document.createElement('div');
    tag.textContent = `案${v}「${name}」（見本）`;
    tag.style.cssText = 'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:99;padding:4px 12px;background:rgba(8,7,6,.85);border:1px solid #d8b46a;color:#d8b46a;font:700 14px "Noto Sans JP",sans-serif;letter-spacing:2px';
    document.body.appendChild(tag);
  }, { v, name: NAMES[v] });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(here, `style-S7-glow-${v}.png`) });
  await p.waitForTimeout(6500);
  const vid = p.video(); await ctx.close();
  fs.copyFileSync(await vid.path(), path.join(here, `style-S7-glow-${v}.webm`));
  console.log('ok', v);
}
await b.close(); await server.close();
