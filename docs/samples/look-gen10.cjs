// ボスのマスの見本（4回目）: 持ち主が用意したルビーの画像を板ありのマスに入れ、瘴気を最前面に重ねる
// 使い方: RUBY=<背景を抜いたルビーの PNG> FONTS=<@fontsource の場所> OUT=<出力先> node docs/samples/look-gen10.cjs
// ルビーの画像は出典とライセンスが分かるまで、リポジトリに入れない（CLAUDE.md の約束）。書き出しも OUT に出す
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname, RUBY = process.env.RUBY;
const NAME = RUBY ? 'style-S5-boss4' : 'style-S5-boss5';   // RUBY を渡さなければ、ルビーの絵を抜いた版
const head = `<meta charset="utf-8">${[500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;
const AT = JSON.parse(fs.readFileSync(path.join(__dirname, 'bg-board-boss.json'), 'utf8')), SIZE = 54;

const slab = `<svg class="tile" viewBox="0 0 48 48"><defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2a26"/><stop offset="1" stop-color="#1a1210"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l)"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n)" opacity=".45"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="#7a2a8a" stroke-opacity=".8" stroke-width=".8"/></svg>`;
// 重ねる順（奥から）: 板 → ルビーの後ろの赤い光 → ルビー → 瘴気（最前面）
// 瘴気は2段: 濃い黒紫の煙が渦を巻き（不透明度 .9 前後）、その間から時々ルビーがのぞく。手前に薄い紫の靄が脈打つ
const css = `*{box-sizing:border-box;margin:0;padding:0}body{background:#14110f;color:#d8b46a;font-family:'Noto Sans JP';font-weight:500;letter-spacing:2px}
@keyframes spin{to{transform:rotate(360deg)}}
.view{position:relative;width:${process.env.VW || 460}px;height:${process.env.VH || 259}px;overflow:hidden;border:1px solid rgba(216,180,106,.3)}
.zoom{position:absolute;left:0;top:0;width:960px;height:540px;transform-origin:0 0}.zoom img.bg{position:absolute;left:0;top:0;width:960px;height:540px}
.boss{position:absolute}.boss>*{position:absolute}.tile{inset:0;width:100%;height:100%}
.glow{left:50%;top:50%;width:80%;height:80%;margin:-40% 0 0 -40%;border-radius:50%;background:radial-gradient(circle,rgba(255,30,40,.7),transparent 70%);filter:blur(3px);animation:beat 2.4s ease-in-out infinite}
.ruby{left:50%;top:50%;width:70%;height:70%;margin:-35% 0 0 -35%;filter:drop-shadow(0 0 3px rgba(255,40,60,.9)) brightness(1.05);animation:beat 2.4s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1);opacity:.85}12%{transform:scale(1.07);opacity:1}26%{transform:scale(1)}40%{transform:scale(1.04);opacity:1}}
.sm{left:50%;top:50%;border-radius:50%;filter:blur(5px)}
.sm.a{width:185%;height:185%;margin:-92.5% 0 0 -92.5%;background:conic-gradient(from 0deg,rgba(25,0,30,.92) 0deg,rgba(90,15,120,.85) 50deg,transparent 95deg,rgba(10,0,12,.95) 150deg,rgba(130,20,80,.75) 205deg,transparent 245deg,rgba(40,5,55,.9) 300deg,rgba(25,0,30,.92) 360deg);
  -webkit-mask:radial-gradient(circle,transparent 16%,#000 32%,#000 46%,transparent 70%);animation:spin 5.5s linear infinite}
.sm.b{width:150%;height:150%;margin:-75% 0 0 -75%;background:conic-gradient(from 90deg,transparent 0deg,rgba(60,0,80,.8) 70deg,transparent 120deg,rgba(15,0,20,.9) 200deg,transparent 250deg,rgba(110,10,60,.7) 320deg,transparent 360deg);
  -webkit-mask:radial-gradient(circle,transparent 8%,#000 36%,#000 48%,transparent 70%);animation:spin 3.6s linear infinite reverse}
.mist{left:-20%;top:-20%;width:140%;height:140%;border-radius:50%;background:radial-gradient(circle,rgba(70,0,90,.35),rgba(20,0,25,.5) 55%,transparent 72%);animation:mist 2.4s ease-in-out infinite}
@keyframes mist{0%,100%{opacity:.6}50%{opacity:1}}
.wisp{width:16%;height:38%;left:42%;top:-30%;border-radius:50%;background:radial-gradient(ellipse,rgba(80,10,100,.85),transparent 70%);filter:blur(3px);animation:wisp 2.6s ease-out infinite}
.wisp.b{left:22%;animation-delay:-.9s}.wisp.c{left:68%;animation-delay:-1.7s}
@keyframes wisp{0%{transform:translateY(40%) scale(.6);opacity:0}30%{opacity:1}100%{transform:translateY(-70%) scale(1.4);opacity:0}}`;
const boss = `<div class="boss" style="left:${AT.x - SIZE / 2}px;top:${AT.y - SIZE / 2}px;width:${SIZE}px;height:${SIZE}px">
  ${slab}<div class="glow"></div>${RUBY ? `<img class="ruby" src="file://${RUBY}">` : ''}
  <div class="mist"></div><div class="sm a"></div><div class="sm b"></div><div class="wisp"></div><div class="wisp b"></div><div class="wisp c"></div></div>`;
