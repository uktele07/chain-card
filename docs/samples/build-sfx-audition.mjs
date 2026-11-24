// 効果音の聞き比べのページ（2026-11-23。2回目の候補は 2026-11-24: 音の中身を解析して選び直した。docs/samples/sfx-candidates2.txt）。候補は Kenney と OpenGameArt の CC0 素材から、重く乾いた方向で選び、
// ffmpeg で高さを少し下げ（重く）、音量をそろえた（loudnorm）。使い方: node docs/samples/build-sfx-audition.mjs <候補の ogg のフォルダ>
import fs from 'node:fs';
const dir = process.argv[2];
const b64 = id => 'data:audio/ogg;base64,' + fs.readFileSync(`${dir}/${id}.ogg`).toString('base64');
const ROWS = [
  ['カードを出す（C→B→A→S と続けて鳴る）', [['A', '素手の打撃（録音）'], ['B', '刃が空を切る＋打撃'], ['C', '木と重い物を叩きつける']], k => ['C', 'B', 'A', 'S'].map(l => `card_${k}_${l}`)],
  ['敵の攻撃を受ける', [['A', '鈍い打撃（録音）'], ['B', '重い物が当たる'], ['C', '叩きつけられる']], k => [`hurt_${k}`]],
  ['強い攻撃を受ける（！）', [['A', '重い打撃（録音）'], ['B', '金属の響き＋打撃'], ['C', '破裂＋低い衝撃']], k => [`big_${k}`]],
  ['強い攻撃の予告', [['A', '低い銅鑼'], ['B', '低い金属の響き'], ['C', '重い鐘']], k => [`warn_${k}`]],
  ['予告のカウント（残り1.5・1.0・0.5秒）', [['A', '乾いた木を打つ'], ['B', '機械の小さな音'], ['C', '木の短い音']], k => [`tick_${k}`, `tick_${k}`, `tick_${k}`]],
  ['チェイン切れ', [['A', '金属が崩れる'], ['B', '刃がはじかれる'], ['C', '金属を打つ']], k => [`chain_${k}`]],
  ['出せない・外れ', [['A', '乾いた木の鈍い音'], ['B', '器を置く'], ['C', '低い鈍い音']], k => [`miss_${k}`]],
  ['手札の入れ替え', [['A', '紙（録音）'], ['B', '紙をこする'], ['C', '紙をめくる']], k => [`deal_${k}`]],
  ['スペル', [['A', '炎の術'], ['B', '高い鐘の余韻'], ['C', 'ばねの響き']], k => [`spell_${k}`]],
  ['アイテム', [['A', 'ガラスの小瓶'], ['B', '鍵を回す'], ['C', '宝石']], k => [`item_${k}`]],
  ['メニュー（移動→決定→戻る と続けて鳴る）', [['A', '小さな機械の音'], ['B', '乾いた木'], ['C', '木と鈍い音']], k => [`ui_${k}_move`, `ui_${k}_ok`, `ui_${k}_back`]],
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
<p class="note">2回目の候補です。名前ではなく、音の中身（立ち上がり、余韻の長さ、音の高さ）を解析して、重く乾いたものを選び直しました（CC0 の素材 約600音から）。▶ で鳴らし、良いものに印を付けてください。いまの合成の音のままがよい場面は「いまのまま」に。最後に出る一覧を、そのまま送ってもらえれば反映します。</p>
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
