// 段階2の見本: 結果（勝ち・負け）、ポーズ、再開のカウント。違いのある3案（A 枠 / B 帯 / C 全面）
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen3.cjs
//   下敷き: bg-hunt-golem.png、bg-dungeon-beast.png（実際のゲームから敵と背景だけを撮ったもの）と style-D6B-fight.png（戦闘中の画面まわりつき）
// 書き出し: style-S2-<案>.png（4画面を1枚に並べたもの）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const head = `<meta charset="utf-8"><link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/dela-gothic-one/400.css">${[300, 400, 500, 700].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;
const img = f => `file://${path.resolve(__dirname, f)}`;
const base = `*{box-sizing:border-box;margin:0;padding:0}
body{width:960px;height:540px;overflow:hidden;background:#000;font-family:'Noto Sans JP',sans-serif;font-weight:500;color:#fff;position:relative;--gold:#d8b46a;--ac:#ff4b1f;--sub:#cfc6b4}
.abs{position:absolute}.bg{position:absolute;inset:0;width:960px;height:540px}
.d{font-family:'Dela Gothic One','Noto Sans JP'}.n{font-family:'Inter Display','Inter';font-variant-numeric:tabular-nums}
.sm{font-size:10px;letter-spacing:4px;color:var(--sub)}
.key{display:inline-block;border:1px solid var(--gold);color:var(--gold);font:500 10px 'Inter';letter-spacing:2px;padding:2px 7px;margin:0 8px 0 22px}
.guide{position:absolute;right:40px;bottom:16px;font-size:11px;letter-spacing:2px;color:var(--sub)}
.corner{position:absolute;width:26px;height:26px;opacity:.7}
.rank{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--gold);border-radius:50%;color:var(--gold);font-family:'Inter Display','Inter';font-weight:300}
.best{display:inline-block;border:1px solid var(--gold);color:var(--gold);font-size:10px;letter-spacing:3px;padding:2px 10px}`;
const corners = `<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div><div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;

// 中身（どの案も同じ）
const WIN = { title: 'ゴーレム', verb: '討伐', time: '12.6', rank: 'S', best: true, rows: [['残りHP', '82'], ['最大ダメージ（1ターン）', '18'], ['戦利品', 'ゴーレムの欠片 ×1', 1]], choices: ['もう一度', '一覧に戻る'], sel: 1 };
const LOSE = { title: '敗北', rows: [['ゴーレム の残りHP', '46 / 120'], ['経過時間', '38.2 秒'], ['最大ダメージ（1ターン）', '12']], choices: ['もう一度', '一覧に戻る'], sel: 0 };
const PAUSE = { items: [['戦闘再開', ''], ['ダンジョンから出る', '敗北になる']], sel: 0 };
const guideR = t => `<div class="guide">${t}</div>`;
const G_RESULT = guideR('<span class="key">← →</span>選ぶ<span class="key">○</span>決定');
const G_PAUSE = guideR('<span class="key">↑ ↓</span>選ぶ<span class="key">○</span>決定<span class="key">✕</span>再開');

const PLANS = {
  // A 枠: 中央に金の二重の細い枠（行き先の右の枠と同じ作り）。一覧と同じ行の作りで、ほかの画面とそろえやすい
  A: {
    name: 'A 枠',
    css: `.dim{position:absolute;inset:0;background:rgba(5,4,3,.72)}
