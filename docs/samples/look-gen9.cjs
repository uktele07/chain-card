// ボスのマスの見本（2回目）: 実際の盤面の上で。B 瘴気と C 魔法陣を、板あり・板なしの4通り
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen9.cjs（先に capture-boss.mjs で下敷きを撮る）
// 書き出し: style-S5-boss2.png（動きの途中で止めたもの）、style-S5-boss2.webm（動いているところ）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8">${[500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;
const AT = JSON.parse(fs.readFileSync(path.join(__dirname, 'bg-board-boss.json'), 'utf8'));   // ボスのマスの中心（960×540）
const SIZE = 54;   // 盤面でのボスのマスの大きさ

// 大きな角の生えた魔の頭蓋（look-gen8 と同じ）
const SKULL = 'M1.5 2.5C3 7 5.5 8.6 7.6 8.4 8.8 6.6 10.3 5.8 12 5.8s3.2.8 4.4 2.6c2.1.2 4.6-1.4 6.1-5.9-.2 5.6-2.3 8.4-4.6 9.4.4 1 .5 2 .4 3.1-.2 1.8-1.3 3-2.6 3.6l-.3 2.5H8.6l-.3-2.5c-1.3-.6-2.4-1.8-2.6-3.6-.1-1.1 0-2.1.4-3.1C3.8 10.9 1.7 8.1 1.5 2.5Z'
  + 'M8.2 12.3l3 1.3-.4 1.7-2.8-.6Z M15.8 12.3l-3 1.3.4 1.7 2.8-.6Z M11.2 16.6h1.6l-.8 1.3Z M9.6 20.4v-1.6M12 20.4v-1.6M14.4 20.4v-1.6';
const EYES = 'M8.2 12.3l3 1.3-.4 1.7-2.8-.6Z M15.8 12.3l-3 1.3.4 1.7 2.8-.6Z';
let uid = 0;
function slab(glow) {
  const id = 'k' + (uid++);
  return `<defs><filter id="n${id}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2a26"/><stop offset="1" stop-color="#1a1210"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l${id})"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n${id})" opacity=".45"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="${glow}" stroke-opacity=".7" stroke-width=".8"/>`;
}
// 宝石: 上の平らな面（テーブル）と、斜めの面（クラウン）、下へすぼまる面（パビリオン）。24×24
const GEM = [
  ['M7 6h10l-1.6 3.4H8.6Z', 1.0],                       // テーブル（いちばん明るい）
  ['M7 6 3 9.4h5.6Z', .55], ['M17 6l4 3.4h-5.6Z', .75],  // クラウンの左右
  ['M8.6 9.4h6.8L12 21.5Z', .8],                        // パビリオンの真ん中
  ['M3 9.4h5.6L12 21.5Z', .4], ['M21 9.4h-5.6L12 21.5Z', .6],   // パビリオンの左右
];
/** tile: 板あり / なし。板なしは、宝石を壁の上に浮かべ、下に淡い影を落とす */
const glyph = (col, tile, glow) => `<svg class="tile" viewBox="0 0 48 48" style="overflow:visible">${tile ? slab(glow) : ''}
  <g transform="translate(${tile ? 11 : 7} ${tile ? 10.5 : 4}) scale(${tile ? 1.08 : 1.42})" class="gem">
  ${tile ? '' : '<ellipse cx="12" cy="26" rx="6" ry="1.4" fill="#000" opacity=".55" style="filter:blur(1px)"/>'}
  <g class="sk">${GEM.map(([d, l]) => `<path d="${d}" fill="${col}" style="filter:brightness(${.45 + l * .9})"/>`).join('')}
  <path d="M7 6h10l4 3.4L12 21.5 3 9.4Z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".4" stroke-linejoin="round"/>
  <path d="M3 9.4h18M8.6 9.4 12 21.5 15.4 9.4M7 6l1.6 3.4M17 6l-1.6 3.4" stroke="#fff" stroke-opacity=".3" stroke-width=".3" fill="none"/></g>
  <path d="M9 6.8h2.6l-.8 1.6H9.6Z" fill="#fff" class="eye"/></g></svg>`;

