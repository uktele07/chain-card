// 効果音の聞き比べのページ（2026-11-23）。候補は Kenney と OpenGameArt の CC0 素材から、重く乾いた方向で選び、
// ffmpeg で高さを少し下げ（重く）、音量をそろえた（loudnorm）。使い方: node docs/samples/build-sfx-audition.mjs <候補の ogg のフォルダ>
import fs from 'node:fs';
const dir = process.argv[2];
const b64 = id => 'data:audio/ogg;base64,' + fs.readFileSync(`${dir}/${id}.ogg`).toString('base64');
const ROWS = [
  ['カードを出す（C→B→A→S と続けて鳴る）', [['A', '打撃（拳）'], ['B', '木を打つ'], ['C', '刃と金属']], k => ['C', 'B', 'A', 'S'].map(l => `card_${k}_${l}`)],
  ['敵の攻撃を受ける', [['A', '鈍い打撃'], ['B', '鎧に当たる'], ['C', '岩を砕く']], k => [`hurt_${k}`]],
  ['強い攻撃を受ける（！）', [['A', '重い金属板'], ['B', '重い金属'], ['C', '重い打撃']], k => [`big_${k}`]],
  ['強い攻撃の予告', [['A', '重い鐘'], ['B', '鎖が鳴る'], ['C', '低い鐘の音']], k => [`warn_${k}`]],
  ['予告のカウント（残り1.5・1.0・0.5秒）', [['A', '刻み'], ['B', 'クリック'], ['C', '金属の軽い音']], k => [`tick_${k}`, `tick_${k}`, `tick_${k}`]],
  ['チェイン切れ', [['A', '鎖が外れる'], ['B', '鎖が落ちる'], ['C', 'ガラスが割れる']], k => [`chain_${k}`]],
  ['出せない・外れ', [['A', 'エラー音'], ['B', 'ブリキを打つ'], ['C', 'こすれる音']], k => [`miss_${k}`]],
  ['手札の入れ替え', [['A', '紙をめくる'], ['B', '布'], ['C', '本']], k => [`deal_${k}`]],
  ['スペル', [['A', '術 1'], ['B', '術 2'], ['C', '炎の術']], k => [`spell_${k}`]],
  ['アイテム', [['A', '宝石'], ['B', '小物'], ['C', '革の袋']], k => [`item_${k}`]],
  ['メニュー（移動→決定→戻る と続けて鳴る）', [['A', '電子的なクリック'], ['B', '紙と本'], ['C', '木']], k => [`ui_${k}_move`, `ui_${k}_ok`, `ui_${k}_back`]],
];
const ids = new Set(ROWS.flatMap(([, opts, f]) => opts.flatMap(([k]) => f(k))));
const SOUNDS = Object.fromEntries([...ids].map(id => [id, b64(id)]));
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>効果音の聞き比べ</title>
<style>
  :root { --gold: #d8b46a; --sub: #a89c86; }
  body { margin: 0; background: #0b0a09; color: #eee; font: 15px/1.6 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 20px 16px 60px; }
  h1 { font-size: 20px; letter-spacing: 3px; color: var(--gold); margin: 0 0 4px; }
  p.note { color: var(--sub); font-size: 13px; margin: 0 0 18px; }
  .row { border-top: 1px solid rgba(216,180,106,.25); padding: 12px 0; }
  .row h2 { font-size: 15px; margin: 0 0 8px; letter-spacing: 1px; }
  .opts { display: flex; flex-wrap: wrap; gap: 8px; }
  .opt { display: flex; align-items: center; gap: 0; border: 1px solid rgba(216,180,106,.5); }
  .opt button { background: #16110c; color: var(--gold); border: 0; padding: 8px 12px; font: 600 14px system-ui; cursor: pointer; }
  .opt button.play::before { content: '▶ '; }
  .opt label { padding: 8px 10px; border-left: 1px solid rgba(216,180,106,.3); cursor: pointer; color: var(--sub); font-size: 13px; }
  .opt input { margin-right: 4px; }
  .opt.on { border-color: var(--gold); background: rgba(216,180,106,.18); }
  #sum { margin-top: 20px; padding: 12px; border: 1px solid var(--gold); white-space: pre-wrap; font-size: 13px; }
</style></head><body><main>
<h1>効果音の聞き比べ</h1>
<p class="note">重く乾いた方向で、CC0 の素材（Kenney、OpenGameArt）から選んだ候補です。▶ で鳴らし、良いものに印を付けてください。いまの合成の音のままがよい場面は「いまのまま」に。最後に出る一覧を、そのまま送ってもらえれば反映します。</p>
<div id="rows"></div>
<div id="sum"></div>
</main><script>
const S = ${JSON.stringify(SOUNDS)};
const ROWS = ${JSON.stringify(ROWS.map(([t, opts, f]) => [t, opts.map(([k, n]) => [k, n, f(k)])]))};
let ctx; const buf = {};
async function play(list) {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume();
  let t = ctx.currentTime + 0.02;
  for (const id of list) {
    if (!buf[id]) { const r = await fetch(S[id]); buf[id] = await ctx.decodeAudioData(await r.arrayBuffer()); }
    const s = ctx.createBufferSource(); s.buffer = buf[id]; s.connect(ctx.destination); s.start(t);
    t += Math.min(buf[id].duration, 0.45) + 0.12;
  }
}
const pick = {};
const box = document.getElementById('rows');
ROWS.forEach(([title, opts], r) => {
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = '<h2>' + title + '</h2><div class="opts"></div>';
  const o = row.querySelector('.opts');
  for (const [k, name, list] of [...opts, ['-', 'いまのまま', null]]) {
    const el = document.createElement('div'); el.className = 'opt';
    if (list) { const b = document.createElement('button'); b.className = 'play'; b.textContent = k + ' ' + name; b.onclick = () => play(list); el.appendChild(b); }
    const lab = document.createElement('label');
    lab.innerHTML = '<input type="radio" name="r' + r + '">' + (list ? 'これにする' : 'いまのまま');
    lab.querySelector('input').onchange = () => { pick[title] = list ? k + '（' + name + '）' : 'いまのまま'; o.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); el.classList.add('on'); sum(); };
    el.appendChild(lab); o.appendChild(el);
  }
  box.appendChild(row);
});
function sum() { document.getElementById('sum').textContent = '選んだ効果音:\\n' + ROWS.map(([t]) => '・' + t.replace(/（.*/, '') + ': ' + (pick[t] || '未選択')).join('\\n'); }
sum();
</script></body></html>`;
fs.writeFileSync('docs/samples/sfx-audition.html', html);
console.log('docs/samples/sfx-audition.html', (fs.statSync('docs/samples/sfx-audition.html').size / 1024).toFixed(0) + 'KB', ids.size, 'sounds');
