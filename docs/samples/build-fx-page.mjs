// 戦闘背景の炎と煙の演出の見本を、ブラウザで動く1ファイルにする。
// 使い方: npm run page && node docs/samples/build-fx-page.mjs <背景の画像(jpg)> <敵の画像(webp)> → docs/samples/fx-sample.html
// ゲーム本体は変えず、1ファイル版に見本の描画を足すだけ。炎の神殿のボス戦（無敵）を開き、上のボタンで演出を入れ切りする
// - 火の粉: 床から細かい火の粉が立ちのぼり、ちらつきながら消える
// - 煙: アーチの根元から、暗い煙がゆっくり流れて昇る
// - 炎: アーチの根元の溶岩から、小さな炎がゆらめく
import fs from 'node:fs';
const [bgPath, enemyPath] = process.argv.slice(2);
const base = fs.readFileSync('dist-single/chain-battle-standalone.html', 'utf8');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(bgPath).toString('base64');
const enemy = 'data:image/webp;base64,' + fs.readFileSync(enemyPath).toString('base64');
const patch = String.raw`<script>
(() => {
  const BG = ${JSON.stringify(bg)}, ENEMY = ${JSON.stringify(enemy)};
  const on = { ember: true, smoke: true, flame: true };
  const key = code => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code })); };
  const wait = (f, then) => { const id = setInterval(() => { try { if (f()) { clearInterval(id); then(); } } catch (e) {} }, 100); };
  const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  wait(() => window.__scene && document.querySelector('#ui .ls'), async () => {
    const s = window.__scene;
    s.textures.addImage('fx-bg', await img(BG));
    if (!s.textures.exists('monster-elder_dragon')) s.textures.addImage('monster-elder_dragon', await img(ENEMY));
    key('ArrowRight'); setTimeout(() => key('Enter'), 150);
    wait(() => s.base === 'board' && s.bmode === 'idle', () => {
      s.run.state.pending = 'elder_dragon'; s.toBoard();
      wait(() => s.bmode === 'landed', () => { key('Enter');
        wait(() => s.base === 'ready', () => { s.invincible = true; s.battle.invincible = true; key('Enter'); wait(() => s.base === 'fight', start); }); });
    });
  });
  function tex(s, k, px, draw) { if (s.textures.exists(k)) return; const t = s.textures.createCanvas(k, px, px); draw(t.getContext(), px); t.refresh(); }
  function start() {
    const s = window.__scene, l0 = s.L[0];
    // 背景を差し替え、敵の絵を背景と演出より手前に出す
    const o = l0.image.bind(l0);
    l0.image = (k, ...a) => o(k === 'battlebg-temple' ? 'fx-bg' : k, ...a);
    const end0 = l0.end.bind(l0);
    l0.end = () => { for (const i of l0.imgs) i.setDepth(i.texture.key.startsWith('monster-') ? 1.6 : 1); end0(); };
    // 粒の絵: 白いぼかしの丸（色は tint で付ける）
    tex(s, 'fx-dot', 32, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    tex(s, 'fx-smoke', 128, (x, n) => { for (let i = 0; i < 7; i++) { const cx = n / 2 + (Math.random() - .5) * n * .35, cy = n / 2 + (Math.random() - .5) * n * .35, r = n * (.22 + Math.random() * .18); const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } });
    const ARCH_Y = 300, ARCHES = [84, 239, 398, 558, 717, 876];   // 背景の絵のアーチの根元（960×540 の座標）
    const em = {};
    // 火の粉
    em.ember = s.add.particles(0, 0, 'fx-dot', {
      x: { min: 0, max: 960 }, y: { min: 300, max: 560 }, lifespan: { min: 2500, max: 5000 },
      speedY: { min: -55, max: -18 }, speedX: { min: -14, max: 14 }, scale: { start: 0.22, end: 0 },
      alpha: { values: [0, 1, 0.6, 1, 0] }, tint: [0xffb040, 0xff7a2a, 0xffd070], blendMode: 'ADD', frequency: 45, quantity: 1,
    }).setDepth(1.3);
    // 煙
    em.smoke = s.add.particles(0, 0, 'fx-smoke', {
      x: { min: 0, max: 960 }, y: { min: ARCH_Y - 20, max: ARCH_Y + 20 }, lifespan: { min: 7000, max: 11000 },
      speedY: { min: -16, max: -6 }, speedX: { min: 4, max: 14 }, scale: { start: 0.8, end: 3.2 }, rotate: { min: 0, max: 360 },
      alpha: { values: [0, 0.32, 0.22, 0] }, tint: [0x2a2420, 0x3a302a, 0x1e1a18], frequency: 260, quantity: 1,
    }).setDepth(1.2);
    // 炎（アーチの根元ごと）
    em.flame = ARCHES.map(ax => s.add.particles(ax, ARCH_Y, 'fx-dot', {
      x: { min: -28, max: 28 }, lifespan: { min: 500, max: 1100 }, speedY: { min: -70, max: -25 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.9, end: 0.1 }, alpha: { start: 0.75, end: 0 }, tint: [0xff8a2a, 0xff5a1a, 0xffc050], blendMode: 'ADD', frequency: 70, quantity: 1,
    }).setDepth(1.25));
    const apply = () => { em.ember.emitting = on.ember; em.smoke.emitting = on.smoke; for (const f of em.flame) f.emitting = on.flame; };
    // 入れ切りのボタン
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;display:flex;gap:8px;align-items:center;padding:6px 10px;background:rgba(8,7,6,.88);border:1px solid #d8b46a;font:500 13px sans-serif;color:#d8b46a';
    for (const [id, name] of [['ember', '火の粉'], ['smoke', '煙'], ['flame', '炎']]) {
      const b = document.createElement('button');
      const paint = () => { b.textContent = name + (on[id] ? ' ON' : ' OFF'); b.style.background = on[id] ? '#d8b46a' : '#16110c'; b.style.color = on[id] ? '#16110c' : '#d8b46a'; };
      b.style.cssText = 'font:600 13px sans-serif;padding:4px 12px;border:1px solid #d8b46a;cursor:pointer';
      b.onclick = () => { on[id] = !on[id]; paint(); apply(); }; paint(); bar.appendChild(b);
    }
    document.body.appendChild(bar);
  }
})();
</script>`;
const at = base.lastIndexOf('</body>');
fs.writeFileSync('docs/samples/fx-sample.html', base.slice(0, at) + patch + '\n' + base.slice(at));
console.log('docs/samples/fx-sample.html', (fs.statSync('docs/samples/fx-sample.html').size / 1024 / 1024).toFixed(1) + 'MB');
