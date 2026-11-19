// 盤面の案を、実際のゲームの絵で全体図にする。使い方: node scripts/boards/capture.mjs ring spiral islands
// data/dungeons.json の炎の神殿を一時的に差し替えて開発サーバーで撮り、終わったら元に戻す。
// 鍵（k）と扉（D）は、いまのゲームでは「なし」のマスとして描かれるので、上に印を重ねる
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServer } = await import(path.resolve('node_modules/vite/dist/node/index.js'));
const OUT = process.env.OUT || 'docs/samples';
const DATA = 'data/dungeons.json', orig = fs.readFileSync(DATA, 'utf8');
const names = process.argv.slice(2);
const P = 256, M = 48;   // 盤面の外の余白（ゲーム側）、撮る範囲の余白
const server = await createServer({ server: { port: 4391, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  for (const name of names) {
    const b = (await import(`./${name}.mjs`)).build();
    const data = JSON.parse(orig), fire = data.dungeons.find(d => d.id === 'fire');
    fire.size = b.size; fire.lava = b.lava;
    fire.segments = b.segs.map(s => ({ id: s.id, next: s.next, cells: s.cells.map((c, i) => [c[0], c[1], s.kinds[i]]) }));
    fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
    const p = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await p.goto('http://127.0.0.1:4391/');
    await p.waitForFunction(() => window.__scene && document.querySelector('#ui .ls'), null, { timeout: 60000 });
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.__scene.base === 'board' && window.__scene.bmode === 'idle', null, { timeout: 60000 });
    const G = await p.evaluate(() => { const s = window.__scene; document.querySelector('#ui').style.display = 'none'; s.bmode = 'cleared'; s.piece = { x: -9999, y: -9999 }; return s.run.def.cell; });
    const Wd = b.size[0] * G, Hd = b.size[1] * G, x0 = -M, y0 = -M, x1 = Wd + M, y1 = Hd + M;
    const tiles = [];
    for (let y = y0; y < y1; y += 540) for (let x = x0; x < x1; x += 960) {
      const cx = Math.min(x, x1 - 960), cy = Math.min(y, y1 - 540);
      await p.evaluate(([cx, cy]) => { const s = window.__scene; s.camTarget = () => ({ x: cx, y: cy }); s.cam = { x: cx, y: cy }; }, [cx, cy]);
      await p.waitForTimeout(250);
      tiles.push({ x: cx - x0, y: cy - y0, src: 'data:image/png;base64,' + (await p.screenshot()).toString('base64') });
    }
    // つなぎ合わせて、鍵と扉の印、案の名前を重ねる
    const marks = b.segs.flatMap(s => s.cells.map((c, i) => [c[0], c[1], s.kinds[i]])).filter(c => c[2] === 'k' || c[2] === 'D')
      .map(([x, y, k]) => ({ x: x * G + G / 2 - x0, y: y * G + G / 2 - y0, k }));
    const cv = await browser.newPage({ viewport: { width: x1 - x0, height: y1 - y0 } });
    await cv.setContent(`<canvas id=c width=${x1 - x0} height=${y1 - y0}></canvas><style>body{margin:0}</style>`);
    const png = await cv.evaluate(async ({ tiles, marks, title, n }) => {
      const c = document.getElementById('c'), g = c.getContext('2d');
      for (const t of tiles) { const im = new Image(); im.src = t.src; await im.decode(); g.drawImage(im, t.x, t.y); }
      for (const m of marks) {
        const key = m.k === 'k', col = key ? '#ffd76a' : '#d8b46a';
        g.save(); g.translate(m.x, m.y);
        g.shadowColor = key ? 'rgba(255,200,80,.9)' : 'rgba(0,0,0,.8)'; g.shadowBlur = 14;
        g.fillStyle = '#16110c'; g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath(); g.roundRect(-22, -22, 44, 44, 4); g.fill(); g.stroke(); g.shadowBlur = 0;
        g.fillStyle = col; g.font = '700 22px "Noto Sans JP", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(key ? '鍵' : '扉', 0, 1); g.restore();
      }
      g.fillStyle = 'rgba(8,7,6,.85)'; g.fillRect(0, 0, 360, 64);
      g.fillStyle = '#d8b46a'; g.font = '700 26px "Noto Sans JP", sans-serif'; g.textBaseline = 'middle'; g.fillText(`案「${title}」`, 20, 32);
      g.fillStyle = '#b8ad98'; g.font = '500 15px "Noto Sans JP", sans-serif'; g.fillText(`${n} マス`, 200, 34);
      return c.toDataURL('image/png');
    }, { tiles, marks, title: b.name, n: b.segs.reduce((a, s) => a + s.cells.length, 0) });
    const file = path.join(OUT, `style-S6-board-${name}.png`);
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log('ok', file);
    await p.close(); await cv.close();
  }
} finally {
  fs.writeFileSync(DATA, orig);
  await browser.close(); await server.close();
}
