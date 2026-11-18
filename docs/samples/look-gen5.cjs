// 段階5の見本: すごろくの盤面の上の情報。違いのある3案（A 角 / B 帯 / C 柱）と、比べるための今の見た目
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen5.cjs [A|B|C|now]
// 下敷きは capture-board.mjs で実際のゲームから撮ったもの（bg-board-*.png、now-board-*.png、bg-board.json）
// 書き出し: style-S5-<案>.png、style-S5-now.png（4場面を1枚に並べたもの）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8"><link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/dela-gothic-one/400.css">${[400, 500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;
const INFO = JSON.parse(fs.readFileSync(path.join(__dirname, 'bg-board.json'), 'utf8'));

// ---- 中身（どの案も同じ） ----
const SCENES = {
  idle: { gate: '中ボスまで あと 22マス', hp: 72, dice: 0, label: '振る' },
  landed: { gate: '中ボスまで あと 24マス', hp: 72, dice: 1, label: '1 進んだ', msg: { head: 'モンスターのマス', main: '火トカゲ が現れた！', act: '戦う', color: '#d9534a', icon: 'mon' } },
  choose: { gate: '分かれ道', hp: 72, dice: 1, label: 'あと 1マス', prompt: '進む道を選ぶ' },
  cleared: { gate: '', hp: 72, dice: 0, label: '' },
};
const ITEMS = [['回復薬', 1], ['閃光弾', 0], ['チェインの実', 0]];   // [名前, 使用済み]
const GUIDE = {
  idle: [['○', 'サイコロ'], ['□', '先を見る'], ['△', 'マスの説明'], ['OPTIONS', 'メニュー']],
  landed: [['○', '戦う']],
  choose: [['十字', '選ぶ'], ['○', '決定'], ['□', '先を見る'], ['△', 'マスの説明']],
  cleared: [['○', '決定']],
};

