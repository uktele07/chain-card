// 戦闘画面の見本（配置は6版で確定）。絵作りの方針を3つ、まったく違う方向で出す。
// 使い方: FONTS=<@fontsource を入れた場所> node docs/samples/look-gen2.cjs   （先に npm run page が必要）
const { chromium } = require('playwright');
const fs = require('fs');
const FONTS = process.env.FONTS || __dirname, OUT = process.env.OUT || __dirname;
const AC = '#ff4b1f', AC2 = '#ffb23a';
const CX = 480, CY = 368;

// アイテムの「リボルバー」: 上が選択中。下の段ほど左へずれ、小さく暗くなる。p は回転の進み（0→1 で A が後ろを通って最下段へ）
function revolver(p, x0 = 28, y0 = 214, gold = false) {
  const slot = [{ x: 0, y: 0, w: 204, h: 38, fs: 14, a: 1 }, { x: -9, y: 43, w: 190, h: 32, fs: 12.5, a: 0.8 }, { x: -18, y: 80, w: 174, h: 26, fs: 11, a: 0.6 }];
  const mix = (a, b, t) => a + (b - a) * t, e = t => t * t * (3 - 2 * t), q = e(p);
  const at = (from, to, back) => { const s = {}; for (const k of Object.keys(slot[0])) s[k] = mix(slot[from][k], slot[to][k], q); if (back) { const b = Math.sin(Math.PI * q); s.x -= 34 * b; s.a *= 1 - 0.75 * b; s.w -= 30 * b; } return s; };
  const rows = [['回復薬', at(0, 2, true), p > 0.02 ? 0 : 3], ['閃光弾', at(1, 0), 2], ['チェインの実', at(2, 1), 1]];
  return `<div class="abs sm" style="left:${x0}px;top:${y0 - 22}px">アイテム</div>` + rows.map(([n, s, z], i) => {
    const sel = (i === 0 && p < 0.5) || (i === 1 && p >= 0.5), k = i === 0 ? 1 - q : i === 1 ? q : 0;   // k: 選択中の見た目の濃さ
    if (gold) return `<div class="rv" style="left:${x0 + s.x}px;top:${y0 + s.y}px;width:${s.w}px;height:${s.h}px;line-height:${s.h}px;font-size:${s.fs}px;letter-spacing:2px;opacity:${s.a};z-index:${z};background:linear-gradient(90deg,rgba(216,180,106,${mix(0.1, 0.42, k)}),rgba(20,17,14,${mix(0.85, 0.7, k)}) 85%);color:${k > 0.5 ? '#fff' : '#cfc6b4'};border:1px solid rgba(216,180,106,${mix(0.3, 1, k)});border-left:${mix(2, 4, k)}px solid #d8b46a;box-shadow:0 6px 14px rgba(0,0,0,.5)${k > 0.5 ? ',0 0 16px rgba(216,180,106,.3)' : ''}">${n}${sel && (p < 0.05 || p > 0.95) ? `<span style="position:absolute;right:10px;font:500 10px 'Inter';letter-spacing:2px;color:#d8b46a">R2</span>` : ''}</div>`;
    return `<div class="rv" style="left:${x0 + s.x}px;top:${y0 + s.y}px;width:${s.w}px;height:${s.h}px;line-height:${s.h}px;font-size:${s.fs}px;opacity:${s.a};z-index:${z};background:rgba(${mix(18, 244, k)},${mix(16, 244, k)},${mix(14, 242, k)},${mix(0.82, 1, k)});color:${k > 0.5 ? '#111' : '#eee'};border-left:${mix(2, 4, k)}px solid ${k > 0.5 ? AC : 'rgba(255,255,255,.5)'}">${n}${sel && (p < 0.05 || p > 0.95) ? `<span style="position:absolute;right:10px;font-size:11px;color:${AC};font-weight:900">R2</span>` : ''}</div>`;
  }).join('');
}

const base = `*{box-sizing:border-box;margin:0;padding:0}
body{width:960px;height:540px;overflow:hidden;background:#000;font-family:'Noto Sans JP',sans-serif;color:#fff;--ac:${AC};--ac2:${AC2};position:relative}
.abs{position:absolute}.d{font-family:'Dela Gothic One','Noto Sans JP'}
.sm{font-size:11px;font-weight:500;letter-spacing:2px;opacity:.75}
.num{font:800 italic 40px/1 'Inter Display','Inter'}
.rv{position:absolute;font-weight:500;padding-left:14px;white-space:nowrap}
.c{position:absolute;width:82px;height:92px}
.c .lv{position:absolute;left:0;right:0;top:11px;text-align:center;font:900 49px/1 'Inter Display','Inter'}
.c .pw{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:10px;font-weight:500;letter-spacing:1px}
.c .gl{position:absolute;left:6px;top:4px;font-size:11px;opacity:.75}`;

