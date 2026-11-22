// 戦闘背景の炎と煙の演出の見本を、ブラウザで動く1ファイルにする。
// 使い方: npm run page && node docs/samples/build-fx-page.mjs <背景の画像(jpg)> <敵の画像(webp)> → docs/samples/fx-sample.html
// ゲーム本体は変えず、1ファイル版に見本の描画を足すだけ。炎の神殿のボス戦（無敵）を開き、上のボタンで演出を切り替える
// - 火の粉: 床から細かい火の粉が立ちのぼり、ちらつきながら消える
// - 煙: アーチの根元から、暗い煙がゆっくり流れて昇る
// - 炎（3案。1回目の細かい炎は「爆竹のよう」と言われたので替えた）
//   A ゆらめく炎の舌: 縦長のしずく形の炎が、ゆっくり伸びて消える
//   B 光のゆらぎ: 粒は出さず、根元の大きな光がゆっくり脈打ち、ぼんやりした熱気が昇る
//   C 炎の帯: 波を重ねたつながった炎の形を、毎フレーム描き直す
import fs from 'node:fs';
const [bgPath, enemyPath] = process.argv.slice(2);
const base = fs.readFileSync('dist-single/chain-battle-standalone.html', 'utf8');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(bgPath).toString('base64');
const enemy = 'data:image/webp;base64,' + fs.readFileSync(enemyPath).toString('base64');
const patch = String.raw`<script>
(() => {
  const BG = ${JSON.stringify(bg)}, ENEMY = ${JSON.stringify(enemy)};
  const on = { ember: false, smoke: false };
  let mode = 'A';
  // 見本は毎回まっさらな状態から始める。前に開いたときのセーブ（ダンジョンの途中など）が残っていると、
  // 自動で進める手順が途中で止まり、演出が出なかった（2026-11-22、持ち主の指摘）
  try { localStorage.removeItem('chain-card-save-v1'); } catch (e) {}
  const key = code => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code })); };
  const wait = (f, then) => { const id = setInterval(() => { try { if (f()) { clearInterval(id); then(); } } catch (e) {} }, 100); };
  const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  wait(() => window.__scene && document.querySelector('#ui .ls'), async () => {
    const s = window.__scene;
    s.textures.addImage('fx-bg', await img(BG));
    if (!s.textures.exists('monster-elder_dragon')) s.textures.addImage('monster-elder_dragon', await img(ENEMY));
    key('ArrowRight'); setTimeout(() => key('Enter'), 150);
    wait(() => s.base === 'board', () => {
      s.run.state.cleared = false; s.run.state.pending = 'elder_dragon'; s.toBoard();
      wait(() => s.bmode === 'landed', () => { key('Enter');
        wait(() => s.base === 'ready', () => { s.invincible = true; s.battle.invincible = true; key('Enter'); wait(() => s.base === 'fight', start); }); });
    });
  });
  function tex(s, k, px, draw, h = px) { if (s.textures.exists(k)) return; const t = s.textures.createCanvas(k, px, h); draw(t.getContext(), px, h); t.refresh(); }
  function start() {
    const s = window.__scene, l0 = s.L[0];
    // 背景を差し替え、敵の絵を背景と演出より手前に出す
    const o = l0.image.bind(l0);
    l0.image = (k, ...a) => o(k === 'battlebg-temple' ? 'fx-bg' : k, ...a);
    const end0 = l0.end.bind(l0);
    l0.end = () => { for (const i of l0.imgs) i.setDepth(i.texture.key.startsWith('monster-') ? 1.6 : 1); end0(); };
    tex(s, 'fx-dot', 32, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    tex(s, 'fx-smoke', 128, (x, n) => { for (let i = 0; i < 7; i++) { const cx = n / 2 + (Math.random() - .5) * n * .35, cy = n / 2 + (Math.random() - .5) * n * .35, r = n * (.22 + Math.random() * .18); const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } });
    tex(s, 'fx-flame', 64, (x, w, h) => { x.save(); x.translate(w / 2, h * 0.6); x.scale(1, 2); const g = x.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, w / 2, 0, Math.PI * 2); x.fill(); x.restore(); }, 128);
    const ARCH_Y = 300, ARCHES = [84, 239, 398, 558, 717, 876];   // 背景の絵のアーチの根元（960×540 の座標）
    const ember = s.add.particles(0, 0, 'fx-dot', {
      x: { min: 0, max: 960 }, y: { min: 300, max: 560 }, lifespan: { min: 2500, max: 5000 },
      speedY: { min: -55, max: -18 }, speedX: { min: -14, max: 14 }, scale: { start: 0.22, end: 0 },
      alpha: { values: [0, 1, 0.6, 1, 0] }, tint: [0xffb040, 0xff7a2a, 0xffd070], blendMode: 'ADD', frequency: 45, quantity: 1,
    }).setDepth(1.3);
    const smoke = s.add.particles(0, 0, 'fx-smoke', {
      x: { min: 0, max: 960 }, y: { min: ARCH_Y - 20, max: ARCH_Y + 20 }, lifespan: { min: 7000, max: 11000 },
      speedY: { min: -16, max: -6 }, speedX: { min: 4, max: 14 }, scale: { start: 0.8, end: 3.2 }, rotate: { min: 0, max: 360 },
      alpha: { values: [0, 0.32, 0.22, 0] }, tint: [0x2a2420, 0x3a302a, 0x1e1a18], frequency: 260, quantity: 1,
    }).setDepth(1.2);
    const fl = { A: [], B: [], C: [] };
    // A ゆらめく炎の舌
    for (const ax of ARCHES) fl.A.push(s.add.particles(ax, ARCH_Y + 6, 'fx-flame', {
      x: { min: -22, max: 22 }, lifespan: { min: 1100, max: 1800 }, speedY: { min: -30, max: -12 }, speedX: { min: -4, max: 4 },
      scaleX: { start: 0.75, end: 0.2 }, scaleY: { start: 0.45, end: 0.7 }, alpha: { values: [0, 0.5, 0.35, 0] },
      tint: [0xff8a2a, 0xff6a1a, 0xffb040], blendMode: 'ADD', frequency: 120, quantity: 1,
    }).setDepth(1.25));
    // B 光のゆらぎ
    for (const ax of ARCHES) {
      const glow = s.add.image(ax, ARCH_Y - 6, 'fx-dot').setDisplaySize(130, 70).setTint(0xff6a20).setBlendMode('ADD').setAlpha(0.35).setDepth(1.25);
      s.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.55 }, scaleY: { from: glow.scaleY * 0.85, to: glow.scaleY * 1.25 }, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 800 });
      fl.B.push(glow);
      fl.B.push(s.add.particles(ax, ARCH_Y, 'fx-dot', {
        x: { min: -26, max: 26 }, lifespan: { min: 2200, max: 3200 }, speedY: { min: -18, max: -8 }, scale: { start: 1.4, end: 3.2 },
        alpha: { values: [0, 0.22, 0] }, tint: [0xff7a2a, 0xff9a4a], blendMode: 'ADD', frequency: 260, quantity: 1,
      }).setDepth(1.24));
    }
    // C 炎の帯（半分の解像度で描き、2倍に広げる）
    const FW = 480, FH = 50, fire = s.textures.createCanvas('fx-fire', FW, FH), fx = fire.getContext();
    const fireImg = s.add.image(480, ARCH_Y + 6 - FH, 'fx-fire').setDisplaySize(960, FH * 2).setBlendMode('ADD').setDepth(1.25).setAlpha(0.9);
    fl.C.push(fireImg);
    const tongues = ARCHES.flatMap(ax => Array.from({ length: 6 }, (_, k) => ({ x: ax / 2 + (k - 2.5) * 5, ph: Math.random() * 10, f: 1.4 + Math.random() * 1.2, h: 12 + Math.random() * 12 })));
    s.events.on('update', () => {
      if (!fireImg.visible) return;
      const t = s.time.now / 1000;
      fx.clearRect(0, 0, FW, FH);
      for (const q of tongues) {
        const h = q.h * (0.72 + 0.28 * Math.sin(t * q.f + q.ph) + 0.12 * Math.sin(t * q.f * 2.3 + q.ph * 1.7)), sway = Math.sin(t * 1.3 + q.ph) * 2, w = 4.5;
        const g = fx.createLinearGradient(0, FH, 0, FH - h);
        g.addColorStop(0, 'rgba(255,210,120,.85)'); g.addColorStop(.35, 'rgba(255,130,40,.7)'); g.addColorStop(.75, 'rgba(220,60,20,.3)'); g.addColorStop(1, 'rgba(160,30,10,0)');
        fx.fillStyle = g; fx.beginPath(); fx.moveTo(q.x - w, FH);
        fx.quadraticCurveTo(q.x - w * 0.9 + sway * 0.4, FH - h * 0.55, q.x + sway, FH - h);
        fx.quadraticCurveTo(q.x + w * 0.9 + sway * 0.4, FH - h * 0.55, q.x + w, FH); fx.closePath(); fx.fill();
      }
      fire.refresh();
    });
    const apply = () => {
      ember.emitting = on.ember; smoke.emitting = on.smoke;
      for (const k of ['A', 'B', 'C']) for (const o of fl[k]) { if (o.type === 'ParticleEmitter') { o.emitting = mode === k; if (mode !== k) o.killAll(); } else o.setVisible(mode === k); }
    };
    // 切り替えのボタン（炎は3案から1つ、火の粉と煙は入れ切り）
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;display:flex;gap:8px;align-items:center;padding:6px 10px;background:rgba(8,7,6,.88);border:1px solid #d8b46a;font:500 13px sans-serif;color:#d8b46a;white-space:nowrap';
    const btn = (label, onclick) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:600 13px sans-serif;padding:4px 10px;border:1px solid #d8b46a;cursor:pointer'; b.onclick = onclick; bar.appendChild(b); return b; };
    const NAMES = { A: '炎A ゆらめく舌', B: '炎B 光のゆらぎ', C: '炎C 炎の帯', N: '炎なし' };
    const modeBtns = Object.entries(NAMES).map(([k, n]) => [k, btn(n, () => { mode = k; paint(); apply(); })]);
    const toggles = [['ember', '火の粉'], ['smoke', '煙']].map(([id, n]) => [id, n, btn(n, () => { on[id] = !on[id]; paint(); apply(); })]);
    const paint = () => {
      for (const [k, b] of modeBtns) { b.style.background = mode === k ? '#d8b46a' : '#16110c'; b.style.color = mode === k ? '#16110c' : '#d8b46a'; }
      for (const [id, n, b] of toggles) { b.textContent = n + (on[id] ? ' ON' : ' OFF'); b.style.background = on[id] ? '#d8b46a' : '#16110c'; b.style.color = on[id] ? '#16110c' : '#d8b46a'; }
    };
    document.body.appendChild(bar);
    window.__fx = m => { mode = m; paint(); apply(); };
    paint(); apply();
  }
})();
</script>`;
const at = base.lastIndexOf('</body>');
fs.writeFileSync('docs/samples/fx-sample.html', base.slice(0, at) + patch + '\n' + base.slice(at));
console.log('docs/samples/fx-sample.html', (fs.statSync('docs/samples/fx-sample.html').size / 1024 / 1024).toFixed(1) + 'MB');
