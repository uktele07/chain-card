// ボスのマスの見本: 禍々しい絵柄と、動くオーラ。3案（A 炎 / B 瘴気 / C 魔法陣）
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen8.cjs
// 書き出し: style-S5-boss.png（各案を4コマに切り出したもの）、style-S5-boss.webm（動いているところ）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8">${[500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;

// ボスの記号: 大きな角の生えた魔の頭蓋。眼窩が燃える（24×24。塗りは evenodd で穴を抜く）
const SKULL = 'M1.5 2.5C3 7 5.5 8.6 7.6 8.4 8.8 6.6 10.3 5.8 12 5.8s3.2.8 4.4 2.6c2.1.2 4.6-1.4 6.1-5.9-.2 5.6-2.3 8.4-4.6 9.4.4 1 .5 2 .4 3.1-.2 1.8-1.3 3-2.6 3.6l-.3 2.5H8.6l-.3-2.5c-1.3-.6-2.4-1.8-2.6-3.6-.1-1.1 0-2.1.4-3.1C3.8 10.9 1.7 8.1 1.5 2.5Z'
  + 'M8.2 12.3l3 1.3-.4 1.7-2.8-.6Z M15.8 12.3l-3 1.3.4 1.7 2.8-.6Z M11.2 16.6h1.6l-.8 1.3Z M9.6 20.4v-1.6M12 20.4v-1.6M14.4 20.4v-1.6';
// 刻印石の板（マスの絵と同じ）
function slab(id, inner, glow) {
  return `<svg class="tile" width="100%" height="100%" viewBox="0 0 48 48" style="overflow:visible">
  <defs><filter id="n${id}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2a26"/><stop offset="1" stop-color="#1a1210"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l${id})"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n${id})" opacity=".45"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="${glow}" stroke-opacity=".7" stroke-width=".8"/>${inner}</svg>`;
}
const skull = (col, id) => `<g transform="translate(11 10.5) scale(1.08)">
  <path d="${SKULL}" fill="#0a0606" fill-rule="evenodd" transform="translate(.5 .7)"/>
  <path d="${SKULL}" fill="${col}" fill-rule="evenodd" class="sk"/>
  <path d="M8.2 12.3l3 1.3-.4 1.7-2.8-.6Z M15.8 12.3l-3 1.3.4 1.7 2.8-.6Z" fill="#fff6d0" class="eye"/></g>`;

