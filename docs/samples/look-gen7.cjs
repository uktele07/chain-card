// マスの絵とサイコロの見本（2回目）
// - マスの絵: 背景は刻印石（前回の C）。絵柄を全く違う3パターンに（影絵 / 紋章 / 漢字）
// - サイコロ: 黒曜石（前回の C）を立体に。読むのは上の面。上の面が見やすい、見下ろす角度
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen7.cjs
// 書き出し: style-S5-icons2.png、style-S5-dice2.png
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8">${[500, 700, 900].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;

// マスの種類: [名前, 色, 影絵（24×24 の塗り。evenodd で穴を抜く）, 紋章（24×24 の線）, 漢字]
const KINDS = [
  ['モンスター', '#d9534a',
    'M3.5 2.5 8 8.2Q12 6.6 16 8.2L20.5 2.5 19.3 10.5Q20 18.5 12 21.5 4 18.5 4.7 10.5ZM7.6 11.6 10.6 13.3 7.9 13.9ZM16.4 11.6 13.4 13.3 16.1 13.9ZM9.4 16.6h5.2l-1 1.6h-3.2Z',
    'M12 3 21 19H3ZM12 9.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M12 11.4v1.4', '敵'],
  ['回復', '#4fae6a',
    'M12 21.5c-.3-4 .2-8 2.4-11.5C17 6 20.5 4.5 21 3c.6 4-1 9.5-5 11.5-1.2.6-2.6.8-3.4.6M12 21.5c.2-3-.6-5.6-2.4-7.6C7.6 11.6 4.5 11 3 9.6c-.5 3.6 1.4 7.5 4.7 8.6 1.4.5 3 .3 4.3-.2ZM11.2 21.5h1.6V23h-1.6Z',
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v10M7 12h10M12 3v2M12 19v2', '癒'],
  ['最大HPアップ', '#e07ab0',
    'M12 21.2C3.2 15 2.8 8.6 6.6 6.8 9 5.7 11.1 6.9 12 8.8 12.9 6.9 15 5.7 17.4 6.8 21.2 8.6 20.8 15 12 21.2ZM10.8 10.2v2.4H8.4v2.2h2.4v2.4h2.4v-2.4h2.4v-2.2h-2.4v-2.4Z',
    'M12 3 20 12 12 21 4 12ZM12 7.5 16.5 12 12 16.5 7.5 12ZM12 1v2M12 21v2', '命'],
  ['アイテム', '#3fb7c9',
    'M3.5 11h17v9.5h-17ZM4 10C4 6.2 7.4 4 12 4s8 2.2 8 6ZM10.4 12.6h3.2v3.6h-3.2Z',
    'M5 8h14v12H5ZM5 8l3-4h8l3 4M12 8v12M9 13h6', '宝'],
  ['イベント', '#f2a23a',
    'M12 1.8c1.6 4.4 7.2 6.4 7.2 12.4a7.2 7.2 0 0 1-14.4 0c0-3.2 1.9-5.1 3.3-7.3.4 2.3 1.4 3.6 2.6 4C10.4 7.8 10.6 4.6 12 1.8ZM12 13.5c-1.2 1.6-2.6 2.6-2.6 4.6a2.6 2.6 0 0 0 5.2 0c0-2-1.4-3-2.6-4.6Z',
    'M12 3v18M4.5 7.5 19.5 16.5M19.5 7.5 4.5 16.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', '炎'],
  ['ランダム', '#9b7be0',
    'M12 2.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM6.5 20h11l1.2 2.5H5.3ZM10.2 8.4c.2-1.2 1-2 2.1-2 1.3 0 2.1.9 2.1 2 0 1.6-2 1.8-2 3.6M11.4 13.8h1.6v1.6h-1.6Z',
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10M12 11a1 1 0 1 0 0 2', '謎'],
  ['中ボス', '#c8453c',
    'M12 2.2c-5 0-8 3.6-8 8.6v5.4l3 3.6h10l3-3.6v-5.4c0-5-3-8.6-8-8.6ZM6.4 10.8h11.2v2H13.2v6.4h-2.4v-6.4H6.4ZM11 2.2h2v-1.4h-2Z',
    'M4 4h16v8l-8 9-8-9ZM8 8h8M12 8v9', '番'],
  ['ボス', '#ff5a4a',
    'M2.5 13.5 5.5 6l2.8 3.2L11 3l1.6 4.4L16 4.6l.6 5 4.9-1.4-3 6.6 3 2.4-6 .6-1.8 3.6-2.6-2.8L7.6 21l-.4-4.2L3.2 16.6ZM9.8 11.8l2.6 1.2-2.6 1Z',
    'M3 20 6 5l6 6 6-6 3 15ZM12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4', '主'],
  ['入口', '#8a93a3',
    'M4 21.5V10.2a8 8 0 0 1 16 0v11.3H15v-7a3 3 0 0 0-6 0v7Z',
    'M5 21V10a7 7 0 0 1 14 0v11M5 21h14M9 21v-6h6v6M12 3v4', '門'],
];

// 刻印石の板（前回の C と同じ）
function slab(id, size, inner) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs><filter id="n${id}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a423b"/><stop offset="1" stop-color="#26211d"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l${id})"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n${id})" opacity=".5"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="#000" stroke-opacity=".6"/><path d="M5 4.5h38" stroke="#fff" stroke-opacity=".18"/>${inner}</svg>`;
}
let uid = 0;
// A 影絵: 具体的な物の形を、塗りで彫る（悪魔の頭、薬草、心臓、宝箱、炎、水晶玉、兜、竜の頭、門）。縁が種類の色で光る
function tileSilhouette([, col, sil], size) {
  const id = 'a' + (uid++);
  return slab(id, size, `<g transform="translate(11 11) scale(1.08)">
    <path d="${sil}" fill="#0a0806" fill-rule="evenodd" transform="translate(.5 .7)"/>
    <path d="${sil}" fill="${col}" fill-opacity=".9" fill-rule="evenodd" style="filter:drop-shadow(0 0 2px ${col}) drop-shadow(0 0 5px ${col})"/>
    <path d="${sil}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5" fill-rule="evenodd" transform="translate(-.4 -.4)"/></g>`);
}
// B 紋章: 三角・円・菱形・線で組んだ、古代の紋のような記号。細い溝が光る
function tileRune([, col, , rune], size) {
  const id = 'b' + (uid++);
  return slab(id, size, `<circle cx="24" cy="24" r="17" fill="none" stroke="#0a0806" stroke-width="2.4"/><circle cx="24" cy="24" r="17" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width=".8"/>
  <g transform="translate(14 14) scale(.84)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${rune}" stroke="#0a0806" stroke-width="3.8"/>
    <path d="${rune}" stroke="${col}" stroke-width="1.7" style="filter:drop-shadow(0 0 2.5px ${col}) drop-shadow(0 0 5px ${col})"/></g>`);
}
// C 漢字: 1文字を深く刻む。字の溝が種類の色で光る
function tileKanji([, col, , , ch], size) {
  const id = 'c' + (uid++);
  return slab(id, size, `<text x="24.6" y="34.6" text-anchor="middle" font-family="Noto Sans JP" font-weight="900" font-size="25" fill="#0a0806">${ch}</text>
  <text x="24" y="34" text-anchor="middle" font-family="Noto Sans JP" font-weight="900" font-size="25" fill="${col}" style="filter:drop-shadow(0 0 2px ${col}) drop-shadow(0 0 5px ${col})">${ch}</text>
  <text x="23.6" y="33.6" text-anchor="middle" font-family="Noto Sans JP" font-weight="900" font-size="25" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".4">${ch}</text>`);
}
const ICON_PLANS = [
  ['A 影絵', '具体的な物の形を塗りで彫る。悪魔の頭、薬草、心臓、宝箱、炎、水晶玉、兜、竜の頭、門。初めて見ても意味が分かる。', '弱点: 形が細かいので、小さいと形が読みにくい。種類が増えるたびに絵を描く手間がかかる。', tileSilhouette],
  ['B 紋章', '三角・円・菱形・線で組んだ、古代の紋のような記号。外側の円で全部をそろえる。神殿の床の刻印らしい。', '弱点: 記号の意味は覚える必要がある（色が手がかり）。最初は「マスの説明」を見ることになる。', tileRune],
  ['C 漢字', '1文字を深く刻む（敵・癒・命・宝・炎・謎・番・主・門）。意味がすぐ分かり、和風の神殿の格が出る。', '弱点: 文字なので「絵」としての楽しさは薄い。海外向けに出すときは置き換えが要る。', tileKanji],
];

// ---- サイコロ: 黒曜石の立方体。上の面を読む（見下ろす角度）。向かいの面の和は 7 ----
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const SIDES = { 1: [2, 3], 2: [1, 3], 3: [1, 2], 4: [1, 5], 5: [1, 4], 6: [2, 4] };   // 上の目に対して、手前と右に見える目（向かいの和が 7 になる組み合わせ）
function face(k, s, tf, light, glow) {
  const r = s * (k === 1 ? .1 : .075);
  return `<div style="position:absolute;width:${s}px;height:${s}px;transform:${tf};border-radius:${s * .16}px;
    background:linear-gradient(150deg,rgba(255,255,255,${light * .5}) 0%,#2a2623 18%,#0c0a09 60%,#050404 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,${light * .35}),inset 0 0 ${s * .2}px rgba(0,0,0,.8)">
    ${PIPS[k].map(([x, y]) => `<div style="position:absolute;left:${s / 2 + x * s * .24 - r}px;top:${s / 2 + y * s * .24 - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;
      background:radial-gradient(circle,#fff3c0 0%,#ffb23a 35%,#ff4b1f 70%,#3a0a02 100%);box-shadow:0 0 ${r * 2 * glow}px #ff6a1f;opacity:${.55 + glow * .45}"></div>`).join('')}</div>`;
}
function dice(n, size) {
  const s = size * .62, [front, right] = SIDES[n];
  return `<div style="position:relative;width:${size}px;height:${size}px;perspective:${size * 5}px">
  <div style="position:absolute;left:12%;right:12%;bottom:4%;height:14%;border-radius:50%;background:radial-gradient(ellipse,rgba(255,90,30,.35),rgba(0,0,0,.6) 50%,transparent 75%);filter:blur(${size * .03}px)"></div>
  <div style="position:absolute;left:${(size - s) / 2}px;top:${(size - s) / 2 + size * .02}px;width:${s}px;height:${s}px;transform-style:preserve-3d;transform:rotateX(-52deg) rotateY(-32deg)">
    ${face(n, s, `rotateX(90deg) translateZ(${s / 2}px)`, .9, 1)}
    ${face(front, s, `translateZ(${s / 2}px)`, .25, .35)}
    ${face(right, s, `rotateY(90deg) translateZ(${s / 2}px)`, .12, .25)}</div></div>`;
}

const css = `*{box-sizing:border-box;margin:0;padding:0}body{background:#14110f;color:#d8b46a;font-family:'Noto Sans JP';font-weight:500;letter-spacing:2px}
.sec{padding:20px 24px 26px;border-bottom:1px solid rgba(216,180,106,.2)}.t{font-size:18px}.d{font-size:12px;color:#cfc6b4;margin-top:6px;letter-spacing:1px}.w{font-size:12px;color:#ff8a6a;margin-top:2px;letter-spacing:1px}
.row{display:flex;gap:18px;align-items:flex-end;margin-top:16px}.cell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10px;color:#cfc6b4;letter-spacing:1px}
.ctx{position:relative;margin-top:16px;width:900px;height:120px;overflow:hidden;border:1px solid rgba(216,180,106,.25)}.ctx img.bg{position:absolute;left:-200px;top:-260px;width:1300px;filter:brightness(.55) saturate(.7)}
.ctx .strip{position:absolute;left:30px;top:30px;display:flex;gap:16px}`;

(async () => {
  const b = await chromium.launch();
  const shoot = async (file, html, h = 600) => {
    const f = path.join(OUT, path.basename(file, '.png') + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: 960, height: h }, deviceScaleFactor: 2 });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: file, fullPage: true }); await p.close();
  };
  const icons = ICON_PLANS.map(([t, d, w, fn]) => `<div class="sec"><div class="t">${t}</div><div class="d">${d}</div><div class="w">${w}</div>
  <div class="row">${KINDS.map(k => `<div class="cell">${fn(k, 72)}${k[0]}</div>`).join('')}</div>
  <div class="ctx"><img class="bg" src="${img('bg-board-idle.png')}"><div class="strip">${KINDS.map((k, i) => fn(k, i >= 6 && i <= 7 ? 54 : 40)).join('')}</div></div></div>`).join('');
  await shoot(path.join(__dirname, 'style-S5-icons2.png'), `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  <div class="sec" style="padding-bottom:10px"><div class="t" style="font-size:20px">マスの絵（2回目）: 背景は刻印石、絵柄が全く違う3パターン</div><div class="d">上の列は大きく、下の帯は盤面に置いたときの実際の大きさ（中ボスとボスは大きめ）。</div></div>${icons}</body></html>`);
  await shoot(path.join(__dirname, 'style-S5-dice2.png'), `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  <div class="sec"><div class="t" style="font-size:20px">サイコロ（2回目）: 黒曜石の立方体。上の面を読む</div>
  <div class="d">見下ろす角度（上の面がいちばん大きく見える）。上の面の目だけ強く光らせ、手前と右の面の目は暗くした。向かいの面の和は 7。</div>
  <div class="w">弱点: 目の多い面（5・6）は上の面でも斜めになるので、小さく出すと数えにくい。盤面では 70 以上の大きさが要る。</div>
  <div class="row" style="gap:22px;margin-top:22px"><div class="cell">${dice(5, 150)}大きく（上が 5）</div>${[1, 2, 3, 4, 5, 6].map(n => `<div class="cell">${dice(n, 96)}上が ${n}</div>`).join('')}</div></div></body></html>`, 300);
  await b.close();
})();