.fr{position:absolute;border:1px solid var(--gold);background:linear-gradient(180deg,rgba(20,17,14,.94),rgba(8,7,6,.96))}
.fr2{position:absolute;border:1px solid rgba(216,180,106,.3)}
.ttl{position:absolute;left:0;right:0;text-align:center}
.row{position:absolute;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(216,180,106,.2);padding:0 4px 8px;font-size:13px;letter-spacing:2px;color:var(--sub)}
.row b{font-weight:500;color:#fff;font-size:16px;letter-spacing:1px}.row b.g{color:var(--gold)}
.ch{position:absolute;height:40px;border:1px solid rgba(216,180,106,.35);text-align:center;line-height:38px;font-size:14px;letter-spacing:4px;color:var(--sub)}
.ch.on{border-color:var(--gold);background:linear-gradient(90deg,rgba(216,180,106,.32),rgba(216,180,106,.06));color:#fff}
.ch.on::before{content:'';position:absolute;left:-4px;top:16px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}`,
    win: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim"></div>
<div class="fr2" style="left:244px;top:58px;width:472px;height:436px"></div><div class="fr" style="left:250px;top:64px;width:460px;height:424px"></div>
<div class="ttl d" style="top:84px;font-size:26px;letter-spacing:4px">${WIN.title}<span style="font-family:'Noto Sans JP';font-weight:500;font-size:16px;letter-spacing:6px;color:var(--gold);margin-left:14px">${WIN.verb}</span></div>
<div class="abs sm" style="left:290px;top:152px">討伐タイム</div>
<div class="abs n" style="left:290px;top:168px;font-weight:300;font-size:56px;line-height:1">${WIN.time}<span style="font:500 13px 'Noto Sans JP';color:var(--sub);margin-left:6px">秒</span></div>
<div class="abs" style="left:290px;top:236px"><span class="best">自己ベスト更新</span></div>
<div class="abs rank" style="left:574px;top:150px;width:96px;height:96px;font-size:56px;box-shadow:0 0 24px rgba(216,180,106,.35)">${WIN.rank}</div>
${WIN.rows.map(([k, v, g], i) => `<div class="row" style="left:290px;width:380px;top:${284 + i * 36}px"><span>${k}</span><b class="${g ? 'g' : ''}">${v}</b></div>`).join('')}
${WIN.choices.map((c, i) => `<div class="ch ${i === WIN.sel ? 'on' : ''}" style="left:${290 + i * 196}px;top:420px;width:184px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    lose: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim" style="background:rgba(5,4,3,.8)"></div>
<div class="fr2" style="left:244px;top:98px;width:472px;height:356px"></div><div class="fr" style="left:250px;top:104px;width:460px;height:344px;border-color:var(--ac)"></div>
<div class="ttl d" style="top:128px;font-size:30px;letter-spacing:10px;color:var(--ac)">${LOSE.title}</div>
${LOSE.rows.map(([k, v], i) => `<div class="row" style="left:290px;width:380px;top:${206 + i * 40}px"><span>${k}</span><b>${v}</b></div>`).join('')}
${LOSE.choices.map((c, i) => `<div class="ch ${i === LOSE.sel ? 'on' : ''}" style="left:${290 + i * 196}px;top:374px;width:184px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    pause: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="dim" style="background:rgba(5,4,3,.66)"></div>
<div class="fr2" style="left:304px;top:164px;width:352px;height:212px"></div><div class="fr" style="left:310px;top:170px;width:340px;height:200px"></div>
<div class="ttl n" style="top:190px;font-weight:300;font-size:14px;letter-spacing:10px;color:var(--gold)">PAUSE</div>
${PAUSE.items.map(([c, note], i) => `<div class="ch ${i === PAUSE.sel ? 'on' : ''}" style="left:340px;top:${232 + i * 54}px;width:280px;text-align:left;padding-left:22px">${c}${note ? `<span style="position:absolute;right:12px;font-size:10px;letter-spacing:2px;color:var(--ac)">${note}</span>` : ''}</div>`).join('')}
${G_PAUSE}`,
    resume: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="dim" style="background:rgba(5,4,3,.4)"></div>
<div class="fr2" style="left:404px;top:206px;width:152px;height:128px"></div><div class="fr" style="left:410px;top:212px;width:140px;height:116px"></div>
<div class="ttl n" style="top:228px;font-weight:300;font-size:11px;letter-spacing:8px;color:var(--gold)">READY</div>
<div class="ttl n" style="top:248px;font-weight:300;font-size:52px;line-height:1">2.4</div>`,
  },

  // B 帯: 画面の横いっぱいの黒い帯（敵の名前の帯と同じ作り。斜めにはしない）。上下の戦闘が見えたまま。情報は横に並べる
  B: {
    name: 'B 帯',
    css: `.band{position:absolute;left:0;right:0;background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.9) 30%,rgba(0,0,0,.9) 70%,rgba(0,0,0,.6));border-top:1px solid var(--gold);border-bottom:1px solid var(--gold)}
.dim{position:absolute;inset:0;background:rgba(5,4,3,.45)}
.st{position:absolute;text-align:left}.st .k{font-size:10px;letter-spacing:4px;color:var(--sub)}.st .v{margin-top:6px;font-size:18px;letter-spacing:1px}.st .v.g{color:var(--gold)}
.vl{position:absolute;width:1px;background:rgba(216,180,106,.4)}
.ch{position:absolute;font-size:14px;letter-spacing:4px;color:#8d8576;padding-left:18px}
.ch.on{color:#fff}.ch.on::before{content:'';position:absolute;left:0;top:7px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}`,
    win: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim"></div>
<div class="band" style="top:150px;height:240px"></div>
<div class="abs d" style="left:60px;top:176px;font-size:30px;letter-spacing:4px">${WIN.title}<span style="font-family:'Noto Sans JP';font-weight:500;font-size:16px;letter-spacing:6px;color:var(--gold);margin-left:14px">${WIN.verb}</span></div>
<div class="abs sm" style="left:60px;top:240px">討伐タイム</div>
<div class="abs n" style="left:60px;top:254px;font-weight:300;font-size:80px;line-height:1">${WIN.time}<span style="font:500 14px 'Noto Sans JP';color:var(--sub);margin-left:8px">秒</span></div>
<div class="abs rank" style="left:330px;top:250px;width:84px;height:84px;font-size:48px;box-shadow:0 0 24px rgba(216,180,106,.35)">${WIN.rank}</div>
<div class="abs" style="left:60px;top:352px"><span class="best">自己ベスト更新</span></div>
<div class="vl" style="left:460px;top:180px;height:180px"></div>
${WIN.rows.map(([k, v, g], i) => `<div class="st" style="left:490px;top:${186 + i * 58}px"><div class="k">${k}</div><div class="v ${g ? 'g' : ''}">${v}</div></div>`).join('')}
<div class="vl" style="left:740px;top:180px;height:180px"></div>
${WIN.choices.map((c, i) => `<div class="ch ${i === WIN.sel ? 'on' : ''}" style="left:770px;top:${244 + i * 40}px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    lose: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim" style="background:rgba(5,4,3,.55)"></div>
<div class="band" style="top:170px;height:200px;border-color:var(--ac)"></div>
<div class="abs d" style="left:60px;top:228px;font-size:44px;letter-spacing:14px;color:var(--ac)">${LOSE.title}</div>
<div class="vl" style="left:300px;top:200px;height:140px"></div>
${LOSE.rows.map(([k, v], i) => `<div class="st" style="left:330px;top:${196 + i * 50}px"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
<div class="vl" style="left:740px;top:200px;height:140px"></div>
${LOSE.choices.map((c, i) => `<div class="ch ${i === LOSE.sel ? 'on' : ''}" style="left:770px;top:${244 + i * 40}px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    pause: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="dim" style="background:rgba(5,4,3,.55)"></div>
<div class="band" style="top:226px;height:88px"></div>
<div class="abs n" style="left:60px;top:254px;font-weight:300;font-size:26px;letter-spacing:14px;color:var(--gold)">PAUSE</div>
${PAUSE.items.map(([c, note], i) => `<div class="ch ${i === PAUSE.sel ? 'on' : ''}" style="left:${420 + i * 220}px;top:260px">${c}${note ? `<span style="display:block;margin-top:4px;font-size:10px;letter-spacing:2px;color:var(--ac)">${note}</span>` : ''}</div>`).join('')}
${guideR('<span class="key">← →</span>選ぶ<span class="key">○</span>決定<span class="key">✕</span>再開')}`,
    resume: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="dim" style="background:rgba(5,4,3,.3)"></div>
<div class="band" style="top:236px;height:68px"></div>
<div class="abs n" style="left:0;right:0;top:246px;text-align:center;font-weight:300;font-size:44px;line-height:1"><span style="font-size:11px;letter-spacing:8px;color:var(--gold);vertical-align:middle;margin-right:24px">READY</span>2.4</div>`,
  },

  // C 全面: 戦闘を暗く沈め、敵だけ光を残す。左の大きな余白に、大きく細い文字で組む。枠は使わない
  C: {
    name: 'C 全面',
    css: `.dim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,4,3,.97) 0%,rgba(5,4,3,.92) 55%,rgba(5,4,3,.35) 85%,rgba(5,4,3,.2))}
.row{position:absolute;display:flex;justify-content:space-between;align-items:baseline;padding-bottom:8px;border-bottom:1px solid rgba(216,180,106,.2);font-size:13px;letter-spacing:2px;color:var(--sub)}
.row b{font-weight:500;color:#fff;font-size:16px}.row b.g{color:var(--gold)}
.ch{position:absolute;font-size:16px;letter-spacing:6px;color:#8d8576;padding-left:22px}
.ch.on{color:#fff;font-size:20px}.ch.on::before{content:'';position:absolute;left:0;top:10px;width:8px;height:8px;background:var(--gold);transform:rotate(45deg)}
.ln{position:absolute;height:1px;background:linear-gradient(90deg,var(--gold),transparent)}`,
    win: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim"></div>
<div class="abs sm" style="left:60px;top:58px;color:var(--gold)">討伐</div>
<div class="abs d" style="left:60px;top:74px;font-size:46px;letter-spacing:6px">${WIN.title}</div>
<div class="ln" style="left:60px;top:150px;width:420px"></div>
<div class="abs sm" style="left:60px;top:172px">討伐タイム</div>
<div class="abs n" style="left:56px;top:186px;font-weight:300;font-size:112px;line-height:1;letter-spacing:-2px">${WIN.time}<span style="font:500 15px 'Noto Sans JP';color:var(--sub);margin-left:10px;letter-spacing:2px">秒</span></div>
<div class="abs rank" style="left:400px;top:196px;width:90px;height:90px;font-size:54px;box-shadow:0 0 24px rgba(216,180,106,.35)">${WIN.rank}</div>
<div class="abs" style="left:60px;top:310px"><span class="best">自己ベスト更新</span></div>
${WIN.rows.map(([k, v, g], i) => `<div class="row" style="left:60px;width:430px;top:${348 + i * 34}px"><span>${k}</span><b class="${g ? 'g' : ''}">${v}</b></div>`).join('')}
${WIN.choices.map((c, i) => `<div class="ch ${i === WIN.sel ? 'on' : ''}" style="left:${60 + i * 200}px;top:470px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    lose: () => `<img class="bg" src="${img('bg-hunt-golem.png')}"><div class="dim"></div>
<div class="abs d" style="left:60px;top:70px;font-size:72px;letter-spacing:20px;color:var(--ac)">${LOSE.title}</div>
<div class="ln" style="left:60px;top:186px;width:420px;background:linear-gradient(90deg,var(--ac),transparent)"></div>
${LOSE.rows.map(([k, v], i) => `<div class="row" style="left:60px;width:430px;top:${222 + i * 44}px"><span>${k}</span><b>${v}</b></div>`).join('')}
${LOSE.choices.map((c, i) => `<div class="ch ${i === LOSE.sel ? 'on' : ''}" style="left:${60 + i * 200}px;top:420px">${c}</div>`).join('')}
${corners}${G_RESULT}`,
    pause: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="dim"></div>
<div class="abs n" style="left:60px;top:150px;font-weight:300;font-size:64px;line-height:1;letter-spacing:16px;color:var(--gold)">PAUSE</div>
<div class="ln" style="left:60px;top:236px;width:360px"></div>
${PAUSE.items.map(([c, note], i) => `<div class="ch ${i === PAUSE.sel ? 'on' : ''}" style="left:60px;top:${266 + i * 52}px">${c}${note ? `<span style="margin-left:18px;font-size:10px;letter-spacing:2px;color:var(--ac)">${note}</span>` : ''}</div>`).join('')}
${G_PAUSE}`,
    resume: () => `<img class="bg" src="${img('style-D6B-fight.png')}"><div class="abs" style="inset:0;background:rgba(5,4,3,.68)"></div>
<div class="abs n" style="left:0;right:0;top:170px;text-align:center;font-weight:300;font-size:12px;letter-spacing:12px;color:var(--gold)">READY</div>
<div class="abs n" style="left:0;right:0;top:196px;text-align:center;font-weight:300;font-size:160px;line-height:1;text-shadow:0 0 40px rgba(216,180,106,.5)">2.4</div>`,
  },
};

(async () => {
  const b = await chromium.launch();
  const shoot = async (file, html, w = 960, h = 540, dpr = 2) => {
    const f = path.join(OUT, path.basename(file, '.png') + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    await p.screenshot({ path: file }); await p.close();
  };
  for (const [k, plan] of Object.entries(PLANS)) {
    if (process.argv[2] && process.argv[2] !== k) continue;
    const parts = [];
    for (const s of ['win', 'lose', 'pause', 'resume']) {
      const png = path.join(OUT, `s2-${k}-${s}.png`);
      await shoot(png, `<!doctype html><html><head>${head}<style>${base}${plan.css}</style></head><body>${plan[s]()}</body></html>`);
      parts.push([s, png]);
    }
    const label = { win: '結果（勝ち）', lose: '結果（負け）', pause: 'ポーズ', resume: '再開のカウント' };
    await shoot(path.join(__dirname, `style-S2-${k}.png`), `<!doctype html><html><head>${head}</head><body style="margin:0;background:#14110f;width:1960px;font:500 14px 'Noto Sans JP';color:#d8b46a;letter-spacing:2px">
<div style="padding:14px 20px 6px;font-size:18px">${plan.name}</div>
<div style="display:grid;grid-template-columns:960px 960px;gap:30px 20px;padding:0 10px 20px 10px">${parts.map(([s, png]) => `<div><div style="margin:0 0 6px 4px">${label[s]}</div><img src="file://${png}" style="width:960px;height:540px;display:block"></div>`).join('')}</div></body></html>`, 1960, 1220, 1);
  }
  await b.close();
})();