// 6版の配置。見た目は CSS のクラスで差し替える
function layout(o) {
  const k = o.scale || 1;
  const card = (dx, dy, lv, pw, gl, cls) => o.start ? `<div class="c off q" style="left:${CX + dx * k - 41}px;top:${CY + dy * k - 46}px;transform:rotate(${o.tilt ? o.tilt[cls === 'sp' ? 0 : cls === 'off' ? 1 : lv === 'B' ? 2 : 3] : 0}deg) scale(${k})"><div class="lv">?</div><div class="gl">${gl}</div></div>` : `<div class="c ${cls}" style="left:${CX + dx * k - 41}px;top:${CY + dy * k - 46}px;transform:rotate(${o.tilt ? o.tilt[cls === 'sp' ? 0 : cls === 'off' ? 1 : lv === 'B' ? 2 : 3] : 0}deg) scale(${k})"><div class="lv">${lv}</div><div class="pw">${pw}</div><div class="gl">${gl}</div></div>`;
  return `
<div class="abs band" style="right:-30px;top:24px;width:316px;height:52px;transform:skewX(-12deg)"></div>
<div class="abs sm boss" style="right:118px;top:48px">BOSS</div>
<div class="abs d name" style="right:30px;top:24px;font-size:34px;line-height:52px">炎獣</div>
<div class="abs sm" style="right:30px;top:84px">HP</div>
<div class="abs num" style="right:30px;top:102px">71<span class="of"> / 110</span></div>
<div class="abs bar" style="right:30px;top:148px;width:230px"><div class="fill ehp" style="width:64%"></div></div>

<div class="abs" style="left:${CX - 190}px;top:86px;width:380px;display:flex;align-items:flex-end;justify-content:center;gap:14px">
  <span class="next">NEXT</span><span class="atk">爪</span>
  <span class="dmg">5<span class="unit">ダメージ</span></span><span class="sep"></span>
  <span class="sec">3.5<span class="unit">秒</span></span>
</div>
<div class="abs gauge" style="left:${CX - 170}px;top:144px;width:340px"><div style="width:${o.start ? 0 : 30}%;height:100%" class="gfill"></div></div>

${card(0, -100, 'B', '威力 2', '△', 'on')}${card(109, 0, 'C', '威力 1', '○', 'on')}${card(0, 100, 'S', '威力 10', '✕', 'off')}${card(-109, 0, 'X', 'レベルX', '□', 'sp')}
<div class="abs chain${o.start ? ' st' : ''}" style="left:${CX - 32}px;top:${CY - 32}px;width:64px;height:64px;transform:rotate(45deg) scale(${k})"></div>
${o.start ? `<div class="abs chs" style="left:${CX - 32}px;top:${CY - 20}px;width:64px;text-align:center;font:500 8px 'Inter';letter-spacing:3px">START</div>
<div class="abs chl" style="left:${CX - 32}px;top:${CY - 8}px;width:64px;text-align:center;font:300 26px/30px 'Noto Sans JP'">○</div>` : `<div class="abs d chl" style="left:${CX - 32}px;top:${CY - 30}px;width:64px;text-align:center;font-size:40px;line-height:64px">B</div>
<div class="abs chs" style="left:${CX - 32}px;top:${CY - 27}px;width:64px;text-align:center;font:700 7px 'Inter';letter-spacing:2px">CHAIN</div>`}
${o.extra || ''}

${o.items}
<div class="abs sm" style="left:30px;bottom:66px">HP<span class="burn">やけど　3秒ごとに −1</span></div>
<div class="abs num" style="left:30px;bottom:24px">84<span class="of"> / 100</span></div>
<div class="abs bar" style="left:30px;bottom:14px;width:230px"><div class="fill php" style="width:84%"></div></div>`;
}
const plainItems = `<div class="abs sm" style="left:28px;top:196px">アイテム</div>` + ['回復薬', '閃光弾', 'チェインの実'].map((n, i) => `<div class="it ${i ? '' : 'on'}" style="top:${216 + i * 38}px">${n}${i ? '' : '<span class="r2">R2</span>'}</div>`).join('');

