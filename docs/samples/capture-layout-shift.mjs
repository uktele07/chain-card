// 戦闘画面の配置の見本: 手札を 95% にして、カード1枚分（74）左へ。敵の技の表示も同じだけ左へ（CSS を足して撮るだけ。ゲームは変えない）
import { createRequire } from 'node:module';
const require = createRequire('/home/user/chain-card/package.json');
const { chromium } = require('playwright');
const { createServer } = await import('/home/user/chain-card/node_modules/vite/dist/node/index.js');
process.chdir('/home/user/chain-card');
const server = await createServer({ server: { port: 4401, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:4401/');
await p.waitForFunction(() => window.__scene && document.querySelector('#ui .ls'), null, { timeout: 60000 });
await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__scene.base === 'board', null, { timeout: 60000 });
for (const id of ['red_slime', 'elder_dragon']) {
  await p.evaluate(id => { const s = window.__scene; s.run.state.pending = id; s.toBoard(); }, id);
  await p.waitForFunction(() => window.__scene.bmode === 'landed', null, { timeout: 30000 });
  await p.keyboard.press('Enter'); await p.waitForFunction(() => window.__scene.base === 'ready', null, { timeout: 30000 });
  await p.keyboard.press('Enter'); await p.waitForFunction(() => window.__scene.base === 'fight', null, { timeout: 30000 });
  await p.evaluate(() => { window.__scene.invincible = true; window.__scene.battle.invincible = true; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: process.env.S + `/lay-now-${id}.png` });
  await p.addStyleTag({ content: `
    #ui .bt .c, #ui .bt .chain, #ui .bt .ctimer, #ui .bt .chs, #ui .bt .chl, #ui .bt .buffs { margin-left: -74px; }
    #ui .bt .c { scale: .95; }
    #ui .bt .next1, #ui .bt .next2, #ui .bt .gauge { margin-left: -74px; }` });
  await p.waitForTimeout(600);
  await p.screenshot({ path: process.env.S + `/lay-new-${id}.png` });
  await p.evaluate(() => { document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('margin-left: -74px')) s.remove(); }); const s = window.__scene; s.run.state.pending = null; s.toBoard(); });
}
await b.close(); await server.close();
