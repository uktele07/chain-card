// カードを出す音（ElevenLabs の Free で試した音）を、実際の戦闘で試す1ファイルのページ（2026-11-24）。
// Free の音は商用に使えないので、ゲーム本体（公開先）には入れず、このページだけで試す。
// 使い方: npm run page && node docs/samples/build-card-sfx-page.mjs <C の音(ogg)> <S の音(ogg)> → docs/samples/card-sfx-sample.html
import fs from 'node:fs';
const [cPath, sPath] = process.argv.slice(2);
const base = fs.readFileSync('dist-single/chain-battle-standalone.html', 'utf8');
const url = p => 'data:audio/ogg;base64,' + fs.readFileSync(p).toString('base64');
const patch = String.raw`<script>
(() => {
  try { localStorage.removeItem('chain-card-save-v1'); } catch (e) {}
  const SRC = { card: ${JSON.stringify(url(cPath))}, 'card-s': ${JSON.stringify(url(sPath))} };
  let useNew = true; const bufs = {};
  const key = code => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code })); };
  const wait = (f, then) => { const id = setInterval(() => { try { if (f()) { clearInterval(id); then(); } } catch (e) {} }, 100); };
  // 音を出せるようになったら（クリックかキーのあと）、素材を読み込んで差し込む
  async function load() {
    const snd = window.__sound; snd.unlock();
    if (!snd.ctx || Object.keys(bufs).length) return apply();
    for (const [k, u] of Object.entries(SRC)) bufs[k] = await snd.ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
    apply();
  }
  function apply() { const snd = window.__sound; for (const k of Object.keys(SRC)) { if (useNew && bufs[k]) snd.samples[k] = bufs[k]; else delete snd.samples[k]; } paint(); }
  window.addEventListener('pointerdown', load); window.addEventListener('keydown', load);
  // 討伐の最初の敵と、無敵で戦う
  wait(() => window.__scene && document.querySelector('#ui .ls'), () => {
    key('Enter');
    wait(() => window.__scene.base === 'ready', () => { const s = window.__scene; s.invincible = true; s.battle.invincible = true; });
  });
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;display:flex;gap:6px;align-items:center;padding:6px 10px;background:rgba(8,7,6,.9);border:1px solid #d8b46a;font:500 13px sans-serif;color:#d8b46a;white-space:nowrap';
  const btn = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'font:600 13px sans-serif;padding:4px 10px;border:1px solid #d8b46a;cursor:pointer;background:#16110c;color:#d8b46a'; b.onclick = async e => { e.stopPropagation(); await load(); f(); }; bar.appendChild(b); return b; };
  const bNew = btn('新しい音', () => { useNew = true; apply(); });
  const bOld = btn('いまの音', () => { useNew = false; apply(); });
  btn('▶ C→B→A→S', () => [1, 2, 3, 4].forEach((lv, i) => setTimeout(() => window.__sound.hit(lv), i * 450)));
  function paint() { for (const [b, on] of [[bNew, useNew], [bOld, !useNew]]) { b.style.background = on ? '#d8b46a' : '#16110c'; b.style.color = on ? '#16110c' : '#d8b46a'; } }
  document.body.appendChild(bar); paint();
})();
</script>`;
const at = base.lastIndexOf('</body>');
fs.writeFileSync('docs/samples/card-sfx-sample.html', base.slice(0, at) + patch + '\n' + base.slice(at));
console.log('docs/samples/card-sfx-sample.html', (fs.statSync('docs/samples/card-sfx-sample.html').size / 1024 / 1024).toFixed(1) + 'MB');