function view(z) {
  const w = (+process.env.VW || 460) / z, h = (+process.env.VH || 259) / z, ox = Math.min(960 - w, Math.max(0, AT.x - w / 2)), oy = Math.min(540 - h, Math.max(0, AT.y - h / 2));
  return `<div class="view"><div class="zoom" style="transform:scale(${z}) translate(${-ox}px,${-oy}px)"><img class="bg" src="${img('bg-board-boss.png')}">${boss}</div></div>`;
}
(async () => {
  const b = await chromium.launch();
  const frames = [0, 600, 1200, 1800];
  const body = `<div style="padding:14px 14px 4px;font-size:18px">${RUBY ? 'ボスのマス（4回目）: ルビーの画像、板あり、瘴気を最前面に' : 'ボスのマス（5回目）: 4回目からルビーの絵を抜いたもの'}</div>
  <div style="padding:0 14px 10px;font-size:12px;color:#cfc6b4;letter-spacing:1px">上の4つは動きの途中（0.0 / 0.6 / 1.2 / 1.8 秒）を盤面の2.4倍で。下は盤面での大きさ（1倍）。</div>
  <div style="display:grid;grid-template-columns:repeat(2,460px);gap:16px;padding:0 12px 14px">${frames.map((t, i) => `<div class="f" data-t="${t}"><div style="font-size:12px;margin-bottom:4px">${(t / 1000).toFixed(1)} 秒</div>${view(2.4)}</div>`).join('')}</div>
  <div style="padding:0 12px 16px"><div style="font-size:12px;margin-bottom:4px">盤面での大きさ</div>${view(1)}</div>`;
  const f = path.join(OUT, 'boss4.html'); fs.writeFileSync(f, `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">${body}</body></html>`);
  const p = await b.newPage({ viewport: { width: 960, height: 700 }, deviceScaleFactor: 2 });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.evaluate(() => { for (const el of document.querySelectorAll('.f, .view')) { const t = +(el.closest('.f')?.dataset.t ?? 900);
    for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t + (a.effect.getTiming().delay < 0 ? -a.effect.getTiming().delay : 0); } } });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, NAME + '.png'), fullPage: true }); await p.close();
  // 動画: 盤面の2.4倍、6秒
  const vdir = path.join(OUT, 'video4'); fs.rmSync(vdir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 920, height: 520 }, recordVideo: { dir: vdir, size: { width: 920, height: 520 } } });
  const v = await ctx.newPage();
  const vf = path.join(OUT, 'boss4-video.html'); fs.writeFileSync(vf, `<!doctype html><html><head>${head}<style>${css.replace(/width:460px;height:259px/, 'width:920px;height:518px')}</style></head><body style="margin:0">${view(4.8).replace('class="view"', 'class="view" style="width:920px;height:518px"')}</body></html>`);
  await v.goto('file://' + vf); await v.waitForTimeout(6500);
  const vp = await v.video().path(); await ctx.close();
  fs.copyFileSync(vp, path.join(OUT, NAME + '.webm'));
  await b.close();
})();