// A 炎: 板の周りから赤黒い炎が立ちのぼる。頭蓋がゆっくり脈打ち、眼が明滅する
const PLAN_A = {
  name: 'A 炎', desc: '板の縁から赤黒い炎が立ちのぼり、火の粉が舞う。頭蓋がゆっくり脈打ち、眼が明滅する。火の神殿にいちばん合う。',
  weak: '弱点: 動きが多く、ほかのマスより目立ちすぎる。水の神殿では色を変える必要がある。',
  css: `.A .fl{position:absolute;bottom:38%;width:22%;height:70%;border-radius:50% 50% 30% 30%/70% 70% 30% 30%;background:radial-gradient(ellipse at 50% 90%,#ffd27a 0%,#ff5a1f 35%,#8a0a06 70%,transparent 72%);filter:blur(3px);opacity:.85;transform-origin:50% 100%;animation:flick 1.1s ease-in-out infinite}
.A .fl:nth-child(1){left:2%;animation-delay:-.2s;height:60%}.A .fl:nth-child(2){left:26%;animation-delay:-.7s;height:85%}.A .fl:nth-child(3){left:52%;animation-delay:-.4s;height:78%}.A .fl:nth-child(4){left:76%;animation-delay:-.9s;height:58%}
@keyframes flick{0%,100%{transform:scaleY(.8) scaleX(1) translateY(0);opacity:.7}50%{transform:scaleY(1.15) scaleX(.85) translateY(-6%);opacity:.95}}
.A .sp{position:absolute;width:3%;height:3%;border-radius:50%;background:#ffb23a;box-shadow:0 0 4px #ff5a1f;animation:rise 1.8s linear infinite}
@keyframes rise{0%{transform:translate(0,0);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),-90%);opacity:0}}
.A .sk{filter:drop-shadow(0 0 2px #ff3a1a) drop-shadow(0 0 6px #ff2a0a);animation:beat 1.6s ease-in-out infinite;transform-origin:12px 12px}
@keyframes beat{0%,100%{transform:scale(1)}12%{transform:scale(1.06)}24%{transform:scale(1)}36%{transform:scale(1.04)}}
.A .eye{animation:eye 1.6s ease-in-out infinite}@keyframes eye{0%,100%{opacity:.5}12%,36%{opacity:1}}`,
  html: () => `<div class="aura">${[0, 1, 2, 3].map(() => '<div class="fl"></div>').join('')}</div>
  ${[[20, -10, 0], [45, 8, -.6], [70, -6, -1.1], [35, 12, -1.4], [60, -14, -.3]].map(([x, dx, d]) => `<div class="sp" style="left:${x}%;bottom:40%;--dx:${dx}px;animation-delay:${d}s"></div>`).join('')}
  ${slab('A', skull('#ff4b1f', 'A'), '#ff4b1f')}`,
};
// B 瘴気: 黒紫の煙が板の周りをゆっくり渦巻き、頭蓋の眼だけが赤く光る
const PLAN_B = {
  name: 'B 瘴気', desc: '黒と紫の煙が、板の周りをゆっくり渦巻く。頭蓋は暗く沈み、眼だけが赤く光る。静かで不気味。',
  weak: '弱点: 暗い盤面では煙が溶けて見えにくい。煙は Canvas の粒子で作るので、描く手間がかかる。',
  css: `.B .sm{position:absolute;left:50%;top:50%;width:150%;height:150%;margin:-75% 0 0 -75%;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0deg,rgba(90,20,110,.55) 40deg,transparent 90deg,rgba(20,0,20,.7) 150deg,transparent 200deg,rgba(130,20,60,.45) 260deg,transparent 320deg);filter:blur(7px);animation:spin 6s linear infinite}
.B .sm.b{width:125%;height:125%;margin:-62.5% 0 0 -62.5%;animation-duration:4s;animation-direction:reverse;opacity:.8}
@keyframes spin{to{transform:rotate(360deg)}}
.B .sk{filter:drop-shadow(0 0 3px #3a0a3a);opacity:.9}
.B .eye{fill:#ff2a1a;filter:drop-shadow(0 0 2px #ff2a1a) drop-shadow(0 0 5px #ff0a0a);animation:eyeB 2.4s ease-in-out infinite}
@keyframes eyeB{0%,100%{opacity:.35}50%{opacity:1}}`,
  html: () => `<div class="aura"><div class="sm"></div><div class="sm b"></div></div>${slab('B', skull('#3a2234', 'B'), '#7a2a8a')}`,
};
// C 魔法陣: 板の下に赤い魔法陣が回り、外へ向かう波紋が出る。頭蓋は動かず、陣の光で照らされる
const PLAN_C = {
  name: 'C 魔法陣', desc: '板の下で赤い魔法陣がゆっくり回り、外へ波紋が広がる。頭蓋は動かず、陣の光で下から照らされる。「ここに何かいる」感じ。',
  weak: '弱点: 魔法陣が隣のマスにかかる。分かれ道の近くでは、行き先の強調と重なりやすい。',
  css: `.C .ring{position:absolute;left:50%;top:50%;width:170%;height:170%;margin:-85% 0 0 -85%;animation:spin 9s linear infinite}
.C .wave{position:absolute;left:50%;top:50%;width:100%;height:100%;margin:-50% 0 0 -50%;border-radius:50%;border:2px solid #ff3a1a;animation:wave 1.8s ease-out infinite}
.C .wave.b{animation-delay:-.9s}@keyframes wave{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.9);opacity:0}}
.C .sk{filter:drop-shadow(0 2px 3px #ff2a0a) drop-shadow(0 0 6px rgba(255,40,10,.6))}
.C .eye{animation:eye 2s ease-in-out infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes eye{0%,100%{opacity:.5}50%{opacity:1}}`,
  html: () => `<div class="aura"><svg class="ring" viewBox="-50 -50 100 100"><g fill="none" stroke="#ff3a1a" stroke-opacity=".75" style="filter:drop-shadow(0 0 2px #ff2a0a)">
    <circle r="46" stroke-width=".8"/><circle r="40" stroke-width=".5"/><path d="M0-40 34.6 20-34.6 20Z M0 40-34.6-20 34.6-20Z" stroke-width=".6"/>
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="-46" x2="0" y2="-42" transform="rotate(${i * 15})" stroke-width=".6"/>`).join('')}</g></svg>
  <div class="wave"></div><div class="wave b"></div></div>${slab('C', skull('#ff4b1f', 'C'), '#ff4b1f')}`,
};
const PLANS = [PLAN_A, PLAN_B, PLAN_C];

const css = `*{box-sizing:border-box;margin:0;padding:0}body{background:#14110f;color:#d8b46a;font-family:'Noto Sans JP';font-weight:500;letter-spacing:2px}
.sec{padding:18px 24px 22px;border-bottom:1px solid rgba(216,180,106,.2)}.t{font-size:18px}.d{font-size:12px;color:#cfc6b4;margin-top:6px;letter-spacing:1px}.w{font-size:12px;color:#ff8a6a;margin-top:2px;letter-spacing:1px}
.row{display:flex;gap:64px;align-items:center;margin-top:34px;padding:0 30px 10px}
.cap{position:relative;z-index:5}
.boss{position:relative;flex:none}.boss .aura{position:absolute;inset:0;overflow:visible}.boss .tile{position:absolute;inset:0}
.board{position:relative;width:260px;height:150px;overflow:hidden;border:1px solid rgba(216,180,106,.25)}.board img{position:absolute;left:-560px;top:-120px;width:1500px;filter:brightness(.5) saturate(.7)}
.cap{font-size:10px;color:#cfc6b4;letter-spacing:1px;text-align:center;margin-top:6px}
${PLANS.map(p => p.css).join('\n')}`;
const boss = (p, size, cls) => `<div class="boss ${cls}" style="width:${size}px;height:${size}px">${p.html()}</div>`;

(async () => {
  const b = await chromium.launch();
  // 1枚目: 各案を、4つの時刻で止めて並べる（動きの途中を見せる）
  const page = `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  <div class="sec" style="padding-bottom:8px"><div class="t" style="font-size:20px">ボスのマス: 禍々しい絵柄と、動くオーラ（3案）</div>
  <div class="d">記号は、大きな角の生えた魔の頭蓋。眼窩が燃える。左の4つは同じ絵の動きの途中（0.0 / 0.4 / 0.8 / 1.2 秒）。右は盤面に置いたときの大きさ（54）。動きは style-S5-boss.webm。</div></div>
  ${PLANS.map((p, k) => `<div class="sec"><div class="t">${p.name}</div><div class="d">${p.desc}</div><div class="w">${p.weak}</div>
  <div class="row">${[0, 1, 2, 3].map(i => `<div>${boss(p, 92, ['A', 'B', 'C'][k] + ' f' + i)}<div class="cap">${(i * .4).toFixed(1)} 秒</div></div>`).join('')}
  <div><div class="board"><img src="${img('bg-board-idle.png')}"><div style="position:absolute;left:103px;top:48px">${boss(p, 54, ['A', 'B', 'C'][k])}</div></div><div class="cap">盤面での大きさ</div></div></div></div>`).join('')}</body></html>`;
  const f = path.join(OUT, 'boss.html'); fs.writeFileSync(f, page);
  const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  // 各コマの中の動きを、その時刻に止める
  await p.evaluate(() => { for (const el of document.querySelectorAll('.boss')) { const m = el.className.match(/f(\d)/), t = m ? +m[1] * 400 : 600;
    for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t + (a.effect.getTiming().delay < 0 ? -a.effect.getTiming().delay : 0); } } });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, 'style-S5-boss.png'), fullPage: true }); await p.close();
  // 2枚目: 動画（3案を横に並べて、4秒）
  const vdir = path.join(OUT, 'video'); fs.rmSync(vdir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 720, height: 300 }, recordVideo: { dir: vdir, size: { width: 720, height: 300 } } });
  const v = await ctx.newPage();
  const vf = path.join(OUT, 'boss-video.html');
  fs.writeFileSync(vf, `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:720px;height:300px;display:flex;justify-content:space-around;align-items:center">
  ${PLANS.map((pl, k) => `<div>${boss(pl, 130, ['A', 'B', 'C'][k])}<div class="cap" style="font-size:14px;margin-top:40px">${pl.name}</div></div>`).join('')}</body></html>`);
  await v.goto('file://' + vf); await v.waitForTimeout(4500);
  const vp = await v.video().path(); await ctx.close();
  fs.copyFileSync(vp, path.join(__dirname, 'style-S5-boss.webm'));
  await b.close();
})();
