// 戦闘画面への切り替わりの演出（4案）の見本を、ブラウザで動く1ファイルにする。
// 使い方: npm run page && node docs/samples/build-transition-page.mjs <背景(jpg)> <古竜(webp)> <フレイムリザード(webp)> → docs/samples/transition-sample.html
// ゲーム本体は変えず、1ファイル版に見本の描画を足すだけ。上のボタンで案と敵を選び「再生」で、盤面（WARNING）→ 戦闘の開始前 へ切り替わる
// 演出は画面の上に重ねた canvas に描く。覆う（約0.35秒）→ 裏で戦闘に切り替える → 開く（約0.45秒）
//   A 墨のにじみ: 中央から黒い墨が水彩のようににじんで広がり、引くと戦闘
//   B 金の一閃: 金の細い線が横一文字に走り、そこから上下に割れて開く
//   C 敵の気配: 暗く沈み、暗闇で敵の目が一瞬光り、敵を中心に光が広がる
//   D 炎で燃え落ちる: 縁から紙が焦げるように燃えて覆い、中央から燃え広がって開く
import fs from 'node:fs';
const [bgPath, dragonPath, lizardPath] = process.argv.slice(2);
const base = fs.readFileSync('dist-single/chain-battle-standalone.html', 'utf8');
const url = (p, t) => `data:${t};base64,` + fs.readFileSync(p).toString('base64');
const patch = String.raw`<script>
(() => {
  try { localStorage.removeItem('chain-card-save-v1'); } catch (e) {}
  const BG = ${JSON.stringify(url(bgPath, 'image/jpeg'))}, IMG = { elder_dragon: ${JSON.stringify(url(dragonPath, 'image/webp'))}, flame_lizard: ${JSON.stringify(url(lizardPath, 'image/webp'))} };
  const key = code => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code })); };
  const wait = (f, then) => { const id = setInterval(() => { try { if (f()) { clearInterval(id); then(); } } catch (e) {} }, 50); };
  const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  let mode = 'A', enemy = 'elder_dragon', busy = false;
  // 敵の目のあたり（960×540 の座標。ゲームの絵の置き場所から目で測った。C の案で光らせる）
  const EYE = { elder_dragon: [[688, 209]], flame_lizard: [[658, 290]] };
  const LIGHT_AT = { elder_dragon: [760, 330], flame_lizard: [790, 360] };

  wait(() => window.__scene && document.querySelector('#ui .ls'), async () => {
    const s = window.__scene;
    s.textures.addImage('battlebg-img-fire', await img(BG));
    for (const [id, src] of Object.entries(IMG)) if (!s.textures.exists('monster-' + id)) s.textures.addImage('monster-' + id, await img(src));
    key('ArrowRight'); setTimeout(() => key('Enter'), 150);
    wait(() => s.base === 'board', ui);
  });

  // 画面の上に重ねる canvas（ゲームの描画の場所と大きさに合わせる）
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.style.cssText = 'position:fixed;pointer-events:none;z-index:90';
  document.body.appendChild(cv);
  function fit() {
    const r = (document.querySelector('#game canvas') || document.querySelector('canvas')).getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    Object.assign(cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    g.setTransform(cv.width / 960, 0, 0, cv.height / 540, 0, 0);
  }
  // 値の雑音（墨のにじみと、燃える縁に使う）
  const NW = 96, NH = 54, noise = new Float32Array(NW * NH);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random();
  for (let k = 0; k < 3; k++) { const n2 = noise.slice(); for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) { let s2 = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < NW && yy < NH) { s2 += n2[yy * NW + xx]; c++; } } noise[y * NW + x] = s2 / c; } }
  let mn = 1, mx = 0; for (const v of noise) { mn = Math.min(mn, v); mx = Math.max(mx, v); } for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] - mn) / (mx - mn);
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // 覆う量 k（0〜1）で1こま描く。phase: 'in'（覆う）/ 'out'（開く）
  function frame(k, phase, t) {
    g.clearRect(0, 0, 960, 540);
    if (mode === 'A') {   // 墨: 中心からの距離と雑音で、にじんだ縁の黒い形
      const cell = 10, R = Math.hypot(480, 270);
      for (let y = 0; y < 540; y += cell) for (let x = 0; x < 960; x += cell) {
        const d = Math.hypot(x - 480, y - 270) / R, n = noise[Math.floor(y / 10) * NW + Math.floor(x / 10)];
        const edge = k * 1.35 - (d * 0.8 + n * 0.45);
        if (edge > 0) { g.fillStyle = 'rgba(8,6,5,' + Math.min(1, edge * 6) + ')'; g.fillRect(x, y, cell, cell); }
      }
      g.filter = 'blur(6px)'; g.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 960, 540); g.filter = 'none';
    } else if (mode === 'B') {   // 金の一閃: 覆うときは線が走り、上下から黒が閉じる。開くときは上下に割れる
      const y = 270;
      if (phase === 'in') {
        const w = Math.min(1, k * 1.6) * 960;
        const h = Math.max(0, (k - 0.55) / 0.45) * 270;
        g.fillStyle = '#080605'; g.fillRect(0, y - h, 960, h); g.fillRect(0, y, 960, h);
        g.strokeStyle = '#ffe3a0'; g.lineWidth = 2; g.shadowColor = '#d8b46a'; g.shadowBlur = 18;
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.shadowBlur = 0;
      } else {
        const h = (1 - k) * 270;
        g.fillStyle = '#080605'; g.fillRect(0, 0, 960, 270 - h); g.fillRect(0, 270 + h, 960, 270 - h);
        g.strokeStyle = 'rgba(216,180,106,' + k + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, 270 - h); g.lineTo(960, 270 - h); g.moveTo(0, 270 + h); g.lineTo(960, 270 + h); g.stroke();
      }
    } else if (mode === 'C') {   // 敵の気配: 暗く沈む → 目が光る → 敵を中心に光が広がって開く
      if (phase === 'in') { g.fillStyle = 'rgba(4,3,3,' + k + ')'; g.fillRect(0, 0, 960, 540); }
      else {
        const [lx, ly] = LIGHT_AT[enemy], r = Math.max(1, (1 - k) * 1100);
        const grd = g.createRadialGradient(lx, ly, r * 0.35, lx, ly, r);
        grd.addColorStop(0, 'rgba(4,3,3,0)'); grd.addColorStop(1, 'rgba(4,3,3,1)');
        g.fillStyle = grd; g.fillRect(0, 0, 960, 540);
        // 光が広がる前の一瞬、暗闇で目だけ光る
        const glint = k > 0.55 ? Math.sin((k - 0.55) / 0.45 * Math.PI) : 0;
        for (const [ex, ey] of EYE[enemy]) {
          const gr = g.createRadialGradient(ex, ey, 0, ex, ey, 26);
          gr.addColorStop(0, 'rgba(255,120,60,' + glint + ')'); gr.addColorStop(0.3, 'rgba(255,60,20,' + glint * 0.6 + ')'); gr.addColorStop(1, 'rgba(255,40,10,0)');
          g.fillStyle = gr; g.fillRect(ex - 30, ey - 30, 60, 60);
        }
      }
    } else if (mode === 'D') {   // 燃える: 覆うときは縁から、開くときは中央から。縁は橙に光る
      const cell = 8;
      for (let y = 0; y < 540; y += cell) for (let x = 0; x < 960; x += cell) {
        const n = noise[Math.floor(y / 10) * NW + Math.floor(x / 10)];
        const edgeDist = Math.min(x, 960 - x, y * 1.78, (540 - y) * 1.78) / 480;   // 縁から 0、中央で 1
        const v = phase === 'in' ? (edgeDist * 0.75 + n * 0.35) : (1 - edgeDist) * 0.75 + n * 0.35;
        const th = phase === 'in' ? k * 1.15 : (1 - k) * 1.15;
        if (v < th) {
          const band = th - v;
          g.fillStyle = band < 0.04 ? 'rgba(255,170,60,.95)' : band < 0.08 ? 'rgba(180,60,20,.95)' : '#080605';
          g.fillRect(x, y, cell, cell);
        }
      }
      g.filter = 'blur(3px)'; g.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 960, 540); g.filter = 'none';   // 四角い粒が目立たないよう、少しぼかす
    }
  }
  function play() {
    if (busy) return; busy = true;
    const s = window.__scene;
    // 盤面に戻し、敵のマスに止まった状態（WARNING）から始める
    s.run.state.pending = null; s.toBoard();
    setTimeout(() => {
      s.run.state.pending = enemy; s.toBoard();
      wait(() => s.bmode === 'landed', () => {
        setTimeout(() => {   // WARNING を少し見せてから
          fit();
          const IN = mode === 'B' ? 420 : 350, OUT = mode === 'C' ? 650 : 450;
          const t0 = performance.now();
          const step = now => {
            const t = now - t0;
            if (t < IN) { frame(ease(t / IN), 'in', t); requestAnimationFrame(step); return; }
            if (!step.switched) {   // 覆い切ったら、裏で戦闘の開始前へ
              step.switched = true; frame(1, 'in', t); key('Enter');
              wait(() => s.base === 'ready', () => { const t1 = performance.now();
                const out = n2 => { const u = (n2 - t1) / OUT; if (u >= 1) { g.clearRect(0, 0, 960, 540); busy = false; return; } frame(1 - ease(u), 'out', n2 - t1); requestAnimationFrame(out); };
                requestAnimationFrame(out); });
            }
          };
          requestAnimationFrame(step);
        }, 600);
      });
    }, 100);
  }
  function ui() {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;display:flex;gap:6px;align-items:center;padding:6px 10px;background:rgba(8,7,6,.9);border:1px solid #d8b46a;font:500 13px sans-serif;color:#d8b46a;white-space:nowrap';
    const btns = [];
    const btn = (label, on, onclick) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:600 13px sans-serif;padding:4px 10px;border:1px solid #d8b46a;cursor:pointer'; b.onclick = () => { onclick(); paint(); }; b.dataset.on = ''; btns.push([b, on]); bar.appendChild(b); return b; };
    const paint = () => { for (const [b, on] of btns) { const v = on(); b.style.background = v ? '#d8b46a' : '#16110c'; b.style.color = v ? '#16110c' : '#d8b46a'; } };
    for (const [k, n] of [['A', 'A 墨のにじみ'], ['B', 'B 金の一閃'], ['C', 'C 敵の気配'], ['D', 'D 燃え落ちる']]) btn(n, () => mode === k, () => { mode = k; });
    const sep = document.createElement('span'); sep.textContent = '｜'; bar.appendChild(sep);
    btn('古竜', () => enemy === 'elder_dragon', () => { enemy = 'elder_dragon'; });
    btn('リザード', () => enemy === 'flame_lizard', () => { enemy = 'flame_lizard'; });
    const playBtn = btn('▶ 再生', () => false, () => play());
    playBtn.style.marginLeft = '8px';
    document.body.appendChild(bar);
    paint();
    window.__play = (m, e) => { mode = m; if (e) enemy = e; paint(); play(); };
    window.__busy = () => busy;
  }
})();
</script>`;
const at = base.lastIndexOf('</body>');
fs.writeFileSync('docs/samples/transition-sample.html', base.slice(0, at) + patch + '\n' + base.slice(at));
console.log('docs/samples/transition-sample.html', (fs.statSync('docs/samples/transition-sample.html').size / 1024 / 1024).toFixed(1) + 'MB');
