// 盤面のマスの絵（紋章）と、ボスのマスの瘴気。見本は docs/samples/style-S5-icons3.png と style-S5-boss5.png
// - 紋章: 刻印石の板に、外側の円と、ひと目で分かる記号の溝。溝は種類の色で光る（SVG を画像にしてテクスチャにする）
// - ボス: 板だけ（記号なし）。その上に、赤い光・脈打つ靄・逆向きに回る2段の煙を重ねる（Canvas で描いたテクスチャを、毎フレーム回して置く）
import type Phaser from 'phaser';

export const runeKey = (kind: string) => `rune-${kind}`;
export const SMOKE = { a: 'boss-smoke-a', b: 'boss-smoke-b', mist: 'boss-mist', glow: 'boss-glow', wisp: 'boss-wisp' };

/** マスの種類ごとの色と記号（24×24 の線）。ボスは記号なし */
const RUNES: Record<string, [string, string]> = {
  monster: ['#d9534a', 'M5 3.5 8 9M19 3.5 16 9M6 12.5a6 6 0 1 0 12 0a6 6 0 1 0-12 0M9.5 12v.4M14.5 12v.4M10 16h4'],
  heal: ['#4fae6a', 'M12 5v14M5 12h14'],
  maxhp: ['#e07ab0', 'M12 20C4.5 14.5 4 9 7.5 7.5 9.6 6.6 11.3 7.6 12 9.2 12.7 7.6 14.4 6.6 16.5 7.5 20 9 19.5 14.5 12 20ZM12 15.5v-5M9.8 12.6 12 10.4l2.2 2.2'],
  item: ['#3fb7c9', 'M9.5 3.5h5M10.5 3.5v5L6.8 15.2A3.4 3.4 0 0 0 9.8 20.5h4.4a3.4 3.4 0 0 0 3-5.3L13.5 8.5v-5M8.2 14.5h7.6'],
  event: ['#f2a23a', 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4.5 3-6.5.3 2 1.2 3.2 2.3 3.4C11 8.5 11 6 12 3Z'],
  random: ['#9b7be0', 'M8.8 9.2a3.2 3.2 0 1 1 4.6 2.9c-1 .5-1.4 1.3-1.4 2.6M12 18.2v.4'],
  mid: ['#c8453c', 'M3.5 3 7.5 9.5M20.5 3l-4 6.5M5.5 13a6.5 6.5 0 0 1 13 0v3.5h-2V20h-9v-3.5h-2ZM9 13.2h1.4M13.6 13.2H15M10.5 20v-2M13.5 20v-2'],
  start: ['#8a93a3', 'M5.5 20.5V10.5a6.5 6.5 0 0 1 13 0v10M3.5 20.5h17M12 4v16.5'],
  key: ['#f0c75e', 'M3.5 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M11.5 12h9M16.5 12v3.2M20 12v4'],
  door: ['#d0874a', 'M6 20.5V9a6 6 0 0 1 12 0v11.5M4 20.5h16M12 12.2a1.4 1.4 0 1 0 .01 0M12 13.6v3'],
  boss: ['#7a2a8a', ''],
};
export const RUNE_COLOR = (kind: string) => RUNES[kind]?.[0] ?? '#8d8576';

function svgTile(kind: string) {
  const [col, d] = RUNES[kind];
  const boss = kind === 'boss';
  const top = boss ? ['#3a2a26', '#1a1210'] : ['#4a423b', '#26211d'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 48 48">
  <defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${top[0]}"/><stop offset="1" stop-color="${top[1]}"/></linearGradient></defs>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="url(#l)"/><path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="#fff" filter="url(#n)" opacity=".5"/>
  <path d="M4 3h40l2 3v37l-3 2H5l-2-3V6Z" fill="none" stroke="${boss ? col : '#000'}" stroke-opacity="${boss ? .8 : .6}" stroke-width="${boss ? .8 : 1}"/><path d="M5 4.5h38" stroke="#fff" stroke-opacity=".18"/>
  ${boss ? '' : `<circle cx="24" cy="24" r="18" fill="none" stroke="#0a0806" stroke-width="2.4"/><circle cx="24" cy="24" r="18" fill="none" stroke="${col}" stroke-opacity=".75" stroke-width="1"/>
  <g transform="translate(12.5 12.5) scale(.96)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${d}" stroke="#0a0806" stroke-width="4.4"/>
    <path d="${d}" stroke="${col}" stroke-width="2.4" filter="url(#g)"/>
    <path d="${d}" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/></g>`}</svg>`;
}

function canvasTex(scene: Phaser.Scene, key: string, px: number, draw: (x: CanvasRenderingContext2D, s: number) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, px, px)!;
  draw(t.getContext(), px);
  t.refresh();
}
/** 円の内側と外側を透明にする（煙の輪にする） */
function ringMask(x: CanvasRenderingContext2D, s: number, stops: [number, number][]) {
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(0,0,0,${a})`);
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.globalCompositeOperation = 'source-over';
}
function smoke(x: CanvasRenderingContext2D, s: number, from: number, stops: [number, string][], mask: [number, number][]) {
  x.filter = `blur(${s * .03}px)`;
  const g = x.createConicGradient(from, s / 2, s / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  x.fillStyle = g; x.beginPath(); x.arc(s / 2, s / 2, s / 2 * .94, 0, Math.PI * 2); x.fill();
  x.filter = 'none';
  ringMask(x, s, mask);
}

/** マスの絵とボスの瘴気のテクスチャを作る（読み込みは非同期。済むまで絵は出ないだけ） */
export function loadRunes(scene: Phaser.Scene, zoom: number) {
  for (const kind of Object.keys(RUNES)) {
    const key = runeKey(kind);
    if (scene.textures.exists(key)) continue;
    const img = new Image();
    img.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, img); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgTile(kind));
  }
  const px = Math.round(110 * zoom);
  // 外側の煙: 黒紫の濃い煙（不透明度 .9 前後）。切れ間から中が少しのぞく
  canvasTex(scene, SMOKE.a, px, (x, s) => smoke(x, s, 0, [[0, 'rgba(25,0,30,.92)'], [.14, 'rgba(90,15,120,.85)'], [.26, 'rgba(0,0,0,0)'], [.42, 'rgba(10,0,12,.95)'], [.57, 'rgba(130,20,80,.75)'], [.68, 'rgba(0,0,0,0)'], [.83, 'rgba(40,5,55,.9)'], [1, 'rgba(25,0,30,.92)']],
    [[0, 0], [.32, 0], [.6, 1], [.86, 1], [1, 0]]));
  // 内側の煙: 逆向きに回る
  canvasTex(scene, SMOKE.b, px, (x, s) => smoke(x, s, Math.PI / 2, [[0, 'rgba(0,0,0,0)'], [.19, 'rgba(60,0,80,.8)'], [.33, 'rgba(0,0,0,0)'], [.56, 'rgba(15,0,20,.9)'], [.69, 'rgba(0,0,0,0)'], [.89, 'rgba(110,10,60,.7)'], [1, 'rgba(0,0,0,0)']],
    [[0, 0], [.16, 0], [.7, 1], [.9, 1], [1, 0]]));
  // 手前の靄（脈打つ）
  canvasTex(scene, SMOKE.mist, px, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(70,0,90,.35)'); g.addColorStop(.75, 'rgba(20,0,25,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  // 板の上の赤い光（瘴気の芯）
  canvasTex(scene, SMOKE.glow, px, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,30,40,.75)'); g.addColorStop(.7, 'rgba(255,30,40,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  // 立ちのぼる細い煙
  canvasTex(scene, SMOKE.wisp, Math.round(40 * zoom), (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(80,10,100,.85)'); g.addColorStop(.7, 'rgba(80,10,100,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
}
