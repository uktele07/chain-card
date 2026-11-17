// 段階4の見本: メニュー、装備、ショップ、カード編集。違いのある3案（A 一覧 / B 帯 / C 柱）
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen4.cjs [A|B|C]
// 書き出し: style-S4-<案>.png（4画面を1枚に並べたもの）。下敷きは style-menu-select.png（行き先）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8"><link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/dela-gothic-one/400.css">${[400, 500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;

// ---- 中身（どの案も同じ） ----
const MENU = [['装備', ''], ['カード編集', ''], ['ショップ', ''], ['設定', '準備中'], ['操作説明', ''], ['セーブリセット', ''], ['閉じる', '']];
const SLOTS = [['武器', '鉄の剣'], ['防具', '革の衣'], ['アクセサリ', 'なし'], ['アイテム 1', '回復薬'], ['アイテム 2', '閃光弾'], ['アイテム 3', 'チェインの実']];
const WEAPONS = [['鉄の剣', [1, 2, 3, 10], '装備中'], ['鉄の斧', [0, 3, 5, 20], ''], ['鉄の弓', [1, 1, 1, 10], '']];
const PICK = 1;   // 鉄の斧を選んでいる
const SHOP = [['武器', '鉄の斧', '購入済み'], ['武器', '鉄の弓', '200 G'], ['防具', '鋼の鎧', '300 G'], ['防具', '銀の胸当て', '500 G']];
const SHOP_PICK = 1;
const ATK = [['C', 1, 13], ['B', 2, 8], ['A', 3, 5], ['S', 10, 2]];
const SPELLS = [['x2', 'ダブル', 1], ['X', 'レベルX', 1], ['吸', 'ドレイン', 0], ['↑', 'ランクアップ', 0]];
const SPELL_PICK = 2;
const LOADOUT = [['武器', '鉄の剣'], ['防具', '革の衣'], ['アクセサリ', 'なし'], ['アイテム', '回復薬・閃光弾・チェインの実'], ['スペル', 'ダブル・レベルX'], ['所持金', '310 G']];