// ドット絵の背景（低い解像度で描いて拡大）。A案と C案の下地
const pixelBg = `const c=document.getElementById('bg'),x=c.getContext('2d');let seed=7;const R=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
const W0=['#1a1210','#2a1c18','#3a2620'],F0=['#3a2f2a','#2a211d'],G='#ff7a2a',hz=104;
x.fillStyle=W0[0];x.fillRect(0,0,320,180);
for(let r=0;r<13;r++)for(let i=-1;i<22;i++){const bx=i*16+(r%2?8:0),by=r*8;x.fillStyle=W0[1+((i*7+r*3)%5===0?1:0)];x.fillRect(bx,by,15,7);if((i*5+r*11)%13===0){x.fillStyle='#120c0b';x.fillRect(bx+3,by+2,4,1);}}
x.fillStyle='#241815';x.fillRect(0,0,320,6);for(let i=0;i<20;i++){x.fillStyle='#120c0b';x.fillRect(i*16+6,6,6,2);}
for(const ax of [130,198]){x.fillStyle='#0c0807';x.fillRect(ax-14,40,28,hz-42);x.beginPath();x.arc(ax,40,14,Math.PI,0);x.fill();x.fillStyle='#5a1a10';x.fillRect(ax-10,70,20,hz-72);x.fillStyle='#a8361a';x.fillRect(ax-6,84,12,hz-86);}
x.fillStyle=G;x.fillRect(0,hz-3,320,5);x.fillStyle='${AC2}';x.fillRect(0,hz-3,320,1);x.fillStyle='#fff2b0';for(let i=0;i<30;i++)x.fillRect(Math.floor(R()*320),hz-2,2+Math.floor(R()*4),1);
for(let y=hz+2;y<180;y++){const k=(y-hz)/(180-hz);x.fillStyle=k>.5?F0[1]:F0[0];x.fillRect(0,y,320,1);}
for(let y=hz+2;y<hz+26;y++){x.globalAlpha=.35*(1-(y-hz)/26);x.fillStyle=G;x.fillRect(0,y,320,1);}x.globalAlpha=1;
x.fillStyle='#0b0908';for(let i=1;i<7;i++){const y=Math.round(hz+2+(178-hz)*Math.pow(i/7,1.8));x.fillRect(0,y,320,1);}
for(let i=-9;i<=9;i++)for(let y=hz+2;y<180;y++){const k=(y-hz)/(180-hz);x.fillRect(Math.round(190+i*(14+k*46)),y,1,1);}
for(const px of [18,92,236,300]){x.fillStyle=W0[2];x.fillRect(px-9,0,18,hz-2);x.fillStyle='#4a322a';x.fillRect(px-9,0,3,hz-2);x.fillStyle='#000';x.globalAlpha=.35;x.fillRect(px+3,0,6,hz-2);x.globalAlpha=1;x.fillStyle=W0[1];x.fillRect(px-12,hz-8,24,6);x.fillRect(px-12,0,24,5);}
for(const px of [55,268]){x.fillStyle=W0[2];x.fillRect(px-5,58,10,3);x.fillStyle=G;x.fillRect(px-3,50,6,8);x.fillStyle='${AC2}';x.fillRect(px-1,47,3,8);x.fillStyle='#fff';x.fillRect(px,52,1,4);}
const b=document.getElementById('bloom').getContext('2d');b.fillStyle='#000';b.fillRect(0,0,320,180);b.fillStyle=G;b.fillRect(0,hz-6,320,10);for(const px of [55,268]){b.beginPath();b.arc(px,52,12,0,7);b.fill();}for(const ax of [130,198]){b.fillStyle='#a8361a';b.fillRect(ax-8,70,16,34);}`;
const embers = n => { let s = '', seed = 3; const R = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; for (let i = 0; i < n; i++) { const big = R() < 0.18, r = big ? 5 + R() * 9 : 1 + R() * 1.6; s += `<div class="abs" style="left:${(R() * 960).toFixed(0)}px;top:${(R() * 520).toFixed(0)}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${R() < 0.5 ? AC2 : '#ff7a2a'};opacity:${(big ? 0.12 + R() * 0.16 : 0.4 + R() * 0.5).toFixed(2)};${big ? 'filter:blur(3px)' : ''}"></div>`; } return s; };