const base = `*{box-sizing:border-box;margin:0;padding:0}
body{width:960px;height:540px;overflow:hidden;background:#000;font-family:'Noto Sans JP',sans-serif;font-weight:500;color:#fff;position:relative;--gold:#d8b46a;--ac:#ff4b1f;--sub:#cfc6b4;--dim:#8d8576;--off:#5c554a}
.abs{position:absolute}.d{font-family:'Dela Gothic One','Noto Sans JP'}.n{font-family:'Inter Display','Inter';font-variant-numeric:tabular-nums}
.bg{position:absolute;inset:0;width:960px;height:540px}
.sm{font-size:10px;letter-spacing:4px;color:var(--sub)}
.key{display:inline-flex;align-items:center;justify-content:center;height:18px;border:1px solid var(--gold);color:var(--gold);font:500 10px 'Inter';letter-spacing:2px;padding:0 5px 0 7px;margin:0 8px 0 18px}
.guide{position:absolute;font-size:11px;letter-spacing:2px;color:var(--sub);white-space:nowrap}
.corner{position:absolute;width:26px;height:26px;opacity:.7}
.piece{position:absolute;width:30px;height:30px;border-radius:50%;background:#f4f1ea;border:2px solid #1a1612;box-shadow:0 2px 6px rgba(0,0,0,.6),0 0 0 2px var(--gold)}
.piece::after{content:'';position:absolute;left:8px;top:8px;width:10px;height:10px;border-radius:50%;background:var(--gold)}
.herebox{position:absolute;border:2px solid var(--gold);box-shadow:0 0 14px rgba(216,180,106,.6)}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.72) 100%)}
.item{display:inline-block;font-size:11px;letter-spacing:2px;padding:3px 10px;border:1px solid rgba(216,180,106,.6);color:#fff;margin-right:6px;background:rgba(10,9,8,.6)}
.item.used{border-color:rgba(216,180,106,.2);color:var(--off)}
.dice{position:absolute;width:60px;height:60px;border:1px solid var(--gold);background:rgba(10,9,8,.88);box-shadow:0 0 18px rgba(216,180,106,.35)}
.dice .p{position:absolute;width:10px;height:10px;border-radius:50%;background:var(--gold);box-shadow:0 0 6px rgba(216,180,106,.8)}
.dice .q{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:300 30px 'Inter Display','Inter';color:var(--gold)}
.dlabel{position:absolute;font-size:11px;letter-spacing:3px;color:var(--gold);white-space:nowrap}
.fr{position:absolute;border:1px solid var(--gold);background:linear-gradient(180deg,rgba(20,17,14,.96),rgba(8,7,6,.97))}.fr2{position:absolute;border:1px solid rgba(216,180,106,.3)}
.sqi{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:8px}
.ring{position:relative;width:70px;height:70px;border-radius:50%;border:7px solid var(--gold);box-shadow:0 0 22px rgba(216,180,106,.55)}
.ring::after{content:'';position:absolute;left:21px;top:-15px;width:14px;height:14px;border-radius:50%;background:var(--ac);box-shadow:0 0 10px var(--ac)}`;
const corners = `<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div><div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;
const guide = (s, pos) => `<div class="guide" style="${pos}">${GUIDE[s].map(([k, t]) => `<span class="key">${k}</span>${t}`).join('')}</div>`;
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]] };
const dice = (n, x, y) => `<div class="dice" style="left:${x}px;top:${y}px">${n ? PIPS[n].map(([dx, dy]) => `<div class="p" style="left:${25 + dx * 15}px;top:${25 + dy * 15}px"></div>`).join('') : '<div class="q">?</div>'}</div>`;
const piece = s => { const i = INFO[s], G = i.G; return `<div class="herebox" style="left:${i.here.x - G / 2 + 2}px;top:${i.here.y - G / 2 + 2}px;width:${G - 4}px;height:${G - 4}px"></div><div class="piece" style="left:${i.piece.x - 15}px;top:${i.piece.y - 15}px"></div>`; };
/** 全体図（道・関所・いる場所）。金の濃淡だけで描く */
function minimap(s, w) {
  const i = INFO[s], k = w / i.size[0];
  const cells = i.board.map(([x, y, kind], j) => { const here = j === i.pos, gate = kind === 'boss' || (kind === 'mid' && !i.midDone);
    const r = here || gate ? 1.6 : 0; return `<rect x="${x * k - r}" y="${y * k - r}" width="${k * 0.8 + r * 2}" height="${k * 0.8 + r * 2}" fill="${here ? '#fff' : gate ? '#ff4b1f' : 'rgba(216,180,106,.55)'}"/>`; }).join('');
  return `<svg width="${w}" height="${w * i.size[1] / i.size[0]}" style="display:block">${cells}</svg>`;
}

const PLANS = {
  // A 角: 戦闘画面と同じ作り。四隅に文字だけを置き、枠は使わない。盤面を広く見せる。止まったマスの知らせは、結果・ポーズと同じ横の帯
  A: {
    name: 'A 角（直し: 右上は全体図だけ、WARNING、踏破は B の作り）',
    css: `.band{position:absolute;left:0;right:0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);background:linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.93) 30%,rgba(0,0,0,.93) 70%,rgba(0,0,0,.85))}
