// マスが光る演出の見本を、ブラウザで動く1ファイルにする（録画より見やすいように）。
// 使い方: npm run page && node docs/samples/build-glow-page.mjs → docs/samples/glow-sample.html
// ゲーム本体は変えず、1ファイル版に見本の描画を足すだけ。画面上のボタン（またはキー 1 / 2）で A と B を切り替える
import fs from 'node:fs';
const base = fs.readFileSync('dist-single/chain-battle-standalone.html', 'utf8');
const patch = String.raw`<script>
(() => {
  const NAMES = { A: 'にじみ（ばらばらに明滅、1周 2.0秒）', B: '波（駒から道に沿って流れる、1周 2.3秒）', N: '光なし（いまのゲーム）' };
  let v = 'A';
  const COL = { monster: 0xd9534a, heal: 0x4fae6a, maxhp: 0xe07ab0, item: 0x3fb7c9, event: 0xf2a23a, random: 0x9b7be0, mid: 0xc8453c, key: 0xf0c75e, door: 0xd0874a };
  const key = code => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code })); };
  const wait = (f, then) => { const id = setInterval(() => { try { if (f()) { clearInterval(id); then(); } } catch (e) {} }, 100); };
  wait(() => window.__scene && document.querySelector('#ui .ls'), () => {
    key('ArrowRight'); setTimeout(() => key('Enter'), 150);
    wait(() => window.__scene.base === 'board' && window.__scene.bmode === 'idle', start);
  });
  function start() {
    const s = window.__scene, run = s.run, G = run.def.cell;
    run.state.pos = 22; s.toBoard();
    if (!s.textures.exists('glow-soft')) {
      const t = s.textures.createCanvas('glow-soft', 128, 128), x = t.getContext(), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); t.refresh();
    }
    const phase = {}; run.board.forEach(q => { phase[q.id] = Math.random(); });
    const l1 = s.L[1], end1 = l1.end.bind(l1);
    l1.end = () => {
      if (v !== 'N' && s.base === 'board') {
        // 駒の位置から道に沿った歩数（B の波の遅れ）
        const dist = {}, q0 = [[run.state.pos, 0]]; dist[run.state.pos] = 0;
        while (q0.length) { const [i, d] = q0.shift(); for (const n of run.board[i].next) if (dist[n] === undefined) { dist[n] = d + 1; q0.push([n, d + 1]); } }
        const ahead = s.aheadOf(run.state.pos), t = s.clock;
        for (const q of run.board) {
          if (COL[q.kind] === undefined || !ahead.has(q.id)) continue;
          const x = q.x * G + G / 2 - s.cam.x, y = q.y * G + G / 2 - s.cam.y;
          if (x < -G || x > 960 + G || y < -G || y > 540 + G) continue;
          const k = v === 'A' ? (t / 2.0 + phase[q.id]) : (t / 2.3 - (dist[q.id] ?? 0) * 0.08);
          const w = 0.5 - 0.5 * Math.cos(k * Math.PI * 2);
          l1.image('glow-soft', x, y, G * 1.35, 0.85 * w * w, COL[q.kind]);
          l1.imgs[l1.ii - 1].setBlendMode(1);
        }
      }
      end1();
    };
    // 切り替えのボタン
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;display:flex;gap:8px;align-items:center;padding:6px 10px;background:rgba(8,7,6,.88);border:1px solid #d8b46a;font:500 13px sans-serif;color:#d8b46a';
    const label = document.createElement('span'); label.style.cssText = 'min-width:300px;margin-left:6px;color:#fff';
    const btns = ['A', 'B', 'N'].map(id => { const b = document.createElement('button'); b.textContent = id === 'N' ? '光なし' : '案' + id;
      b.style.cssText = 'font:600 13px sans-serif;padding:4px 12px;background:#16110c;color:#d8b46a;border:1px solid #d8b46a;cursor:pointer';
      b.onclick = () => set(id); bar.appendChild(b); return [id, b]; });
    bar.appendChild(label); document.body.appendChild(bar);
    const set = id => { v = id; label.textContent = NAMES[id]; for (const [k, b] of btns) { b.style.background = k === id ? '#d8b46a' : '#16110c'; b.style.color = k === id ? '#16110c' : '#d8b46a'; } };
    window.addEventListener('keydown', e => { if (e.key === '1') set('A'); if (e.key === '2') set('B'); if (e.key === '0') set('N'); });
    set('A');
  }
})();
</script>`;
const at = base.lastIndexOf('</body>');   // 埋め込んだ Phaser の中にも同じ文字列があるので、最後のものに足す
fs.writeFileSync('docs/samples/glow-sample.html', base.slice(0, at) + patch + '\n' + base.slice(at));
console.log('docs/samples/glow-sample.html', (fs.statSync('docs/samples/glow-sample.html').size / 1024 / 1024).toFixed(1) + 'MB');
