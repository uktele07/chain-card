const { chromium } = require('playwright');
const fs = require('fs');
const THEMES = {
  fire: { ac: '#ff4b1f', ac2: '#ffb23a', name: '炎獣', en: 'FLAME BEAST', stage: '火の神殿', wall: ['#1a1210', '#2a1c18', '#3a2620'], floor: ['#3a2f2a', '#2a211d'], glow: '#ff7a2a', hue: 0 },
  water: { ac: '#1fa8ff', ac2: '#8fe3ff', name: '水竜', en: 'TIDE DRAKE', stage: '水の神殿', wall: ['#0e1620', '#16263a', '#1f3650'], floor: ['#24364a', '#172433'], glow: '#3ac0ff', hue: 190 },
};
const page = (t, monster, kind) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${__dirname}/node_modules/@fontsource/dela-gothic-one/400.css">
<link rel="stylesheet" href="file://${__dirname}/node_modules/@fontsource/noto-sans-jp/900.css">
<link rel="stylesheet" href="file://${__dirname}/node_modules/@fontsource/noto-sans-jp/500.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:960px;height:540px;overflow:hidden;background:#000;font-family:'Noto Sans JP',sans-serif;color:#fff;--ac:${t.ac};--ac2:${t.ac2}}
.abs{position:absolute}.d{font-family:'Dela Gothic One','Noto Sans JP';}.it{font-style:italic;font-family:'Inter Display','Inter';font-weight:900}
.b9{font-weight:900}
#bg,#bloom{position:absolute;left:0;top:0;width:960px;height:540px;image-rendering:pixelated}
#bloom{filter:blur(14px) brightness(1.5) saturate(1.6);mix-blend-mode:screen;opacity:.55;image-rendering:auto}
.tilt{position:absolute;left:0;width:960px;backdrop-filter:blur(3px)}
.vg{position:absolute;inset:0;background:radial-gradient(ellipse at 60% 55%,transparent 45%,rgba(0,0,0,.78) 100%)}
.para{transform:skewX(-12deg)} .un{transform:skewX(12deg)}
.band{background:#000;border-right:8px solid var(--ac)}
.card{position:absolute;width:104px;height:112px;transform:skewX(-8deg);color:#000}.card.off{color:#777}.card.sp{color:#fff}
.card .in{position:absolute;inset:0;background:#fff;color:#000;box-shadow:7px 7px 0 var(--ac)}
.card.off .in{background:#111;color:#666;box-shadow:none;outline:2px solid #444}
.card .lv{position:absolute;left:0;right:0;top:2px;text-align:center;font-size:74px;line-height:1;transform:skewX(8deg)}
.card .pw{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:12px;font-weight:900;transform:skewX(8deg)}
.card .gl{position:absolute;left:-10px;top:-10px;width:28px;height:28px;background:#000;color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;transform:skewX(8deg)}
.card.sp .in{background:var(--ac);color:#fff;box-shadow:7px 7px 0 #fff}
.item{position:absolute;left:0;height:40px;transform:skewX(-12deg);background:rgba(0,0,0,.82);border-left:6px solid #fff}
.item.on{background:#fff;color:#000;border-left:6px solid var(--ac)}
.item span{display:block;transform:skewX(12deg);font-weight:900;font-size:17px;line-height:40px;padding-left:22px}
.tag{display:inline-block;background:var(--ac);color:#000;font-weight:900;font-size:11px;padding:1px 8px;transform:skewX(-12deg)}
.stroke{-webkit-text-stroke:2px var(--ac);color:transparent}
.row{position:absolute;left:0;height:62px;transform:skewX(-12deg)}
</style></head><body>
<canvas id="bg" width="320" height="180"></canvas><canvas id="bloom" width="320" height="180"></canvas>
<div class="tilt" style="top:0;height:110px;-webkit-mask:linear-gradient(#000,transparent)"></div>
<div class="tilt" style="bottom:0;height:120px;backdrop-filter:blur(4px);-webkit-mask:linear-gradient(transparent,#000)"></div>
<div class="vg"></div>
${kind === 'battle' ? battle(t) : select(t)}
<script>
const T=${JSON.stringify(t)};
const c=document.getElementById('bg'),x=c.getContext('2d');let seed=7;const R=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
// 奥の壁（レンガ）
x.fillStyle=T.wall[0];x.fillRect(0,0,320,180);
for(let r=0;r<13;r++)for(let i=-1;i<22;i++){const bx=i*16+(r%2?8:0),by=r*8;x.fillStyle=T.wall[1+((i*7+r*3)%5===0?1:0)];x.fillRect(bx,by,15,7);}
// 溶岩（または水）の帯
const hz=104;x.fillStyle=T.glow;x.fillRect(0,hz-3,320,5);x.fillStyle=T.ac2;x.fillRect(0,hz-3,320,1);
// 床（奥行き）
for(let y=hz+2;y<180;y++){const k=(y-hz)/(180-hz);x.fillStyle=k>.5?T.floor[1]:T.floor[0];x.fillRect(0,y,320,1);}
x.fillStyle='#0b0908';for(let i=1;i<7;i++){const y=Math.round(hz+2+(178-hz)*Math.pow(i/7,1.8));x.fillRect(0,y,320,1);}
for(let i=-9;i<=9;i++){for(let y=hz+2;y<180;y++){const k=(y-hz)/(180-hz);const px=Math.round(190+i*(14+k*46));x.fillRect(px,y,1,1);}}
// 柱と火皿
for(const px of [18,92,236,300]){x.fillStyle=T.wall[2];x.fillRect(px-9,0,18,hz-2);x.fillStyle='#000';x.globalAlpha=.35;x.fillRect(px+3,0,6,hz-2);x.globalAlpha=1;x.fillStyle=T.wall[1];x.fillRect(px-12,hz-8,24,6);x.fillRect(px-12,0,24,5);}
for(const px of [55,268]){x.fillStyle=T.wall[2];x.fillRect(px-5,58,10,3);x.fillStyle=T.glow;x.fillRect(px-3,50,6,8);x.fillStyle=T.ac2;x.fillRect(px-1,47,3,8);x.fillStyle='#fff';x.fillRect(px,52,1,4);}
for(let i=0;i<40;i++){x.fillStyle=i%3?T.glow:T.ac2;x.globalAlpha=.3+R()*.6;x.fillRect(Math.floor(R()*320),Math.floor(R()*150),1,1);}x.globalAlpha=1;
// 光のにじみ用: 明るい所だけ写す
const b=document.getElementById('bloom').getContext('2d');b.fillStyle='#000';b.fillRect(0,0,320,180);b.fillStyle=T.glow;b.fillRect(0,hz-6,320,10);for(const px of [55,268]){b.beginPath();b.arc(px,52,12,0,7);b.fill();}
// 敵: 低い解像度に落として、色数を絞り、ドット絵風にする
const m=document.getElementById('mon');if(m){const im=new Image();im.onload=()=>{const N=76,o=document.createElement('canvas');o.width=o.height=N;const g=o.getContext('2d');g.drawImage(im,0,0,N,N);const d=g.getImageData(0,0,N,N),p=d.data;
 for(let i=0;i<p.length;i+=4){if(p[i+3]<140){p[i+3]=0;continue;}p[i+3]=255;for(let k=0;k<3;k++)p[i+k]=Math.min(255,Math.round(p[i+k]/42)*42);}
 const a=(X,Y)=>X<0||Y<0||X>=N||Y>=N?0:p[(Y*N+X)*4+3];const out=[];for(let Y=0;Y<N;Y++)for(let X=0;X<N;X++)if(!a(X,Y)&&(a(X+1,Y)||a(X-1,Y)||a(X,Y+1)||a(X,Y-1)))out.push((Y*N+X)*4);
 for(const i of out){p[i]=12;p[i+1]=8;p[i+2]=10;p[i+3]=255;}g.putImageData(d,0,0);const mc=m.getContext('2d');mc.imageSmoothingEnabled=false;mc.drawImage(o,0,0);document.body.dataset.ready='1';};im.src=${JSON.stringify(monster)};}else document.body.dataset.ready='1';
</script></body></html>`;

function battle(t) {
  const card = (x, y, lv, pw, gl, cls = '') => `<div class="card ${cls}" style="left:${x}px;top:${y}px"><div class="in"></div><div class="lv d">${lv}</div><div class="pw">${pw}</div><div class="gl">${gl}</div></div>`;
  return `
<div class="abs d stroke" style="right:-20px;bottom:6px;font-size:120px;line-height:1;opacity:.5;transform:skewX(-12deg)">${t.stage}</div>
<canvas id="mon" width="76" height="76" class="abs" style="left:640px;top:150px;width:320px;height:320px;image-rendering:pixelated;filter:${t.hue ? `hue-rotate(${t.hue}deg) ` : ''}drop-shadow(0 0 18px ${t.glow}88)"></canvas>
<div class="abs para band" style="left:-30px;top:22px;width:500px;height:64px"></div>
<div class="abs d" style="left:28px;top:20px;font-size:44px;line-height:64px">${t.name}</div>
<div class="abs it" style="left:${t.name.length * 46 + 44}px;top:54px;font-size:13px;letter-spacing:2px;color:var(--ac)">${t.en}</div>
<div class="abs tag" style="left:392px;top:30px">BOSS</div>
<div class="abs para" style="left:14px;top:92px;width:430px;height:16px;background:#000;outline:2px solid #fff"><div style="width:64%;height:100%;background:var(--ac)"></div></div>
<div class="abs it" style="left:456px;top:76px;font-size:38px">71<span style="font-size:16px;opacity:.7"> /110</span></div>
<div class="abs b9" style="left:20px;top:120px;font-size:15px"><span class="tag" style="font-size:13px">次</span>　爪　<span class="it" style="font-size:22px">5</span> ダメージ</div>
<div class="abs para" style="left:190px;top:126px;width:210px;height:8px;background:rgba(0,0,0,.7)"><div style="width:30%;height:100%;background:#fff"></div></div>
<div class="abs it" style="left:410px;top:116px;font-size:20px">3.5<span style="font-size:11px">s</span></div>

${card(388, 172, 'B', '威力 2', '△')}${card(520, 286, 'C', '威力 1', '○')}${card(388, 400, 'S', '威力 10', '✕', 'off')}${card(256, 286, 'X', 'レベルX', '□', 'sp')}
<div class="abs" style="left:398px;top:296px;width:84px;height:84px;background:var(--ac);transform:rotate(45deg);outline:4px solid #fff;outline-offset:5px"></div>
<div class="abs d" style="left:398px;top:290px;width:84px;text-align:center;font-size:58px;line-height:84px;color:#000">B</div>
<div class="abs it" style="left:398px;top:278px;width:84px;text-align:center;font-size:10px;letter-spacing:2px;color:#000">CHAIN</div>

<div class="item on" style="top:196px;width:228px"><span>回復薬</span></div>
<div class="abs tag" style="left:150px;top:206px;font-size:13px">R2 使う</div>
<div class="item" style="top:242px;width:208px"><span>閃光弾</span></div>
<div class="item" style="top:288px;width:188px"><span>チェインの実</span></div>

<div class="abs para band" style="left:-30px;bottom:18px;width:330px;height:74px;border-right-color:#fff"></div>
<div class="abs it" style="left:22px;bottom:18px;font-size:64px;line-height:74px">84</div>
<div class="abs it" style="left:112px;bottom:30px;font-size:18px;opacity:.7">/100</div>
<div class="abs b9" style="left:170px;bottom:62px;font-size:11px;letter-spacing:3px">HP</div>
<div class="abs para" style="left:168px;bottom:40px;width:110px;height:10px;background:#333"><div style="width:84%;height:100%;background:#fff"></div></div>
<div class="abs tag" style="left:16px;bottom:100px;font-size:12px">やけど　3秒ごとに −1</div>`;
}
function select(t) {
  const rows = [['火', '火の神殿', '探索中', 1], ['水', '水の神殿', '準備中', 0], ['風', '風の神殿', '準備中', 0], ['城', '魔王城', '準備中', 0]];
  return `<div class="abs" style="inset:0;background:linear-gradient(100deg,rgba(0,0,0,.92) 46%,rgba(0,0,0,.15) 62%)"></div>
<div class="abs" style="left:420px;top:-40px;width:26px;height:640px;background:var(--ac);transform:skewX(-12deg)"></div>
<div class="abs" style="left:454px;top:-40px;width:6px;height:640px;background:#fff;transform:skewX(-12deg)"></div>
<div class="abs d" style="left:36px;top:18px;font-size:54px">行き先</div>
<div class="abs it stroke" style="left:214px;top:44px;font-size:24px;letter-spacing:2px">DESTINATION</div>
<div class="abs" style="left:40px;top:98px"><span class="tag" style="font-size:15px;background:#222;color:#888;padding:4px 18px">討伐</span> <span class="tag" style="font-size:15px;padding:4px 18px;margin-left:6px">ダンジョン</span><span class="b9" style="font-size:11px;margin-left:16px;opacity:.6">L1 / R1</span></div>
${rows.map(([m, n, st, on], i) => `<div class="row" style="top:${148 + i * 72}px;width:${on ? 470 : 400 - i * 14}px;background:${on ? '#fff' : 'rgba(255,255,255,.07)'};${on ? 'box-shadow:8px 8px 0 var(--ac)' : ''}"></div>
<div class="abs d" style="left:44px;top:${148 + i * 72}px;font-size:38px;line-height:62px;color:${on ? 'var(--ac)' : '#555'}">${m}</div>
<div class="abs d" style="left:104px;top:${148 + i * 72}px;font-size:${on ? 32 : 24}px;line-height:62px;color:${on ? '#000' : '#777'}">${n}</div>
<div class="abs b9" style="left:${on ? 350 : 290 - i * 14}px;top:${148 + i * 72 + 22}px;font-size:13px;color:${on ? '#000' : '#555'}">${st}</div>`).join('')}
<div class="abs d stroke" style="right:10px;bottom:40px;font-size:96px;line-height:1;transform:skewX(-12deg)">${t.stage}</div>
<div class="abs b9" style="right:28px;bottom:14px;font-size:13px"><span class="tag">○</span> 入る　　<span class="tag" style="background:#fff">OPTIONS</span> メニュー</div>
<div class="abs it" style="left:40px;bottom:16px;font-size:26px">310<span style="font-size:13px"> G</span></div>`;
}
(async () => {
  const b = await chromium.launch();
  const g = await b.newPage();
  await g.goto('file:///home/user/chain-card/dist-single/chain-battle-standalone.html');
  await g.waitForFunction(() => window.__scene && window.__scene.textures.exists('monster-fire_beast'));
  const monster = await g.evaluate(() => window.__scene.textures.get('monster-fire_beast').getSourceImage().src);
  await g.close();
  for (const [name, t, kind] of [['1-battle-fire', THEMES.fire, 'battle'], ['2-battle-water', THEMES.water, 'battle'], ['3-select', THEMES.fire, 'select']]) {
    const f = `${__dirname}/${name}.html`; fs.writeFileSync(f, page(t, monster, kind));
    const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
    await p.goto('file://' + f); await p.waitForFunction(() => document.body.dataset.ready === '1'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
    await p.screenshot({ path: `${__dirname}/look-${name}.png` }); await p.close();
  }
  await b.close();
})();