const STYLES = {
  // A: 光と奥行き。背景を描き込み、手前の柱・光の筋・床の映り込み・大きな火の粉で厚みを出す。画面まわりは細く静かに
  'A-depth': m => ({
    css: `#bg,#bloom{position:absolute;left:0;top:0;width:960px;height:540px;image-rendering:pixelated}
#bloom{filter:blur(16px) brightness(1.7) saturate(1.7);mix-blend-mode:screen;opacity:.75;image-rendering:auto}
.band{background:linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.7));border-left:5px solid var(--ac);box-shadow:0 0 24px rgba(255,90,30,.35)}
.boss{color:var(--ac);opacity:1}.of{font:500 14px 'Inter';opacity:.6;font-style:normal}
.num{text-shadow:0 2px 0 rgba(0,0,0,.6),0 0 18px rgba(255,120,40,.35)}
.bar{height:4px;background:rgba(255,255,255,.2)}.fill{height:100%}.ehp{background:var(--ac);box-shadow:0 0 10px var(--ac)}.php{background:#f4f4f2;box-shadow:0 0 8px rgba(255,255,255,.6)}
.next{background:var(--ac);color:#111;font:900 11px 'Noto Sans JP';padding:2px 9px;transform:skewX(-12deg);margin-bottom:9px}
.atk{font:900 26px/1 'Noto Sans JP';margin-bottom:5px;text-shadow:0 2px 6px #000}
.dmg{font:800 italic 46px/1 'Inter Display','Inter';color:var(--ac);text-shadow:0 0 18px rgba(255,80,20,.7),0 2px 0 #000}.sec{font:800 italic 34px/1 'Inter Display','Inter';text-shadow:0 2px 0 #000}
.unit{font:500 11px 'Noto Sans JP';font-style:normal;color:#fff;opacity:.7;margin-left:4px;text-shadow:none}.sep{width:1px;height:30px;background:rgba(255,255,255,.35);margin:0 4px 3px}
.gauge{height:6px;background:rgba(0,0,0,.6);transform:skewX(-30deg)}.gfill{background:linear-gradient(90deg,var(--ac),var(--ac2));box-shadow:0 0 10px var(--ac)}
.c{background:linear-gradient(160deg,#fff,#dcd8d2);color:#111;box-shadow:4px 4px 0 var(--ac),0 10px 22px rgba(0,0,0,.55)}
.c.off{background:rgba(12,12,12,.8);color:#6a6a6a;box-shadow:0 6px 16px rgba(0,0,0,.5);outline:1px solid #444}
.c.sp{background:linear-gradient(160deg,#ff6a2a,#e03a12);color:#fff;box-shadow:4px 4px 0 #f4f4f2,0 10px 22px rgba(0,0,0,.55),0 0 22px rgba(255,90,30,.5)}
.chain{background:linear-gradient(135deg,#ff7a3a,#e03a12);outline:2px solid #f4f4f2;outline-offset:4px;box-shadow:0 0 26px rgba(255,90,30,.8)}.chl,.chs{color:#111}
.burn{margin-left:14px;color:var(--ac);opacity:1;letter-spacing:0}
.rv{box-shadow:0 6px 14px rgba(0,0,0,.5)}`,
    back: `<canvas id="bg" width="320" height="180"></canvas><canvas id="bloom" width="320" height="180"></canvas>
<div class="abs" style="left:0;top:270px;width:960px;height:120px;background:linear-gradient(rgba(255,120,40,.22),transparent)"></div>
<div class="abs" style="left:120px;top:-60px;width:150px;height:520px;background:linear-gradient(rgba(255,190,110,.16),transparent 85%);transform:skewX(-24deg);filter:blur(10px);mix-blend-mode:screen"></div>
<div class="abs" style="left:520px;top:-60px;width:110px;height:520px;background:linear-gradient(rgba(255,190,110,.12),transparent 85%);transform:skewX(-24deg);filter:blur(10px);mix-blend-mode:screen"></div>
${embers(70)}
<img class="abs" src="${m}" style="left:650px;top:452px;width:300px;height:300px;transform:scaleY(-0.45);transform-origin:top;opacity:.22;filter:blur(3px);-webkit-mask:linear-gradient(#000,transparent 60%)">
<img class="abs" src="${m}" style="left:650px;top:176px;width:300px;height:300px;filter:drop-shadow(0 0 2px #ffb070) drop-shadow(0 0 26px rgba(255,110,40,.6)) contrast(1.06)">
<div class="abs" style="left:-70px;top:-20px;width:150px;height:600px;background:#070505;filter:blur(7px)"></div>
<div class="abs" style="left:-40px;top:470px;width:1040px;height:110px;background:#060404;filter:blur(18px)"></div>
<div class="abs" style="inset:0;background:radial-gradient(ellipse at 62% 55%,transparent 42%,rgba(0,0,0,.8) 100%)"></div>
<div class="abs" style="inset:0;background:linear-gradient(120deg,rgba(40,10,60,.18),transparent 50%,rgba(255,120,40,.1));mix-blend-mode:screen"></div>`,
    items: revolver(0), script: pixelBg,
  }),
  // B: 平面の構成。背景を描かず、差し色の面・網点・集中線・黒い斜めの面で組む。敵は白い縁取りで切り抜きのように
  'B-graphic': m => ({
    css: `.bgA{position:absolute;inset:0;background:var(--ac)}
.dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.28) 28%,transparent 30%) 0 0/11px 11px;-webkit-mask:linear-gradient(100deg,transparent 30%,#000 75%)}
.rays{position:absolute;left:300px;top:-180px;width:1000px;height:1000px;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.16) 0 5deg,transparent 5deg 12deg);border-radius:50%;-webkit-mask:radial-gradient(circle,transparent 18%,#000 60%)}
.band{background:#000;border-left:6px solid #fff}.boss{color:var(--ac);opacity:1}.of{font:500 14px 'Inter';opacity:.7;font-style:normal}
.num{text-shadow:3px 3px 0 #000}
.bar{height:6px;background:#000}.fill{height:100%}.ehp{background:#fff}.php{background:#fff}
.next{background:#fff;color:#000;font:900 11px 'Noto Sans JP';padding:2px 9px;transform:skewX(-12deg);margin-bottom:9px}
.atk{font:900 26px/1 'Noto Sans JP';margin-bottom:5px}.dmg{font:800 italic 46px/1 'Inter Display','Inter';color:var(--ac);-webkit-text-stroke:0}.sec{font:800 italic 34px/1 'Inter Display','Inter'}
.unit{font:500 11px 'Noto Sans JP';font-style:normal;color:#fff;opacity:.8;margin-left:4px}.sep{width:2px;height:30px;background:#fff;margin:0 4px 3px}
.gauge{height:8px;background:#333;transform:skewX(-30deg)}.gfill{background:#fff}
.c{background:#fff;color:#000;border:3px solid #000;box-shadow:6px 6px 0 #000}
.c.off{background:#1a1a1a;color:#555;border-color:#000;box-shadow:6px 6px 0 rgba(0,0,0,.5)}
.c.sp{background:#000;color:var(--ac);border-color:#fff;box-shadow:6px 6px 0 #fff}
.chain{background:#000;outline:3px solid #fff;outline-offset:3px}.chl{color:var(--ac)}.chs{color:#fff}
.burn{margin-left:14px;color:#000;background:#fff;padding:1px 8px;opacity:1;letter-spacing:0;font-weight:900}
.it{position:absolute;left:28px;width:200px;height:34px;font-size:13px;font-weight:700;line-height:34px;padding-left:14px;background:#000;border-left:4px solid #fff}
.it.on{background:#fff;color:#000;border-left:6px solid var(--ac);box-shadow:5px 5px 0 #000}.r2{position:absolute;right:10px;font-size:11px;color:var(--ac);font-weight:900}`,
    back: `<div class="bgA"></div><div class="dots"></div><div class="rays"></div>
<div class="abs" style="inset:0;background:#0c0c0c;clip-path:polygon(0 0,58% 0,44% 100%,0 100%)"></div>
<div class="abs" style="inset:0;background:#fff;clip-path:polygon(58% 0,59.2% 0,45.2% 100%,44% 100%)"></div>
<div class="abs" style="inset:0;background:#0c0c0c;clip-path:polygon(60% 0,100% 0,100% 30%)"></div>
<div class="abs" style="left:610px;top:140px;width:380px;height:380px;background:#fff;clip-path:polygon(50% 0,58% 30%,85% 12%,72% 40%,100% 46%,74% 58%,90% 86%,60% 72%,52% 100%,42% 72%,12% 88%,28% 58%,0 50%,28% 40%,14% 14%,42% 30%)"></div>
<img class="abs" src="${m}" style="left:656px;top:176px;width:300px;height:300px;filter:drop-shadow(3px 0 0 #000) drop-shadow(-3px 0 0 #000) drop-shadow(0 3px 0 #000) drop-shadow(0 -3px 0 #000) drop-shadow(8px 8px 0 rgba(0,0,0,.9))">`,
    items: plainItems, script: '', tilt: [-3, 2, 2, -2],
  }),
  // C: 暗さと細い線。背景は大きくぼかして沈め、敵だけに光を当てる。画面まわりは金色の細い線と薄い文字で、上品に
  'C-noir': m => ({
    css: `#bg{position:absolute;left:-40px;top:-30px;width:1040px;height:600px;filter:blur(9px) saturate(.55) brightness(.5)}#bloom{display:none}
body{--gold:#d8b46a}
.band{background:linear-gradient(90deg,transparent,rgba(0,0,0,.75) 30%);border-top:1px solid var(--gold);border-bottom:1px solid var(--gold)}
.name{font-family:'Noto Sans JP'!important;font-weight:500;letter-spacing:10px;font-size:26px!important;right:22px!important}
.boss{color:var(--gold);opacity:1}.of{font:300 14px 'Inter';opacity:.6;font-style:normal}
.num{font:300 40px/1 'Inter Display','Inter';letter-spacing:1px}
.bar{height:2px;background:rgba(255,255,255,.18)}.fill{height:100%}.ehp{background:var(--ac);box-shadow:0 0 8px var(--ac)}.php{background:var(--gold);box-shadow:0 0 8px rgba(216,180,106,.7)}
.next{border:1px solid var(--gold);color:var(--gold);font:500 10px 'Inter';letter-spacing:3px;padding:2px 9px;margin-bottom:10px}
.atk{font:500 24px/1 'Noto Sans JP';margin-bottom:6px;letter-spacing:4px}.dmg{font:300 48px/1 'Inter Display','Inter';color:var(--ac);text-shadow:0 0 16px rgba(255,80,20,.6)}.sec{font:300 34px/1 'Inter Display','Inter'}
.unit{font:500 10px 'Noto Sans JP';color:#fff;opacity:.6;margin-left:6px;letter-spacing:2px}.sep{width:1px;height:34px;background:var(--gold);opacity:.6;margin:0 6px 3px}
.gauge{height:2px;background:rgba(255,255,255,.18)}.gfill{background:var(--gold);box-shadow:0 0 8px var(--gold)}
.c{background:linear-gradient(170deg,rgba(40,34,28,.92),rgba(10,9,8,.92));color:#f3ead8;border:1px solid var(--gold);box-shadow:0 0 0 3px rgba(0,0,0,.5),0 12px 24px rgba(0,0,0,.6),inset 0 0 18px rgba(216,180,106,.12)}
.c .lv{font-weight:300;font-size:50px}.c .pw{color:var(--gold);letter-spacing:3px;font-size:9px}
.c.off{border-color:#4a4338;color:#5c554a;box-shadow:none}.c.off .pw{color:#5c554a}
.c.sp{border-color:var(--ac);color:var(--ac);box-shadow:0 0 0 3px rgba(0,0,0,.5),0 0 20px rgba(255,80,20,.45),inset 0 0 18px rgba(255,80,20,.18)}.c.sp .pw{color:var(--ac)}
.chain{background:rgba(10,9,8,.9);border:1px solid var(--gold);outline:1px solid rgba(216,180,106,.4);outline-offset:5px;box-shadow:0 0 26px rgba(216,180,106,.45)}
.chl{font-family:'Inter Display','Inter'!important;font-weight:300;color:var(--gold);text-shadow:0 0 14px rgba(216,180,106,.8)}.chs{color:var(--gold)}
.burn{margin-left:14px;color:var(--ac);opacity:1;letter-spacing:1px}
.it{position:absolute;left:28px;width:200px;height:34px;font-size:13px;font-weight:500;letter-spacing:2px;line-height:34px;padding-left:16px;border-bottom:1px solid rgba(216,180,106,.3);color:#cfc6b4}
.it.on{background:linear-gradient(90deg,rgba(216,180,106,.28),transparent);border-bottom:1px solid var(--gold);color:#fff}.it.on::before{content:'';position:absolute;left:0;top:13px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}.r2{position:absolute;right:10px;font:500 10px 'Inter';letter-spacing:2px;color:var(--gold)}
.sm{letter-spacing:4px;font-size:10px}`,
    back: `<canvas id="bg" width="320" height="180"></canvas><canvas id="bloom" width="320" height="180"></canvas>
<div class="abs" style="inset:0;background:radial-gradient(ellipse 34% 50% at 83% 60%,rgba(255,150,70,.3),transparent 70%)"></div>
<div class="abs" style="left:700px;top:430px;width:200px;height:40px;background:radial-gradient(ellipse,rgba(255,140,60,.5),transparent 70%);filter:blur(6px)"></div>
<img class="abs" src="${m}" style="left:650px;top:176px;width:300px;height:300px;filter:saturate(.85) contrast(1.08) drop-shadow(0 0 30px rgba(255,120,50,.5))">
<div class="abs" style="inset:0;background:radial-gradient(ellipse at 70% 55%,transparent 30%,rgba(0,0,0,.88) 100%)"></div>
<svg class="abs" width="960" height="540" style="opacity:.12;mix-blend-mode:overlay"><filter id="n"><feTurbulence baseFrequency=".9" numOctaves="2" seed="4"/></filter><rect width="960" height="540" filter="url(#n)"/></svg>
<div class="abs" style="left:14px;top:14px;width:26px;height:26px;border-left:1px solid var(--gold);border-top:1px solid var(--gold);opacity:.7"></div>
<div class="abs" style="right:14px;bottom:14px;width:26px;height:26px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold);opacity:.7"></div>`,
    items: plainItems, script: pixelBg,
  }),
  // D: 持ち主が選んだ組み合わせ。C（暗さと細い線）が土台 / アイテムはリボルバー / 背景のぼかしは弱め / カードは90%で、±2度の範囲で少し傾ける（入れ替えのたびに角度を変える）
  'D-mix': m => {
    const c = STYLES['C-noir'](m);
    return { ...c, css: c.css.replace('filter:blur(9px) saturate(.55) brightness(.5)', 'filter:blur(2.5px) saturate(.7) brightness(.62);image-rendering:auto'), items: revolver(0, 28, 214, true), scale: 0.9, tilt: [-1.6, 1.2, 1.8, -0.9] };
  },
  // D2: D の敵の名前だけ、極太の書体に戻す
  'D2-heavyname': m => {
    const d = STYLES['D-mix'](m), rule = ".name{font-family:'Noto Sans JP'!important;font-weight:500;letter-spacing:10px;font-size:26px!important;right:22px!important}";
    if (!d.css.includes(rule)) throw new Error('name rule not found');
    return { ...d, css: d.css.replace(rule, '.name{letter-spacing:3px;text-shadow:0 0 18px rgba(216,180,106,.35)}') };
  },
  // D3: D2 の HP（敵と自分）の数字とバーを少しだけ太くする。持ち主が「いったんOK」とした版
  'D3-final': m => {
    const d = STYLES['D2-heavyname'](m);
    return { ...d, css: d.css + ".num{font-weight:500}.of{font-weight:400}.bar{height:3px}" };
  },
  // D4: D3 に、載せきれなかった情報を足す（持ち主の指示: アイテムの説明は小さく残す / 強化薬・時の砂の残り時間は残す / 無敵の表示は消す / ゲームパッドの案内と START は残す）
  'D4-fight': m => D4(m, false),
  'D4-start': m => D4(m, true),
};
// D4 の部品。アイテムの段は D3 のリボルバーと同じ寸法。使用済みは暗く残す
function D4(m, start) {
  const d = STYLES['D3-final'](m);
  const slot = [{ x: 0, y: 0, w: 204, h: 38, fs: 14, a: 1 }, { x: -9, y: 43, w: 190, h: 32, fs: 12.5, a: 0.8 }, { x: -18, y: 80, w: 174, h: 26, fs: 11, a: 0.6 }];
  const names = [['閃光弾', false], ['強化薬', !start], ['時の砂', !start]];   // 開始前は、まだ何も使っていない
  const items = `<div class="abs sm" style="left:28px;top:192px">アイテム</div>` + names.map(([n, used], i) => { const s = slot[i], x = 28 + s.x, y = 214 + s.y;
    return i === 0
      ? `<div class="rv" style="left:${x}px;top:${y}px;width:${s.w}px;height:${s.h}px;line-height:${s.h}px;font-size:${s.fs}px;letter-spacing:2px;z-index:3;background:linear-gradient(90deg,rgba(216,180,106,.42),rgba(20,17,14,.7) 85%);color:#fff;border:1px solid #d8b46a;border-left:4px solid #d8b46a;box-shadow:0 6px 14px rgba(0,0,0,.5),0 0 16px rgba(216,180,106,.3)">${n}${start ? '' : `<span style="position:absolute;right:10px;font:500 10px 'Inter';letter-spacing:2px;color:#d8b46a">R2</span>`}</div>`
      : `<div class="rv" style="left:${x}px;top:${y}px;width:${s.w}px;height:${s.h}px;line-height:${s.h}px;font-size:${s.fs}px;letter-spacing:2px;opacity:${used ? s.a * 0.45 : s.a};z-index:${3 - i};background:linear-gradient(90deg,rgba(216,180,106,.1),rgba(20,17,14,.85) 85%);color:#cfc6b4;border:1px solid rgba(216,180,106,.3);border-left:2px solid #d8b46a">${n}${used ? `<span style="position:absolute;right:10px;font-size:9px;letter-spacing:2px;color:#8d8576">使用済み</span>` : ''}</div>`;
  }).join('')
    // 選択中のアイテムの説明（小さく）
    + `<div class="abs" style="left:28px;top:330px;width:204px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.6;color:#cfc6b4"><span style="display:inline-block;width:5px;height:5px;background:#d8b46a;transform:rotate(45deg);margin:0 8px 2px 2px"></span>敵を1秒止め、行動ゲージを0に戻す</div>`;
  // 時間で切れる効果。自分にかかる効果なので金。名前で区別し、色は増やさない
  const timer = (n, left, y) => `<div class="abs" style="left:28px;top:${y}px;width:204px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end"><span style="font-size:11px;font-weight:500;letter-spacing:3px;color:#fff">${n}</span><span style="font:300 20px/1 'Inter Display','Inter';color:#d8b46a;text-shadow:0 0 10px rgba(216,180,106,.5)">${left}<span style="font:500 9px 'Noto Sans JP';color:#cfc6b4;margin-left:4px;letter-spacing:2px">秒</span></span></div>
  <div style="margin-top:5px;height:2px;background:rgba(255,255,255,.15)"><div style="width:${left * 10}%;height:100%;background:#d8b46a;box-shadow:0 0 6px #d8b46a"></div></div></div>`;
  const timers = start ? '' : `<div class="abs sm" style="left:28px;top:364px">効果</div>` + timer('強化薬', 6.4, 382) + timer('時の砂', 2.1, 414);
  // 開始前: 操作の案内（右下）と、ゲームパッドの状態（下の中央。問題があるときだけ出る）
  const guide = !start ? '' : `<div class="abs" style="right:48px;bottom:16px;font-size:11px;font-weight:500;letter-spacing:2px;color:#cfc6b4"><span class="key">✕</span>戻る<span class="key">OPTIONS</span>メニュー</div>
<div class="abs" style="left:300px;width:360px;bottom:18px;text-align:center;font-size:10.5px;font-weight:500;letter-spacing:1px;color:var(--ac)"><span style="display:inline-block;width:5px;height:5px;border:1px solid var(--ac);transform:rotate(45deg);margin:0 8px 2px 0"></span>ゲームパッドのボタン配置が標準と違う可能性あり</div>`;
  const css = `.key{display:inline-block;border:1px solid #d8b46a;color:#d8b46a;font:500 10px 'Inter';letter-spacing:2px;padding:2px 7px;margin:0 8px 0 22px}
.c.q .lv{color:#5c554a}.c.q .gl{color:#8d8576}
.chain.st{border-color:#d8b46a;box-shadow:0 0 34px rgba(216,180,106,.75),inset 0 0 14px rgba(216,180,106,.35);outline-color:rgba(216,180,106,.7)}`;
  return { ...d, css: d.css + css, items: items + timers, extra: guide, start };
}
const head = `<meta charset="utf-8"><link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/dela-gothic-one/400.css">${[300, 500, 700, 900].map(w => `<link rel="stylesheet" href="file://${FONTS}/node_modules/@fontsource/noto-sans-jp/${w}.css">`).join('')}`;