const PLANS = {
  // B 瘴気: 黒紫の煙が渦巻き、頭蓋は暗く、眼だけが赤く光る
  B: {
    name: 'B 瘴気',
    css: `.B .sm{position:absolute;left:50%;top:50%;width:170%;height:170%;margin:-85% 0 0 -85%;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0deg,rgba(110,25,140,.7) 40deg,transparent 90deg,rgba(15,0,20,.85) 150deg,transparent 200deg,rgba(150,20,70,.6) 260deg,transparent 320deg);filter:blur(6px);animation:spin 6s linear infinite}
.B .sm.b{width:135%;height:135%;margin:-67.5% 0 0 -67.5%;animation-duration:4s;animation-direction:reverse;opacity:.85}
.B .dk{position:absolute;left:50%;top:50%;width:120%;height:120%;margin:-60% 0 0 -60%;border-radius:50%;background:radial-gradient(circle,rgba(10,0,12,.75),transparent 70%)}
.B .sk{filter:drop-shadow(0 0 3px #b040ff) drop-shadow(0 0 7px #7a10c0);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.75}50%{opacity:1}}
.B .eye{filter:drop-shadow(0 0 2px #fff);animation:eyeB 2.4s ease-in-out infinite}
@keyframes eyeB{0%,100%{opacity:.35}50%{opacity:1}}`,
    html: tile => `<div class="aura"><div class="dk"></div><div class="sm"></div><div class="sm b"></div></div>${glyph('#9a3ad0', tile, '#7a2a8a')}`,
  },
  // C 魔法陣: 下で赤い陣が回り、波紋が広がる
  C: {
    name: 'C 魔法陣',
    css: `.C .ring{position:absolute;left:50%;top:50%;width:190%;height:190%;margin:-95% 0 0 -95%;animation:spin 9s linear infinite}
.C .wave{position:absolute;left:50%;top:50%;width:100%;height:100%;margin:-50% 0 0 -50%;border-radius:50%;border:2px solid #ff3a1a;animation:wave 1.8s ease-out infinite}
.C .wave.b{animation-delay:-.9s}@keyframes wave{0%{transform:scale(.9);opacity:.9}100%{transform:scale(2);opacity:0}}
.C .sk{filter:drop-shadow(0 2px 3px #ff2a0a) drop-shadow(0 0 6px rgba(255,40,10,.6))}
.C .eye{animation:eyeC 2s ease-in-out infinite}@keyframes eyeC{0%,100%{opacity:.5}50%{opacity:1}}`,
    html: tile => `<div class="aura"><svg class="ring" viewBox="-50 -50 100 100"><g fill="none" stroke="#ff3a1a" stroke-opacity=".8" style="filter:drop-shadow(0 0 2px #ff2a0a)">
    <circle r="46" stroke-width=".8"/><circle r="40" stroke-width=".5"/><path d="M0-40 34.6 20-34.6 20Z M0 40-34.6-20 34.6-20Z" stroke-width=".6"/>
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="-46" x2="0" y2="-42" transform="rotate(${i * 15})" stroke-width=".6"/>`).join('')}</g></svg>
    <div class="wave"></div><div class="wave b"></div></div>${glyph('#ff4b1f', tile, '#ff4b1f')}`,
  },
};
const CASES = [['B', true, 'B 瘴気（板あり）'], ['B', false, 'B 瘴気（板なし）'], ['C', true, 'C 魔法陣（板あり）'], ['C', false, 'C 魔法陣（板なし）']];

const css = `*{box-sizing:border-box;margin:0;padding:0}body{background:#14110f;color:#d8b46a;font-family:'Noto Sans JP';font-weight:500;letter-spacing:2px}
@keyframes spin{to{transform:rotate(360deg)}}
.grid{display:grid;grid-template-columns:repeat(2,460px);gap:22px 16px;padding:12px 12px 18px}
.cap{font-size:13px;margin:0 0 6px 2px}
.view{position:relative;width:460px;height:259px;overflow:hidden;border:1px solid rgba(216,180,106,.3)}
.zoom{position:absolute;left:0;top:0;width:960px;height:540px;transform-origin:0 0}
.zoom img{position:absolute;left:0;top:0;width:960px;height:540px}
.boss{position:absolute}.boss .aura{position:absolute;inset:0;overflow:visible}.boss .tile{position:absolute;inset:0;width:100%;height:100%}
${Object.values(PLANS).map(p => p.css).join('\n')}`;
/** 盤面の一部を拡大して見せる。z: 拡大率。ボスのマスが真ん中に来るようにずらす */
function view([k, tile], z) {
  const w = 460 / z, h = 259 / z, ox = Math.min(960 - w, Math.max(0, AT.x - w / 2)), oy = Math.min(540 - h, Math.max(0, AT.y - h / 2));
  return `<div class="view"><div class="zoom" style="transform:scale(${z}) translate(${-ox}px,${-oy}px)"><img src="${img('bg-board-boss.png')}">
  ${tile ? '' : `<div style="position:absolute;left:${AT.x - AT.G / 2 - 2}px;top:${AT.y - AT.G / 2 - 2}px;width:${AT.G + 4}px;height:${AT.G + 4}px;background:url(${img('bg-board-boss.png')}) ${-(AT.x - AT.G / 2 - 2)}px ${-(AT.y - AT.G / 2 - 2 - AT.G * 2)}px/960px 540px"></div>`}
  <div class="boss ${k}" style="left:${AT.x - SIZE / 2}px;top:${AT.y - SIZE / 2}px;width:${SIZE}px;height:${SIZE}px">${PLANS[k].html(tile)}</div></div></div>`;
}
const page = (z, title) => `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  ${title ? `<div style="padding:14px 14px 0;font-size:18px">${title}</div><div style="padding:4px 14px 0;font-size:12px;color:#cfc6b4;letter-spacing:1px">実際の盤面の上。板なしは、ボスのマスの床も消して、壁の上に浮かべた。盤面を ${z} 倍に拡大して見せている。マスの大きさは実際と同じ ${SIZE}。動きは style-S5-boss2.webm。</div>` : ''}
  <div class="grid">${CASES.map(c => `<div><div class="cap">${c[2]}</div>${view(c, z)}</div>`).join('')}</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const f = path.join(OUT, 'boss2.html'); fs.writeFileSync(f, page(1.6, 'ボスのマス（3回目）: 宝石の絵。板なしは床のマスも消した'));
  const p = await b.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 2 });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 700 + (a.effect.getTiming().delay < 0 ? -a.effect.getTiming().delay : 0); } });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, 'style-S5-boss2.png'), fullPage: true }); await p.close();
  // 動画（4通りを並べて、5秒）
  const vdir = path.join(OUT, 'video2'); fs.rmSync(vdir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 960, height: 600 }, recordVideo: { dir: vdir, size: { width: 960, height: 600 } } });
  const v = await ctx.newPage();
  const vf = path.join(OUT, 'boss2-video.html'); fs.writeFileSync(vf, page(1.6, ''));
  await v.goto('file://' + vf); await v.waitForTimeout(5500);
  const vp = await v.video().path(); await ctx.close();
  fs.copyFileSync(vp, path.join(__dirname, 'style-S5-boss2.webm'));
  await b.close();
})();