const base = `*{box-sizing:border-box;margin:0;padding:0}
body{width:960px;height:540px;overflow:hidden;background:#0b0a09;font-family:'Noto Sans JP',sans-serif;font-weight:500;color:#fff;position:relative;--gold:#d8b46a;--ac:#ff4b1f;--sub:#cfc6b4;--dim:#8d8576;--off:#5c554a}
.abs{position:absolute}.d{font-family:'Dela Gothic One','Noto Sans JP'}.n{font-family:'Inter Display','Inter';font-variant-numeric:tabular-nums}
.sm{position:absolute;font-size:10px;letter-spacing:4px;color:var(--sub)}
.key{display:inline-block;border:1px solid var(--gold);color:var(--gold);font:500 10px 'Inter';letter-spacing:2px;padding:2px 7px;margin:0 8px 0 22px}
.guide{position:absolute;right:40px;bottom:10px;padding:6px 0 6px 10px;background:#0b0a09;font-size:11px;letter-spacing:2px;color:var(--sub);white-space:nowrap}
.corner{position:absolute;width:26px;height:26px;opacity:.7}
.chips{display:inline-flex;gap:0;align-items:center}.chip{display:inline-flex;align-items:center;gap:6px;width:52px;font:300 16px/1 'Inter Display','Inter';font-variant-numeric:tabular-nums}
.chip b{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid rgba(216,180,106,.7);color:var(--gold);font:600 11px/1 'Inter Display','Inter';letter-spacing:0;text-box:trim-both cap alphabetic}
.chip span{min-width:18px}
.chips.old{opacity:.5}.up{color:var(--gold)}.down{color:var(--ac)}
.mk{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:1px solid var(--ac);color:var(--ac);font:600 13px/1 'Inter Display','Noto Sans JP';letter-spacing:0;flex:none;padding-top:2.6px}   /* 文字の画素の中心が 1.3 上にずれるので下げる（4倍で撮って測った） */
.mk.off{border-color:rgba(216,180,106,.35);color:var(--dim)}`;
const corners = `<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div><div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;
const guide = t => `<div class="guide">${t}</div>`;
const K = (k, t) => `<span class="key">${k}</span>${t}`;
/** 武器の威力の札。cmp を渡すと、上がる所を金、下がる所を差し色に */
const chips = (p, cls = '', cmp) => `<span class="chips ${cls}">${['C', 'B', 'A', 'S'].map((l, i) => `<span class="chip"><b>${l}</b><span class="${cmp ? (p[i] > cmp[i] ? 'up' : p[i] < cmp[i] ? 'down' : '') : ''}">${p[i]}</span></span>`).join('')}</span>`;
const weaponCompare = (x, y, w) => `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px">
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(216,180,106,.25)"><span style="font-size:13px;letter-spacing:2px;white-space:nowrap">${WEAPONS[PICK][0]}</span>${chips(WEAPONS[PICK][1], '', WEAPONS[0][1])}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px"><span style="font-size:11px;letter-spacing:1px;color:var(--dim);white-space:nowrap">現在: ${WEAPONS[0][0]}</span>${chips(WEAPONS[0][1], 'old')}</div>
  <div style="margin-top:14px;font-size:11px;letter-spacing:1px;line-height:1.7;color:var(--sub)">チェインを重ねた際の威力は絶大。しかし、攻撃毎に待機時間が発生。</div></div>`;

// 一覧の行（行き先と同じ作り）
const listCss = `.row{position:absolute;height:44px;border-bottom:1px solid rgba(216,180,106,.22);display:flex;align-items:center;padding:0 16px 0 22px;font-size:14px;letter-spacing:3px;color:var(--dim)}
.row.on{background:linear-gradient(90deg,rgba(216,180,106,.3),rgba(216,180,106,.04) 80%,transparent);border-bottom:1px solid var(--gold);border-top:1px solid rgba(216,180,106,.5);color:#fff;font-size:16px}
.row.on::before{content:'';position:absolute;left:-3px;top:18px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}
.row.dimsel{background:rgba(216,180,106,.1);color:var(--sub);border-bottom-color:rgba(216,180,106,.4)}
.row .r{margin-left:auto;font-size:12px;letter-spacing:2px;color:var(--sub)}.row.on .r{color:var(--gold)}.row .r.off{color:var(--off)}
.row.off{color:var(--off)}
.hd{position:absolute;font-size:10px;letter-spacing:4px;color:var(--gold)}
.fr{position:absolute;border:1px solid var(--gold);background:rgba(10,9,8,.6)}.fr2{position:absolute;border:1px solid rgba(216,180,106,.3)}.frl{position:absolute;width:3px;background:var(--ac);box-shadow:0 0 12px var(--ac)}`;
const rows = (list, x, y, w, sel, h = 44, cls = '') => list.map((r, i) => `<div class="row ${i === sel ? 'on' : ''} ${cls} ${r[2] === 'off' ? 'off' : ''}" style="left:${x}px;top:${y + i * h}px;width:${w}px;height:${h}px">${r[0]}${r[1] !== undefined ? `<span class="r ${r[3] || ''}">${r[1]}</span>` : ''}</div>`).join('');
const frame = (x, y, w, h, line = true) => `<div class="fr2" style="left:${x - 6}px;top:${y - 6}px;width:${w + 12}px;height:${h + 12}px"></div><div class="fr" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>${line ? `<div class="frl" style="left:${x}px;top:${y}px;height:${h}px"></div>` : ''}`;

const PLANS = {
  // A 一覧: 行き先の画面と同じ作り。左に金の細い線の一覧、右に金の二重の枠で中身と比べる物。題だけ極太
  A: {
    name: 'A 一覧（行き先と同じ作り）',
    css: listCss,
    menu: () => `<img class="abs" src="${img('style-menu-select.png')}" style="inset:0;width:960px;height:540px"><div class="abs" style="inset:0;background:rgba(5,4,3,.78)"></div>
${frame(330, 70, 300, 400, false)}
<div class="abs d" style="left:0;right:0;top:92px;text-align:center;font-size:24px;letter-spacing:6px">メニュー</div>
${rows(MENU.map(([m, n]) => [m, n, n ? 'off' : '', 'off']), 360, 150, 240, 0, 42)}
${guide(K('↑ ↓', '選ぶ') + K('○', '決定') + K('✕', '閉じる'))}`,
    equip: () => `<div class="abs d" style="left:40px;top:28px;font-size:30px;letter-spacing:4px">装備</div>${corners}
<div class="hd" style="left:40px;top:96px">装備</div>${rows(SLOTS.slice(0, 3).map(s => [s[0], s[1], '', s[1] === 'なし' ? 'off' : '']), 40, 114, 380, -1)}<div class="abs" style="left:40px;top:114px;width:380px;height:44px;border:1px solid var(--gold)"></div>
<div class="hd" style="left:40px;top:262px">アイテム（重複不可）</div>${rows(SLOTS.slice(3).map(s => [s[0], s[1]]), 40, 280, 380, -1)}
${frame(470, 60, 450, 426)}
<div class="hd" style="left:494px;top:80px">武器を選ぶ</div>
${rows(WEAPONS.map(w => [w[0], w[2]]), 494, 100, 402, PICK, 42)}
<div class="abs" style="left:494px;top:250px;font-size:18px;letter-spacing:3px">${WEAPONS[PICK][0]}</div>
${weaponCompare(494, 290, 402)}
${guide(K('↑ ↓', '選ぶ') + K('○', 'セット') + K('✕', 'やめる'))}`,
    shop: () => `<div class="abs d" style="left:40px;top:28px;font-size:30px;letter-spacing:4px">ショップ</div>${corners}
<div class="abs" style="left:40px;top:92px;font-size:14px;letter-spacing:4px;display:flex;gap:26px"><span style="padding:0 4px 8px;border-bottom:2px solid var(--gold)">買う</span><span style="color:var(--dim)">売る</span><span style="font-size:10px;color:var(--gold)">L1 / R1</span></div>
<div class="hd" style="left:40px;top:140px">武器</div>${rows(SHOP.slice(0, 2).map(s => [s[1], s[2], '', s[2] === '購入済み' ? 'off' : '']), 40, 158, 380, SHOP_PICK)}
<div class="hd" style="left:40px;top:262px">防具</div>${rows(SHOP.slice(2).map(s => [s[1], s[2]]), 40, 280, 380, -1)}
<div class="sm" style="left:40px;top:462px">所持金</div><div class="abs n" style="left:40px;top:478px;font-weight:500;font-size:26px">310<span style="font-size:12px;opacity:.6;margin-left:6px">G</span></div>
${frame(470, 60, 450, 426)}
<div class="abs" style="left:494px;top:84px;font-size:22px;letter-spacing:4px">鉄の弓</div><div class="abs n" style="right:64px;top:88px;font-size:20px;color:var(--gold)">200 G</div>
<div class="abs" style="left:494px;top:150px;width:402px">
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(216,180,106,.25)"><span style="font-size:13px;letter-spacing:2px;white-space:nowrap">鉄の弓</span>${chips([1, 1, 1, 10], '', [1, 2, 3, 10])}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px"><span style="font-size:11px;letter-spacing:1px;color:var(--dim);white-space:nowrap">現在: 鉄の剣</span>${chips([1, 2, 3, 10], 'old')}</div>
  <div style="margin-top:18px;font-size:11px;letter-spacing:1px;line-height:1.7;color:var(--sub)">威力は控えめだが、カード入れ替えが高速。</div>
  <div style="margin-top:130px;font-size:11px;letter-spacing:2px;color:var(--gold)">買った物は「装備」で着ける。</div></div>
${guide(K('↑ ↓', '選ぶ') + K('○', '買う') + K('✕', '戻る'))}`,
    deck: () => `<div class="abs d" style="left:40px;top:28px;font-size:30px;letter-spacing:4px">カード編集</div>${corners}
<div class="abs" style="right:40px;top:22px;font-size:12px;letter-spacing:2px;color:var(--sub)">デッキ <span class="n" style="font-size:18px;color:#fff">30</span> 枚　アタック 28　スペル 2</div>
<div class="hd" style="left:40px;top:96px">アタック（枚数は固定）</div>
${ATK.map(([l, p, n], i) => `<div class="row" style="left:40px;top:${114 + i * 44}px;width:380px;color:var(--sub)"><span class="mk" style="margin-right:14px;border-color:var(--gold);color:var(--gold);font-family:Inter">${l}</span>威力 ${p}<span class="r n" style="font-size:16px;color:#fff">× ${n}</span></div>`).join('')}
<div class="hd" style="left:40px;top:316px">威力のもと</div>${rows([['武器', '鉄の剣'], ['アクセサリ', 'なし', '', 'off']], 40, 334, 380, -1)}
${frame(470, 60, 450, 426)}
<div class="hd" style="left:494px;top:80px">スペル（重複不可）</div><div class="abs" style="right:64px;top:76px;font-size:11px;letter-spacing:2px;color:var(--gold)">2 / 2 枚</div>
${SPELLS.map(([m, n, on], i) => `<div class="row ${i === SPELL_PICK ? 'on' : ''}" style="left:494px;top:${100 + i * 46}px;width:402px;height:46px;${on ? 'color:#fff' : ''}"><span class="mk ${on ? '' : 'off'}" style="margin-right:14px">${m}</span>${n}<span class="r" style="${on ? 'color:var(--gold)' : 'color:var(--off)'}">${on ? '採用中' : '未採用'}</span></div>`).join('')}
<div class="abs" style="left:494px;top:310px;width:402px;padding-top:14px;border-top:1px solid rgba(216,180,106,.25);font-size:15px;letter-spacing:3px">ドレイン</div>
<div class="abs" style="left:494px;top:346px;width:402px;font-size:11px;letter-spacing:1px;line-height:1.7;color:var(--sub)">次に出すアタックで与えたダメージ分、HPを回復。<br>スペルの効果は、次に出すアタックに乗る。重ね掛け可。</div>
<div class="abs" style="left:494px;top:420px;font-size:11px;letter-spacing:2px;color:var(--ac)">2枚まで。入れるには、どれかを外す。</div>
${guide(K('↑ ↓', '選ぶ') + K('○', '入れる / 外す') + K('✕', '戻る'))}`,
  },

  // B 帯: 結果・ポーズと同じ作り。画面の横いっぱいの黒い帯を、金の縦線で列に分ける。題は帯の上に極太で
  B: {
    name: 'B 帯（結果・ポーズと同じ作り）',
    css: listCss + `.band{position:absolute;left:0;right:0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);background:linear-gradient(90deg,rgba(0,0,0,.88),rgba(0,0,0,.94) 30%,rgba(0,0,0,.94) 70%,rgba(0,0,0,.8))}