(async () => {
  const b = await chromium.launch();
  const g = await b.newPage();
  await g.goto('file://' + require('path').resolve(__dirname, '../../dist-single/chain-battle-standalone.html'));
  await g.waitForFunction(() => window.__scene && window.__scene.textures.exists('monster-fire_beast'));
  const monster = await g.evaluate(() => window.__scene.textures.get('monster-fire_beast').getSourceImage().src);
  await g.close();
  const shoot = async (name, html, w = 960, h = 540) => {
    const f = `${OUT}/${name}.html`; fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
    await p.screenshot({ path: `${__dirname}/${name}.png` }); await p.close();
  };
  const only = process.argv[2];
  for (const [name, make] of Object.entries(STYLES)) {
    if (process.argv[2] && !name.startsWith(process.argv[2])) continue;
    const s = make(monster);
    await shoot(`style-${name}`, `<!doctype html><html><head>${head}<style>${base}${s.css}</style></head><body>${s.back}${layout(s)}<script>${s.script}</script></body></html>`);
  }
  // メニュー系の見本: 行き先（ダンジョン）。戦闘の見た目（D3）と同じ調子を、一覧の画面に当てる
  if (!only || only === 'menu') {
    const rows = [['火', '火の神殿', '探索中', 1], ['水', '水の神殿', '準備中', 0], ['風', '風の神殿', '準備中', 0], ['城', '魔王城', '準備中', 0]];
    const css = `body{--gold:#d8b46a;background:#0b0a09}
.sm{letter-spacing:4px;font-size:10px}
.row{position:absolute;left:40px;width:380px;height:56px;border-bottom:1px solid rgba(216,180,106,.25)}
.row.on{background:linear-gradient(90deg,rgba(216,180,106,.3),rgba(216,180,106,.04) 80%,transparent);border-bottom:1px solid var(--gold);border-top:1px solid rgba(216,180,106,.5)}
.row .mk{position:absolute;left:18px;top:13px;width:30px;height:30px;border:1px solid rgba(216,180,106,.45);font:500 15px/30px 'Noto Sans JP';text-align:center;color:#8d8576}
.row.on .mk{border-color:var(--ac);color:var(--ac);box-shadow:0 0 14px rgba(255,80,20,.35);left:14px;top:9px;width:38px;height:38px;font-size:20px;line-height:38px}
.row .nm{position:absolute;left:66px;top:0;line-height:56px;font-size:17px;font-weight:500;letter-spacing:4px;color:#8d8576}.row.on .nm{color:#fff;font-size:23px;left:70px}
.row .st{position:absolute;right:16px;top:0;line-height:56px;font-size:11px;letter-spacing:3px;color:#5c554a}.row.on .st{color:var(--gold);font-size:12px}
.key{display:inline-block;border:1px solid var(--gold);color:var(--gold);font:500 10px 'Inter';letter-spacing:2px;padding:2px 7px;margin:0 8px 0 22px}
#bg,#bloom{position:absolute;left:-80px;top:-40px;width:900px;height:506px;image-rendering:pixelated}
#bg{filter:blur(1.2px) saturate(.8) brightness(.8)}#bloom{filter:blur(16px) brightness(1.5) saturate(1.5);mix-blend-mode:screen;opacity:.6;image-rendering:auto}`;
    const html = `<!doctype html><html><head>${head}<style>${base}${css}</style></head><body>
<div class="abs" style="left:470px;top:60px;width:450px;height:426px;overflow:hidden"><canvas id="bg" width="320" height="180"></canvas><canvas id="bloom" width="320" height="180"></canvas>
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 55%,transparent 35%,rgba(0,0,0,.8) 100%)"></div></div>
<div class="abs" style="left:470px;top:60px;width:450px;height:426px;border:1px solid var(--gold)"></div>
<div class="abs" style="left:464px;top:54px;width:462px;height:438px;border:1px solid rgba(216,180,106,.3)"></div>
<div class="abs" style="left:470px;top:60px;width:3px;height:426px;background:var(--ac);box-shadow:0 0 12px var(--ac)"></div>
<div class="abs d" style="left:40px;top:28px;font-size:30px;letter-spacing:4px">行き先</div>
<div class="abs" style="left:40px;top:92px;font-size:14px;font-weight:500;letter-spacing:4px"><span style="color:#8d8576;padding:0 4px 8px">討伐</span><span style="margin-left:26px;padding:0 4px 8px;border-bottom:2px solid var(--gold)">ダンジョン</span><span class="sm" style="margin-left:22px;color:var(--gold)">L1 / R1</span></div>
${rows.map(([m, n, st, on], i) => `<div class="row ${on ? 'on' : ''}" style="top:${140 + i * 60}px">${on ? '<div style="position:absolute;left:-3px;top:24px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)"></div>' : ''}<div class="mk">${m}</div><div class="nm">${n}</div><div class="st">${st}</div></div>`).join('')}
<div class="abs sm" style="left:40px;top:462px">所持金</div>
<div class="abs" style="left:40px;top:478px;font:500 26px/1 'Inter Display','Inter'">310<span style="font:400 12px 'Inter';opacity:.6;margin-left:6px">G</span></div>
<div class="abs" style="right:40px;bottom:16px;font-size:11px;font-weight:500;letter-spacing:2px;color:#cfc6b4"><span class="key">○</span>入る<span class="key">OPTIONS</span>メニュー</div>
<div class="abs" style="left:14px;top:14px;width:26px;height:26px;border-left:1px solid var(--gold);border-top:1px solid var(--gold);opacity:.7"></div>
<div class="abs" style="right:14px;bottom:14px;width:26px;height:26px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold);opacity:.7"></div>
<svg class="abs" width="960" height="540" style="left:0;top:0;opacity:.1;mix-blend-mode:overlay;pointer-events:none"><filter id="n"><feTurbulence baseFrequency=".9" numOctaves="2" seed="4"/></filter><rect width="960" height="540" filter="url(#n)"/></svg>
<script>${pixelBg}</script></body></html>`;
    await shoot('style-menu-select', html);
    if (only === 'menu') { await b.close(); return; }
  }
  // リボルバーの動き: 4コマ
  const a = STYLES['A-depth'](monster);
  if (only === 'D') { const d = STYLES['D-mix'](monster); const fr = [0, 0.33, 0.66, 1].map((p, i) => `<div style="position:absolute;left:${i * 250}px;top:0;width:250px;height:170px"><div style="position:absolute;left:14px;top:8px;font-size:11px;opacity:.7">${['① 押す前', '② 回り始め', '③ 後ろを通る', '④ 押した後'][i]}</div>${revolver(p, 44, 60, true)}</div>`).join(''); await shoot('style-D-revolver', `<!doctype html><html><head>${head}<style>${base}${d.css}body{width:1000px;height:170px;background:#14110f}</style></head><body>${fr}</body></html>`, 1000, 170); await b.close(); return; }
  if (only) { await b.close(); return; }
  const frames = [0, 0.33, 0.66, 1].map((p, i) => `<div style="position:absolute;left:${i * 250}px;top:0;width:250px;height:170px"><div style="position:absolute;left:14px;top:8px;font-size:11px;opacity:.7">${['① 押す前', '② 回り始め', '③ 後ろを通る', '④ 押した後'][i]}</div>${revolver(p, 44, 60)}</div>`).join('');
  await shoot('style-A-revolver', `<!doctype html><html><head>${head}<style>${base}${a.css}body{width:1000px;height:170px;background:#1a1412}</style></head><body>${frames}</body></html>`, 1000, 170);
  await b.close();
})();