.band.warn{border-color:var(--ac);background:linear-gradient(90deg,rgba(40,6,2,.86),rgba(12,2,1,.94) 30%,rgba(12,2,1,.94) 70%,rgba(40,6,2,.86))}
.haz{position:absolute;left:0;right:0;height:6px;opacity:.85;background:repeating-linear-gradient(-45deg,var(--ac) 0 10px,transparent 10px 20px)}
.warnt{font:800 italic 36px/1 'Inter Display','Inter';letter-spacing:16px;color:var(--ac);text-shadow:0 0 18px rgba(255,75,31,.8),0 0 2px #fff}
.shade-tl{position:absolute;left:0;top:0;width:520px;height:200px;background:radial-gradient(ellipse at 0 0,rgba(0,0,0,.85),transparent 70%)}
.shade-bl{position:absolute;left:0;bottom:0;width:520px;height:200px;background:radial-gradient(ellipse at 0 100%,rgba(0,0,0,.88),transparent 70%)}
.shade-r{position:absolute;right:0;top:0;bottom:0;width:300px;background:linear-gradient(90deg,transparent,rgba(0,0,0,.7))}`,
    hud(s, c) {
      return `<div class="shade-tl"></div><div class="shade-bl"></div><div class="shade-r"></div>
<div class="abs d" style="left:40px;top:28px;font-size:28px;letter-spacing:4px">火の神殿</div>
<div class="abs sm" style="left:42px;top:76px;color:var(--gold)">${c.gate}</div>
<div class="abs" style="right:40px;top:30px;padding:6px;border:1px solid rgba(216,180,106,.35);background:rgba(10,9,8,.7)">${minimap(s, 120)}</div>
<div class="abs" style="left:40px;bottom:96px">${ITEMS.map(([n, u]) => `<span class="item ${u ? 'used' : ''}">${n}</span>`).join('')}</div>
<div class="abs sm" style="left:40px;bottom:66px">HP</div>
<div class="abs n" style="left:40px;bottom:24px;font-size:40px;line-height:1">${c.hp}<span style="font-size:14px;opacity:.6"> / 100</span></div>
<div class="abs" style="left:40px;bottom:14px;width:230px;height:3px;background:rgba(255,255,255,.18)"><div style="width:${c.hp}%;height:100%;background:var(--gold);box-shadow:0 0 8px var(--gold)"></div></div>
${dice(c.dice, 860, 380)}<div class="dlabel" style="right:40px;top:448px;width:200px;text-align:right">${c.label}</div>
${guide(s, 'right:40px;bottom:14px')}`;
    },
    idle() { return this.hud('idle', SCENES.idle) + corners; },
    // 敵が出た: 差し色の帯に「WARNING」。帯の上下の縁に、注意の斜めの縞
    landed() { const c = SCENES.landed, m = c.msg; return this.hud('landed', c) + `<div class="band warn" style="top:292px;height:80px"></div>
<div class="haz" style="top:286px"></div><div class="haz" style="top:372px"></div>
<div class="abs warnt" style="left:0;right:0;top:302px;text-align:center;font-size:30px">WARNING</div>
<div class="abs" style="left:0;right:0;top:342px;text-align:center;font-size:17px;letter-spacing:4px">${m.main}</div>` + corners; },
    choose() { const c = SCENES.choose; return this.hud('choose', c) + `<div class="abs" style="left:380px;top:96px;width:200px;text-align:center;padding:7px 0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);background:rgba(0,0,0,.8);font-size:13px;letter-spacing:5px;color:var(--gold)">${c.prompt}</div>` + corners; },
    // 踏破: B 案と同じく、報酬を真ん中に。左上の「踏破」は、名前より大きく、少し薄く、名前の末尾に少し重ねて、名前の後ろに置く
    cleared() { return `<div class="abs" style="inset:0;background:rgba(5,4,3,.68)"></div><div class="shade-tl"></div>
<div class="abs d" style="left:150px;top:6px;font-size:64px;letter-spacing:6px;color:var(--gold);opacity:.38;z-index:1">踏破</div>
<div class="abs d" style="left:40px;top:28px;font-size:28px;letter-spacing:4px;z-index:2;text-shadow:0 2px 10px rgba(0,0,0,.8)">火の神殿</div>
<div class="abs" style="left:0;right:0;top:150px;text-align:center"><div class="sm" style="color:var(--gold)">初回の踏破報酬</div><div style="display:flex;justify-content:center;margin-top:30px"><div class="ring"></div></div>
<div style="font-size:22px;letter-spacing:5px;margin-top:22px">炎の指輪</div><div style="font-size:12px;letter-spacing:1px;color:var(--sub);margin-top:10px">使い切りボーナスが +3 になる。</div></div>
${guide('cleared', 'right:40px;bottom:14px')}${corners}`; },
  },

  // B 帯: 上下に細い帯を置き、情報をまとめる。盤面の真ん中は何も重ねない。止まったマスの知らせは、下の帯の中に出す
  B: {
    name: 'B 帯（上下の細い帯に情報をまとめる）',
    css: `.top{position:absolute;left:0;right:0;top:0;height:58px;background:linear-gradient(180deg,rgba(0,0,0,.94),rgba(0,0,0,.86));border-bottom:1px solid var(--gold)}
.bot{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(0deg,rgba(0,0,0,.95),rgba(0,0,0,.86));border-top:1px solid var(--gold)}
.vl{position:absolute;width:1px;background:rgba(216,180,106,.4)}`,
    hud(s, c, msg = '') {
      return `<div class="top"></div><div class="bot"></div>
<div class="abs d" style="left:30px;top:13px;font-size:22px;letter-spacing:4px">火の神殿</div>
<div class="abs sm" style="left:170px;top:24px;color:var(--gold)">${c.gate}</div>
<div class="vl" style="left:400px;top:12px;height:34px"></div>
<div class="abs sm" style="left:424px;top:23px">HP</div><div class="abs n" style="left:456px;top:12px;font-size:26px;line-height:1">${c.hp}<span style="font-size:12px;opacity:.6"> / 100</span></div>
<div class="abs" style="left:424px;top:44px;width:150px;height:2px;background:rgba(255,255,255,.18)"><div style="width:${c.hp}%;height:100%;background:var(--gold)"></div></div>
<div class="vl" style="left:596px;top:12px;height:34px"></div>
<div class="abs" style="left:614px;top:17px">${ITEMS.map(([n, u]) => `<span class="item ${u ? 'used' : ''}" style="font-size:10px;padding:2px 7px;margin-right:4px">${n}</span>`).join('')}</div>
<div class="abs" style="right:30px;top:6px;text-align:right"><span class="n" style="font-size:20px;color:var(--gold)">310<span style="font-size:10px;margin-left:4px">G</span></span><div style="font-size:9px;letter-spacing:2px;color:var(--sub);margin-top:2px">火の欠片 ×2</div></div>
<div class="abs" style="left:24px;top:452px;padding:4px;border:1px solid rgba(216,180,106,.3)">${minimap(s, 76)}</div>
${msg}
${dice(c.dice, 860, 460)}<div class="dlabel" style="right:120px;top:484px">${c.label}</div>
${guide(s, 'right:120px;bottom:12px')}`;
    },
    idle() { return this.hud('idle', SCENES.idle); },
    landed() { const c = SCENES.landed, m = c.msg; return this.hud('landed', c, `<div class="abs" style="left:170px;top:458px;display:flex;align-items:center;gap:14px"><span class="sqi" style="background:${m.color};width:38px;height:38px"><img src="${img('bg-icon-mon.png')}" style="width:44px"></span>
<div><div class="sm" style="color:var(--gold)">${m.head}</div><div style="font-size:17px;letter-spacing:3px;margin-top:4px">${m.main}</div></div></div>`); },
    choose() { const c = SCENES.choose; return this.hud('choose', c, `<div class="abs" style="left:170px;top:470px;font-size:15px;letter-spacing:5px;color:var(--gold)">${c.prompt}</div>`); },
    cleared() { return `<div class="abs" style="inset:0;background:rgba(5,4,3,.65)"></div><div class="top"></div><div class="bot"></div>
<div class="abs d" style="left:30px;top:13px;font-size:22px;letter-spacing:4px">火の神殿</div><div class="abs sm" style="left:170px;top:24px;color:var(--gold)">踏破</div>
<div class="abs" style="left:0;right:0;top:150px;text-align:center"><div class="sm" style="color:var(--gold)">初回の踏破報酬</div><div style="display:flex;justify-content:center;margin-top:30px"><div class="ring"></div></div>
<div style="font-size:22px;letter-spacing:5px;margin-top:22px">炎の指輪</div><div style="font-size:12px;letter-spacing:1px;color:var(--sub);margin-top:10px">使い切りボーナスが +3 になる。</div></div>
<div class="abs" style="left:170px;top:470px;font-size:15px;letter-spacing:5px;color:var(--gold)">火の神殿を踏破した</div>
${guide('cleared', 'right:30px;bottom:12px')}`; },
  },

  // C 柱: メニューと同じ作り。左の柱に情報を縦に並べる（盤面のメニューを開いても柱の位置が変わらない）。止まったマスの知らせは、右下の金の枠
  C: {
    name: 'C 柱（メニューと同じ作り。左の柱に縦に並べる）',
    css: `.pil{position:absolute;left:0;top:0;bottom:0;width:230px;background:linear-gradient(180deg,rgba(20,17,14,.93),rgba(8,7,6,.95));border-right:1px solid var(--gold)}
.row{display:flex;justify-content:space-between;align-items:center;height:30px;border-bottom:1px solid rgba(216,180,106,.2);font-size:12px;letter-spacing:2px;color:#fff}
.row.used{color:var(--off)}`,
    hud(s, c) {
      return `<div class="pil"></div>
<div class="abs d" style="left:28px;top:30px;font-size:24px;letter-spacing:4px">火の神殿</div>
<div class="abs sm" style="left:30px;top:74px;color:var(--gold)">${c.gate}</div>
<div class="abs sm" style="left:30px;top:112px">HP</div>
<div class="abs n" style="left:30px;top:128px;font-size:40px;line-height:1">${c.hp}<span style="font-size:14px;opacity:.6"> / 100</span></div>
<div class="abs" style="left:30px;top:176px;width:170px;height:3px;background:rgba(255,255,255,.18)"><div style="width:${c.hp}%;height:100%;background:var(--gold);box-shadow:0 0 8px var(--gold)"></div></div>
<div class="abs sm" style="left:30px;top:204px">アイテム</div>
<div class="abs" style="left:30px;top:220px;width:170px">${ITEMS.map(([n, u]) => `<div class="row ${u ? 'used' : ''}">${n}<span style="font-size:9px;color:var(--off)">${u ? '使用済み' : ''}</span></div>`).join('')}</div>
<div class="abs sm" style="left:30px;top:330px">所持金</div>
<div class="abs n" style="left:30px;top:346px;font-size:22px">310<span style="font-size:11px;color:var(--sub);margin-left:5px">G</span></div>
<div class="abs" style="left:110px;top:352px;font-size:11px;letter-spacing:1px;color:var(--sub)">火の欠片 ×2</div>
<div class="abs" style="left:30px;top:394px;padding:5px;border:1px solid rgba(216,180,106,.3)">${minimap(s, 112)}</div>
${s === 'cleared' ? '' : `${dice(c.dice, 860, 390)}<div class="dlabel" style="right:40px;top:458px;width:200px;text-align:right">${c.label}</div>`}
${guide(s, 'right:40px;bottom:14px')}`;
    },
    idle() { return this.hud('idle', SCENES.idle) + corners; },
    landed() { const c = SCENES.landed, m = c.msg; return this.hud('landed', c) + `<div class="fr2" style="left:404px;top:344px;width:412px;height:122px"></div><div class="fr" style="left:410px;top:350px;width:400px;height:110px"></div>
<div class="abs" style="left:434px;top:372px;display:flex;align-items:center;gap:18px"><span class="sqi" style="background:${m.color}"><img src="${img('bg-icon-mon.png')}" style="width:52px"></span>
<div><div class="sm" style="color:var(--gold)">${m.head}</div><div style="font-size:19px;letter-spacing:3px;margin-top:6px">${m.main}</div></div></div>
<div class="abs" style="left:504px;top:426px;font-size:12px;letter-spacing:3px;color:var(--sub)"><span class="key" style="margin-left:0">○</span>${m.act}</div>` + corners; },
    choose() { const c = SCENES.choose; return this.hud('choose', c) + `<div class="abs" style="left:490px;top:30px;width:240px;text-align:center;padding:7px 0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);background:rgba(0,0,0,.82);font-size:13px;letter-spacing:5px;color:var(--gold)">${c.prompt}</div>` + corners; },
    cleared() { return this.hud('cleared', { ...SCENES.cleared, gate: '踏破' }).replace(guide('cleared', 'right:40px;bottom:14px'), '') + `<div class="abs" style="left:231px;top:0;right:0;bottom:0;background:rgba(5,4,3,.7)"></div>
<div class="fr2" style="left:369px;top:94px;width:462px;height:352px"></div><div class="fr" style="left:375px;top:100px;width:450px;height:340px"></div>
<div class="abs" style="left:375px;width:450px;top:126px;text-align:center"><div class="d" style="font-size:24px;letter-spacing:4px">火の神殿 踏破</div><div class="sm" style="color:var(--gold);margin-top:14px">初回の踏破報酬</div>
<div style="display:flex;justify-content:center;margin-top:26px"><div class="ring"></div></div><div style="font-size:20px;letter-spacing:4px;margin-top:20px">炎の指輪</div>
<div style="font-size:12px;color:var(--sub);margin-top:8px">使い切りボーナスが +3 になる。</div></div>
<div class="abs" style="left:508px;top:388px;width:184px;height:38px;border:1px solid var(--gold);background:linear-gradient(90deg,rgba(216,180,106,.32),rgba(216,180,106,.06));text-align:center;line-height:36px;font-size:14px;letter-spacing:4px">外に出る</div>
${guide('cleared', 'right:40px;bottom:14px')}${corners}`; },
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
  const label = { idle: 'サイコロを振る前', landed: 'マスに止まった（敵が出た）', choose: '分かれ道', cleared: '踏破' };
  const sheet = (name, title, parts) => shoot(path.join(__dirname, `style-S5-${name}.png`), `<!doctype html><html><head>${head}</head><body style="margin:0;background:#14110f;width:1960px;font:500 14px 'Noto Sans JP';color:#d8b46a;letter-spacing:2px">
<div style="padding:14px 20px 6px;font-size:18px">${title}</div>
<div style="display:grid;grid-template-columns:960px 960px;gap:30px 20px;padding:0 10px 20px 10px">${parts.map(([s, png]) => `<div><div style="margin:0 0 6px 4px">${label[s]}</div><img src="file://${png}" style="width:960px;height:540px;display:block"></div>`).join('')}</div></body></html>`, 1960, 1220, 1);
  const only = process.argv[2];
  if (!only || only === 'now') await sheet('now', '今の見た目（比べるため）', Object.keys(label).map(s => [s, path.resolve(__dirname, `now-board-${s}.png`)]));
  for (const [k, plan] of Object.entries(PLANS)) {
    if (only && only !== k) continue;
    const parts = [];
    for (const s of Object.keys(label)) {
      const png = path.join(OUT, `s5-${k}-${s}.png`);
      const body = `<img class="bg" src="${img(`bg-board-${s}.png`)}">${s === 'cleared' ? '' : piece(s)}<div class="vig"></div>${plan[s].call(plan)}`;
      await shoot(png, `<!doctype html><html><head>${head}<style>${base}${plan.css}</style></head><body>${body}</body></html>`);
      parts.push([s, png]);
    }
    await sheet(k, plan.name, parts);
  }
  await b.close();
})();