.vl{position:absolute;width:1px;background:rgba(216,180,106,.4)}
.ch{position:absolute;font-size:14px;letter-spacing:4px;color:var(--dim);padding-left:18px;white-space:nowrap}.ch.on{color:#fff}.ch.on::before{content:'';position:absolute;left:0;top:7px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}
.ch.off{color:var(--off)}.ch small{display:block;font-size:9px;letter-spacing:2px;color:var(--off);margin-top:3px}
.ttl{position:absolute;left:60px;font:400 30px/1 'Dela Gothic One';letter-spacing:4px}
.lb{position:absolute;font-size:12px;letter-spacing:3px;color:var(--dim)}.lb.on{color:#fff}.lb b{font-weight:500;color:var(--sub);margin-left:12px}`,
    menu: () => `<img class="abs" src="${img('style-menu-select.png')}" style="inset:0;width:960px;height:540px"><div class="abs" style="inset:0;background:rgba(5,4,3,.55)"></div>
<div class="band" style="top:200px;height:140px"></div>
<div class="ttl" style="top:254px;font-family:Inter;font-weight:700;font-size:20px;letter-spacing:10px;color:var(--gold)">MENU</div>
${MENU.slice(0, 6).map(([m, n], i) => `<div class="ch ${i === 0 ? 'on' : ''} ${n ? 'off' : ''}" style="left:${230 + (i % 3) * 210}px;top:${236 + Math.floor(i / 3) * 52}px">${m}${n ? `<small>${n}</small>` : ''}</div>`).join('')}
${guide(K('十字', '選ぶ') + K('○', '決定') + K('✕', '閉じる'))}`,
    equip: () => `<div class="ttl" style="top:40px">装備</div>${corners}
<div class="band" style="top:100px;height:380px"></div>
<div class="hd" style="left:60px;top:126px">装備</div>
${SLOTS.map(([k, v], i) => `<div class="lb ${i === 0 ? 'on' : ''}" style="left:60px;top:${150 + i * 44 + (i >= 3 ? 20 : 0)}px">${i === 0 ? '◆ ' : ''}${k}<b style="${v === 'なし' ? 'color:var(--off)' : ''}">${v}</b></div>`).join('')}
<div class="hd" style="left:60px;top:${150 + 3 * 44 + 2}px">アイテム（重複不可）</div>
<div class="vl" style="left:330px;top:126px;height:328px"></div>
<div class="hd" style="left:360px;top:126px">武器を選ぶ</div>
${WEAPONS.map(([n, , note], i) => `<div class="ch ${i === PICK ? 'on' : ''}" style="left:360px;top:${156 + i * 44}px">${n}${note ? `<span style="margin-left:14px;font-size:10px;letter-spacing:2px;color:var(--sub)">${note}</span>` : ''}</div>`).join('')}
<div class="vl" style="left:600px;top:126px;height:328px"></div>
<div class="abs" style="left:630px;top:124px;font-size:18px;letter-spacing:3px">${WEAPONS[PICK][0]}</div>
${weaponCompare(630, 168, 290)}
${guide(K('↑ ↓', '選ぶ') + K('○', 'セット') + K('✕', 'やめる'))}`,
    shop: () => `<div class="ttl" style="top:40px">ショップ</div>${corners}
<div class="abs" style="left:230px;top:50px;font-size:14px;letter-spacing:4px;display:flex;gap:26px"><span style="padding:0 4px 6px;border-bottom:2px solid var(--gold)">買う</span><span style="color:var(--dim)">売る</span><span style="font-size:10px;color:var(--gold)">L1 / R1</span></div>
<div class="abs n" style="right:60px;top:44px;font-size:22px">310<span style="font-size:11px;color:var(--sub);margin-left:6px">G</span></div>
<div class="band" style="top:100px;height:380px"></div>
${[['武器', 0], ['防具', 2]].map(([h, k]) => `<div class="hd" style="left:60px;top:${k ? 248 : 126}px">${h}</div>${SHOP.slice(k, k + 2).map((s, j) => `<div class="ch ${k + j === SHOP_PICK ? 'on' : ''} ${s[2] === '購入済み' ? 'off' : ''}" style="left:60px;top:${(k ? 272 : 150) + j * 44}px;width:250px">${s[1]}<span style="position:absolute;right:0;font-size:12px;letter-spacing:2px;color:${s[2] === '購入済み' ? 'var(--off)' : 'var(--gold)'}">${s[2]}</span></div>`).join('')}`).join('')}
<div class="vl" style="left:340px;top:126px;height:328px"></div>
<div class="abs" style="left:370px;top:124px;font-size:22px;letter-spacing:4px">鉄の弓</div><div class="abs n" style="left:560px;top:128px;font-size:18px;color:var(--gold)">200 G</div>
<div class="abs" style="left:370px;top:180px;width:520px">
  <div style="display:flex;gap:30px;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(216,180,106,.25)"><span style="width:130px;font-size:13px;letter-spacing:2px">鉄の弓</span>${chips([1, 1, 1, 10], '', [1, 2, 3, 10])}</div>
  <div style="display:flex;gap:30px;align-items:center;padding-top:10px"><span style="width:130px;font-size:12px;letter-spacing:2px;color:var(--dim)">現在: 鉄の剣</span>${chips([1, 2, 3, 10], 'old')}</div>
  <div style="margin-top:18px;font-size:11px;letter-spacing:1px;color:var(--sub)">威力は控えめだが、カード入れ替えが高速。</div>
  <div style="margin-top:80px;font-size:11px;letter-spacing:2px;color:var(--gold)">買った物は「装備」で着ける。</div></div>
${guide(K('↑ ↓', '選ぶ') + K('○', '買う') + K('✕', '戻る'))}`,
    deck: () => `<div class="ttl" style="top:40px">カード編集</div>${corners}
<div class="abs" style="right:60px;top:50px;font-size:12px;letter-spacing:2px;color:var(--sub)">デッキ <span class="n" style="font-size:18px;color:#fff">30</span> 枚　アタック 28　スペル 2 / 2</div>
<div class="band" style="top:100px;height:380px"></div>
<div class="hd" style="left:60px;top:126px">アタック（枚数は固定）</div>
${ATK.map(([l, p, n], i) => `<div class="lb" style="left:60px;top:${154 + i * 44}px;width:230px;color:var(--sub)"><span class="mk" style="margin-right:12px;border-color:var(--gold);color:var(--gold);font-family:Inter;vertical-align:middle">${l}</span>威力 ${p}<span class="n" style="position:absolute;right:0;top:4px;font-size:16px;color:#fff">× ${n}</span></div>`).join('')}
<div class="abs" style="left:60px;top:350px;font-size:11px;letter-spacing:2px;color:var(--sub)">威力のもと　<span style="color:#fff">鉄の剣</span>　アクセサリ <span style="color:var(--off)">なし</span></div>
<div class="vl" style="left:330px;top:126px;height:328px"></div>
<div class="hd" style="left:360px;top:126px">スペル（重複不可・2枚まで）</div>
${SPELLS.map(([m, n, on], i) => `<div class="ch ${i === SPELL_PICK ? 'on' : ''}" style="left:360px;top:${152 + i * 50}px;${on ? 'color:#fff' : ''}"><span class="mk ${on ? '' : 'off'}" style="margin-right:12px;vertical-align:middle">${m}</span>${n}<span style="margin-left:14px;font-size:10px;letter-spacing:2px;color:${on ? 'var(--gold)' : 'var(--off)'}">${on ? '採用中' : ''}</span></div>`).join('')}
<div class="vl" style="left:640px;top:126px;height:328px"></div>
<div class="abs" style="left:670px;top:124px;font-size:18px;letter-spacing:3px">ドレイン</div>
<div class="abs" style="left:670px;top:164px;width:250px;font-size:11px;letter-spacing:1px;line-height:1.8;color:var(--sub)">次に出すアタックで与えたダメージ分、HPを回復。<br><br>スペルの効果は、次に出すアタックに乗る。重ね掛け可。</div>
<div class="abs" style="left:670px;top:400px;width:250px;font-size:11px;letter-spacing:2px;color:var(--ac)">2枚まで。入れるには、どれかを外す。</div>
${guide(K('↑ ↓', '選ぶ') + K('○', '入れる / 外す') + K('✕', '戻る'))}`,
  },

  // C 柱: 左に金の細い線で区切った柱を立て、メニューの項目を縦に並べる。右側に、選んだ画面の中身をそのまま出す。メニューとその中身が1つの画面になる
  C: {
    name: 'C 柱（メニューと中身を1つに）',
    css: listCss + `.pil{position:absolute;left:0;top:0;bottom:0;width:230px;background:linear-gradient(180deg,rgba(20,17,14,.96),rgba(8,7,6,.98));border-right:1px solid var(--gold)}
.pil .t{position:absolute;left:30px;top:34px;font:700 13px 'Inter';letter-spacing:10px;color:var(--gold)}
.tab{position:absolute;left:0;width:229px;height:42px;padding-left:44px;line-height:42px;font-size:14px;letter-spacing:4px;color:var(--dim)}
.tab.on{color:#fff;background:linear-gradient(90deg,rgba(216,180,106,.3),transparent)}.tab.on::before{content:'';position:absolute;left:24px;top:17px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}
.tab.cur{color:var(--gold)}.tab.cur::after{content:'';position:absolute;right:-1px;top:8px;bottom:8px;width:3px;background:var(--gold)}
.tab.off{color:var(--off)}.tab small{font-size:9px;letter-spacing:2px;margin-left:10px}
.pg{position:absolute;left:270px;top:30px;font:400 28px/1.3 'Dela Gothic One';letter-spacing:4px}`,
    pillar: (active, focus) => `<div class="pil"><div class="t">MENU</div>${MENU.map(([m, n], i) => `<div class="tab ${focus && i === active ? 'on' : ''} ${!focus && i === active ? 'cur' : ''} ${n ? 'off' : ''}" style="top:${90 + i * 46}px">${m}${n ? `<small>${n}</small>` : ''}</div>`).join('')}
<div class="sm" style="left:30px;top:442px">所持金</div><div class="abs n" style="left:30px;top:458px;font-size:24px">310<span style="font-size:11px;color:var(--sub);margin-left:6px">G</span></div></div>`,
    menu: function () { return `${this.pillar(0, true)}${corners}
${guide(K('↑ ↓', '選ぶ') + K('○', '決定') + K('✕', '閉じる'))}`; },
    equip: function () { return `${this.pillar(0, false)}${corners}
<div class="pg">装備</div>
<div class="hd" style="left:270px;top:92px">装備</div>${rows(SLOTS.slice(0, 3).map(s => [s[0], s[1], '', s[1] === 'なし' ? 'off' : '']), 270, 110, 300, -1, 42, '')}
<div class="hd" style="left:270px;top:250px">アイテム（重複不可）</div>${rows(SLOTS.slice(3).map(s => [s[0], s[1]]), 270, 268, 300, -1, 42)}
<div class="abs" style="left:270px;top:110px;width:300px;height:42px;border:1px solid var(--gold)"></div>
<div class="vl" style="left:600px;top:92px;width:1px;height:380px;position:absolute;background:rgba(216,180,106,.4)"></div>
<div class="hd" style="left:630px;top:92px">武器一覧</div>
${rows(WEAPONS.map(w => [w[0], w[2]]), 630, 110, 290, PICK, 42)}
${weaponCompare(630, 262, 290)}
${guide(K('↑ ↓', '選ぶ') + K('○', 'セット') + K('✕', 'やめる'))}`; },
    shop: function () { return `${this.pillar(2, false)}${corners}
<div class="pg">ショップ</div>
<div class="abs" style="left:440px;top:44px;font-size:14px;letter-spacing:4px;display:flex;gap:26px"><span style="padding:0 4px 6px;border-bottom:2px solid var(--gold)">買う</span><span style="color:var(--dim)">売る</span><span style="font-size:10px;color:var(--gold)">L1 / R1</span></div>
<div class="hd" style="left:270px;top:100px">武器</div>${rows(SHOP.slice(0, 2).map(s => [s[1], s[2], '', s[2] === '購入済み' ? 'off' : '']), 270, 118, 300, SHOP_PICK)}
<div class="hd" style="left:270px;top:222px">防具</div>${rows(SHOP.slice(2).map(s => [s[1], s[2]]), 270, 240, 300, -1)}
<div class="abs" style="left:600px;top:100px;width:1px;height:372px;background:rgba(216,180,106,.4)"></div>
<div class="abs" style="left:630px;top:118px;width:290px">
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(216,180,106,.25)"><span style="font-size:13px;letter-spacing:2px;white-space:nowrap">鉄の弓</span>${chips([1, 1, 1, 10], '', [1, 2, 3, 10])}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px"><span style="font-size:11px;letter-spacing:1px;color:var(--dim);white-space:nowrap">現在: 鉄の剣</span>${chips([1, 2, 3, 10], 'old')}</div>
  <div style="margin-top:18px;font-size:11px;letter-spacing:1px;line-height:1.7;color:var(--sub)">威力は控えめだが、カード入れ替えが高速。</div></div>
${guide(K('↑ ↓', '選ぶ') + K('○', '買う') + K('✕', '戻る'))}`; },
    deck: function () { return `${this.pillar(1, false)}${corners}
<div class="pg">カード編集</div>
<div class="abs" style="left:470px;top:40px;font-size:12px;letter-spacing:2px;color:var(--sub)">デッキ <span class="n" style="font-size:18px;color:#fff">30</span> 枚</div>
<div class="hd" style="left:270px;top:92px">アタック（枚数は固定）</div>
${ATK.map(([l, p, n], i) => `<div class="row" style="left:270px;top:${110 + i * 42}px;width:300px;height:42px;color:var(--sub)"><span class="mk" style="margin-right:12px;border-color:var(--gold);color:var(--gold);font-family:Inter">${l}</span>威力 ${p}<span class="r n" style="font-size:16px;color:#fff">× ${n}</span></div>`).join('')}
<div class="abs" style="left:270px;top:300px;width:300px;font-size:11px;letter-spacing:2px;color:var(--sub);line-height:2">武器　　　　<span style="color:#fff">鉄の剣</span><br>アクセサリ　<span style="color:var(--off)">なし</span></div>
<div class="abs" style="left:600px;top:92px;width:1px;height:380px;background:rgba(216,180,106,.4)"></div>
<div class="hd" style="left:630px;top:92px">スペル（重複不可）</div><div class="abs" style="right:40px;top:70px;display:flex;align-items:baseline;gap:6px;color:var(--gold)"><span class="n" style="font-weight:500;font-size:36px;line-height:1;color:#fff;text-shadow:0 0 14px rgba(216,180,106,.55)">2</span><span class="n" style="font-weight:300;font-size:16px;letter-spacing:2px">/ 2</span><span style="font-size:10px;letter-spacing:2px">枚</span></div>
${SPELLS.map(([m, n, on], i) => `<div class="row ${i === SPELL_PICK ? 'on' : ''}" style="left:630px;top:${110 + i * 44}px;width:290px;${on ? 'color:#fff' : ''}"><span class="mk ${on ? '' : 'off'}" style="margin-right:12px">${m}</span>${n}<span class="r" style="color:${on ? 'var(--gold)' : 'var(--off)'}">${on ? '採用中' : ''}</span></div>`).join('')}
<div class="abs" style="left:630px;top:310px;width:290px;font-size:11px;letter-spacing:1px;line-height:1.8;color:var(--sub)">次に出すアタックで与えたダメージ分、HPを回復。<br>スペルの効果は、次に出すアタックに乗る。重ね掛け可。</div>
${guide(K('↑ ↓', '選ぶ') + K('○', '入れる / 外す') + K('✕', '戻る'))}`; },
  },
};

