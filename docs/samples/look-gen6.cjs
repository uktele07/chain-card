// 盤面のマスの絵とサイコロの見本。それぞれ全く違う3パターン
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen6.cjs
// 書き出し: style-S5-icons.png（マスの絵）、style-S5-dice.png（サイコロ）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8">${[400, 500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;

// ---- マスの種類: 名前・色・記号（24×24 の線） ----
const KINDS = [
  ['monster', 'モンスター', '#d9534a', 'M5 3.5 8 9M19 3.5 16 9M6 12.5a6 6 0 1 0 12 0a6 6 0 1 0-12 0M9.5 12v.4M14.5 12v.4M10 16h4'],
  ['heal', '回復', '#4fae6a', 'M12 5v14M5 12h14'],
  ['maxhp', '最大HPアップ', '#e07ab0', 'M12 20C4.5 14.5 4 9 7.5 7.5 9.6 6.6 11.3 7.6 12 9.2 12.7 7.6 14.4 6.6 16.5 7.5 20 9 19.5 14.5 12 20ZM12 15.5v-5M9.8 12.6 12 10.4l2.2 2.2'],
  ['item', 'アイテム', '#3fb7c9', 'M9.5 3.5h5M10.5 3.5v5L6.8 15.2A3.4 3.4 0 0 0 9.8 20.5h4.4a3.4 3.4 0 0 0 3-5.3L13.5 8.5v-5M8.2 14.5h7.6'],
  ['event', 'イベント', '#f2a23a', 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4.5 3-6.5.3 2 1.2 3.2 2.3 3.4C11 8.5 11 6 12 3Z'],
  ['random', 'ランダム', '#9b7be0', 'M8.8 9.2a3.2 3.2 0 1 1 4.6 2.9c-1 .5-1.4 1.3-1.4 2.6M12 18.2v.4'],
  ['mid', '中ボス', '#c8453c', 'M3.5 3 7.5 9.5M20.5 3l-4 6.5M5.5 13a6.5 6.5 0 0 1 13 0v3.5h-2V20h-9v-3.5h-2ZM9 13.2h1.4M13.6 13.2H15M10.5 20v-2M13.5 20v-2'],
  ['boss', 'ボス', '#ff5a4a', 'M4.5 4.5 7.5 8 12 3l4.5 5 3-3.5V10h-15ZM6 12.5h12V16l-2 4H8l-2-4ZM9.2 15h1.3M13.5 15h1.3'],
  ['start', '入口', '#8a93a3', 'M5.5 20.5V10.5a6.5 6.5 0 0 1 13 0v10M3.5 20.5h17M12 4v16.5'],
];

// A 金の線画: 暗い板に、金の細い線の記号。種類の色は、記号の淡い光と下の細い線だけ
function tileLine([, , col, d], size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs><radialGradient id="g${col.slice(1)}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
  <rect x="1" y="1" width="46" height="46" rx="3" fill="#15110d"/><rect x="1" y="1" width="46" height="46" rx="3" fill="url(#g${col.slice(1)})"/>
  <rect x="1.5" y="1.5" width="45" height="45" rx="3" fill="none" stroke="#d8b46a" stroke-opacity=".75"/>
  <rect x="4" y="4" width="40" height="40" rx="2" fill="none" stroke="#d8b46a" stroke-opacity=".2"/>
  <line x1="14" y1="42.5" x2="34" y2="42.5" stroke="${col}" stroke-width="1.5"/>
  <g transform="translate(12 11)" fill="none" stroke="#e6c886" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 3px ${col})"><path d="${d}"/></g></svg>`;
}
// B 宝石: 種類の色の、つやのある板。白い太い記号。上に光の反射、下に影
function tileGem([, , col, d], size) {
  const id = 'm' + col.slice(1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs><linearGradient id="b${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".55"/></linearGradient>
  <linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <rect x="2" y="4" width="44" height="42" rx="10" fill="#000" opacity=".45"/>
  <rect x="2" y="2" width="44" height="42" rx="10" fill="#0e0b09"/><rect x="2" y="2" width="44" height="42" rx="10" fill="url(#b${id})"/>
  <rect x="2.5" y="2.5" width="43" height="41" rx="9.5" fill="none" stroke="#fff" stroke-opacity=".35"/>
  <path d="M7 6h34a5 5 0 0 1 5 5v5C34 22 14 22 2 15v-4a5 5 0 0 1 5-5Z" fill="url(#h${id})"/>
  <g transform="translate(12 10)" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" transform="translate(0 1.4)"/></g>
  <g transform="translate(12 10)" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g></svg>`;
}
// C 刻印石: ざらついた石の板に、溝を彫った記号。溝の奥が種類の色で光る（熾火のよう）
function tileStone([, , col, d], size) {
  const id = 's' + col.slice(1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs><filter id="n${id}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a423b"/><stop offset="1" stop-color="#26211d"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l${id})"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n${id})" opacity=".5"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="#000" stroke-opacity=".6"/><path d="M5 4.5h38" stroke="#fff" stroke-opacity=".18"/>
  <g transform="translate(12 11)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${d}" stroke="#0a0806" stroke-width="3.6"/>
    <path d="${d}" stroke="${col}" stroke-width="1.6" style="filter:drop-shadow(0 0 2.5px ${col}) drop-shadow(0 0 5px ${col})"/>
    <path d="${d}" stroke="#fff" stroke-opacity=".35" stroke-width=".6" transform="translate(-.6 -.6)"/></g></svg>`;
}
const ICON_PLANS = [
  ['A 金の線画', '暗い板に金の細い線。画面まわりの金の線と同じ調子。種類の色は、記号の淡い光と下の細い線だけ。', '弱点: 色の手がかりが弱く、遠目には種類の見分けがつきにくい。', tileLine],
  ['B 宝石', '種類の色のつやのある板に、白い太い記号。いちばんゲームらしく、ひと目で見分けやすい。', '弱点: 明るく色が強いので、暗く静かな全体の調子から浮く（今の盤面に近い）。', tileGem],
  ['C 刻印石', '石の板に彫った溝が、種類の色で熾火のように光る。神殿の床になじむ。', '弱点: 小さく表示すると溝が細くつぶれやすい。石の質感は描き込みが要る。', tileStone],
];

// ---- サイコロ ----
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
// A 金の枠: 二重の金の細い枠、四隅に小さなかぎ。目は金の光る点
function diceLine(n, size) {
  const s = size, p = s * 0.22, r = s * 0.075;
  return `<div style="position:relative;width:${s}px;height:${s}px;background:radial-gradient(circle at 50% 40%,#211b14,#0b0908);border:1px solid #d8b46a;box-shadow:0 0 ${s * .3}px rgba(216,180,106,.35),inset 0 0 ${s * .2}px rgba(216,180,106,.15)">
  <div style="position:absolute;inset:${s * .06}px;border:1px solid rgba(216,180,106,.3)"></div>
  ${n ? PIPS[n].map(([x, y]) => `<div style="position:absolute;left:${s / 2 + x * p - r}px;top:${s / 2 + y * p - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${n === 1 ? '#ff4b1f' : '#e6c886'};box-shadow:0 0 ${r * 1.5}px ${n === 1 ? '#ff4b1f' : '#d8b46a'}"></div>`).join('') : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:300 ${s * .5}px 'Inter Display';color:#d8b46a">?</div>`}</div>`;
}
// B 象牙の立体: 3つの面が見える立方体。角は丸く、1の目だけ赤
function diceCube(n, size) {
  const s = size * 0.7, face = (k, tf, shade) => `<div style="position:absolute;width:${s}px;height:${s}px;transform:${tf};border-radius:${s * .18}px;background:linear-gradient(145deg,#fffaf0,#e6dccb);box-shadow:inset 0 0 ${s * .15}px rgba(120,90,50,${shade}),inset 0 0 0 1px rgba(0,0,0,.12)">
    ${PIPS[k].map(([x, y]) => `<div style="position:absolute;left:${s / 2 + x * s * .25 - s * (k === 1 ? .11 : .075)}px;top:${s / 2 + y * s * .25 - s * (k === 1 ? .11 : .075)}px;width:${s * (k === 1 ? .22 : .15)}px;height:${s * (k === 1 ? .22 : .15)}px;border-radius:50%;background:${k === 1 ? 'radial-gradient(circle at 35% 35%,#ff6a4a,#b0160a)' : 'radial-gradient(circle at 35% 35%,#3a3430,#0c0a09)'};box-shadow:inset 0 1px 2px rgba(0,0,0,.6)"></div>`).join('')}</div>`;
  const top = n ? (n % 6) + 1 : 3, side = n ? ((n + 1) % 6) + 1 : 5;
  return `<div style="position:relative;width:${size}px;height:${size}px;perspective:${size * 6}px">
  <div style="position:absolute;left:${(size - s) / 2}px;top:${(size - s) / 2 + size * .05}px;width:${s}px;height:${s}px;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(-36deg)">
    ${face(n || 1, `translateZ(${s / 2}px)`, .25)}${face(top, `rotateX(90deg) translateZ(${s / 2}px)`, .1)}${face(side, `rotateY(90deg) translateZ(${s / 2}px)`, .45)}</div>
  <div style="position:absolute;left:15%;right:15%;bottom:2%;height:10%;border-radius:50%;background:rgba(0,0,0,.45);filter:blur(${size * .04}px)"></div></div>`;
}
// C 黒曜石: 黒いつやのある塊。面取りの光と、熾火のように光る目
function diceObsidian(n, size) {
  const s = size, p = s * 0.22, r = s * 0.08;
  return `<div style="position:relative;width:${s}px;height:${s}px;border-radius:${s * .2}px;background:linear-gradient(150deg,#3b3632 0%,#0c0a09 45%,#050404 100%);box-shadow:0 ${s * .08}px ${s * .2}px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.35),inset 0 -${s * .06}px ${s * .12}px rgba(255,120,40,.12)">
  <div style="position:absolute;left:8%;top:6%;width:60%;height:28%;border-radius:${s * .2}px ${s * .2}px 50% 50%;background:linear-gradient(180deg,rgba(255,255,255,.22),transparent)"></div>
  ${n ? PIPS[n].map(([x, y]) => `<div style="position:absolute;left:${s / 2 + x * p - r}px;top:${s / 2 + y * p - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle,#fff3c0 0%,#ffb23a 35%,#ff4b1f 70%,#3a0a02 100%);box-shadow:0 0 ${r * 2}px #ff6a1f,inset 0 0 ${r * .6}px rgba(0,0,0,.4)"></div>`).join('') : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:300 ${s * .5}px 'Inter Display';color:#ff8a3a;text-shadow:0 0 12px #ff4b1f">?</div>`}</div>`;
}
const DICE_PLANS = [
  ['A 金の枠', '二重の金の細い枠に、光る金の目（1だけ差し色）。画面まわりと同じ調子で、いちばん静か。', '弱点: 平らで、「振っている」感じが出にくい。転がる動きを足す必要がある。', diceLine],
  ['B 象牙の立体', '3つの面が見える立方体。手に取れそうな実物らしさ。1の目だけ赤。', '弱点: 盤面の中で唯一の立体になり、ほかの平らな絵から浮く。回す動きは作り込みが要る。', diceCube],
  ['C 黒曜石', '黒いつやの塊に、熾火のように光る目。火の神殿に合う。暗い画面でも目がよく見える。', '弱点: ダンジョンごとに目の色を変えたくなる（水の神殿なら青）。光が強く、ほかの金と喧嘩しやすい。', diceObsidian],
];

const css = `*{box-sizing:border-box;margin:0;padding:0}body{background:#14110f;color:#d8b46a;font-family:'Noto Sans JP';font-weight:500;letter-spacing:2px}
.sec{padding:20px 24px 26px;border-bottom:1px solid rgba(216,180,106,.2)}.t{font-size:18px}.d{font-size:12px;color:#cfc6b4;margin-top:6px;letter-spacing:1px}.w{font-size:12px;color:#ff8a6a;margin-top:2px;letter-spacing:1px}
.row{display:flex;gap:18px;align-items:flex-end;margin-top:16px}.cell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10px;color:#cfc6b4;letter-spacing:1px}
.ctx{position:relative;margin-top:16px;width:900px;height:120px;overflow:hidden;border:1px solid rgba(216,180,106,.25)}.ctx img.bg{position:absolute;left:-200px;top:-260px;width:1300px;filter:brightness(.55) saturate(.7)}
.ctx .strip{position:absolute;left:30px;top:30px;display:flex;gap:16px}`;

(async () => {
  const b = await chromium.launch();
  const shoot = async (file, html, w, h) => {
    const f = path.join(OUT, path.basename(file, '.png') + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: file, fullPage: true }); await p.close();
  };
  // マスの絵: 案ごとに、大きく（72）並べた列と、盤面に置いた実際の大きさ（38〜54）
  const icons = ICON_PLANS.map(([t, d, w, fn]) => `<div class="sec"><div class="t">${t}</div><div class="d">${d}</div><div class="w">${w}</div>
  <div class="row">${KINDS.map(k => `<div class="cell">${fn(k, 72)}${k[1]}</div>`).join('')}</div>
  <div class="ctx"><img class="bg" src="${img('bg-board-idle.png')}"><div class="strip">${KINDS.map((k, i) => fn(k, i >= 6 && i <= 7 ? 54 : 40)).join('')}</div></div></div>`).join('');
  await shoot(path.join(__dirname, 'style-S5-icons.png'), `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  <div class="sec" style="padding-bottom:10px"><div class="t" style="font-size:20px">マスの絵（3パターン）</div><div class="d">上の列は大きく、下の帯は盤面に置いたときの実際の大きさ（中ボスとボスは大きめ）。</div></div>${icons}</body></html>`, 960, 600);
  // サイコロ: 案ごとに、大きく（96）、1〜6の目（60）、振る前（?）
  const dice = DICE_PLANS.map(([t, d, w, fn]) => `<div class="sec"><div class="t">${t}</div><div class="d">${d}</div><div class="w">${w}</div>
  <div class="row" style="gap:26px">${`<div class="cell">${fn(5, 110)}大きく</div>`}${[1, 2, 3, 4, 5, 6].map(n => `<div class="cell">${fn(n, 60)}${n}</div>`).join('')}<div class="cell">${fn(0, 60)}振る前</div></div></div>`).join('');
  await shoot(path.join(__dirname, 'style-S5-dice.png'), `<!doctype html><html><head>${head}<style>${css}</style></head><body style="width:960px">
  <div class="sec" style="padding-bottom:10px"><div class="t" style="font-size:20px">サイコロ（3パターン）</div></div>${dice}</body></html>`, 960, 600);
  await b.close();
})();