(async () => {
  const b = await chromium.launch();
  const shoot = async (file, html, w = 960, h = 540, dpr = 2) => {
    const f = path.join(OUT, path.basename(file, '.png') + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: file }); await p.close();
  };
  const label = { menu: 'メニュー', equip: '装備（武器を選んでいる）', shop: 'ショップ（買う）', deck: 'カード編集' };
  for (const [k, plan] of Object.entries(PLANS)) {
    if (process.argv[2] && process.argv[2] !== k) continue;
    const parts = [];
    for (const s of ['menu', 'equip', 'shop', 'deck']) {
      const png = path.join(OUT, `s4-${k}-${s}.png`);
      await shoot(png, `<!doctype html><html><head>${head}<style>${base}${plan.css}</style></head><body>${plan[s].call(plan)}</body></html>`);
      parts.push([s, png]);
    }
    await shoot(path.join(__dirname, `style-S4-${k}.png`), `<!doctype html><html><head>${head}</head><body style="margin:0;background:#14110f;width:1960px;font:500 14px 'Noto Sans JP';color:#d8b46a;letter-spacing:2px">
<div style="padding:14px 20px 6px;font-size:18px">${plan.name}</div>
<div style="display:grid;grid-template-columns:960px 960px;gap:30px 20px;padding:0 10px 20px 10px">${parts.map(([s, png]) => `<div><div style="margin:0 0 6px 4px">${label[s]}</div><img src="file://${png}" style="width:960px;height:540px;display:block"></div>`).join('')}</div></body></html>`, 1960, 1220, 1);
  }
  await b.close();
})();
