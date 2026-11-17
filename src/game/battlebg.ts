// 戦闘の背景（Canvas に描く）。見た目の仕様は docs/look.md の4章、題材は docs/design.md の「戦闘中の背景」
// - ダンジョン: 神殿の広間（A）。見本（docs/samples/look-gen2.cjs の pixelBg）と同じ絵を 320×180 で描き、
//   拡大して弱くぼかし、彩度と明るさを落とす。敵の周りだけ明るく、縁は暗く落とす
// - 討伐: 抽象（C）。景色なし。敵の色の光と、細い同心円・放射線
import Phaser from 'phaser';
import { W, H } from './display';

export const battleBgKey = (kind: string) => `battlebg-${kind}`;
/** 敵の絵の中心（960×540 の座標）。光もここに当てる */
export const ENEMY_AT = { x: 800, y: 326, size: 300 };

function canvasTexture(scene: Phaser.Scene, key: string, zoom: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W * zoom, H * zoom)!;
  const ctx = tex.getContext();
  ctx.scale(zoom, zoom);
  return { tex, ctx };
}

/** 敵の周りの光と、縁の暗さ（どちらの背景にも重ねる） */
function lightAndVignette(ctx: CanvasRenderingContext2D, rgb: string, strength: number) {
  const { x, y } = ENEMY_AT;
  let g = ctx.createRadialGradient(x, y + 10, 0, x, y + 10, 260);
  g.addColorStop(0, `rgba(${rgb},${strength})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 足元の照り返し（中心 800,450、横 100・縦 20 の楕円）
  ctx.save(); ctx.translate(x, y + 124); ctx.scale(1, 0.2);
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
  g.addColorStop(0, `rgba(${rgb},${strength * 1.6})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(-120, -120, 240, 240); ctx.restore();
  // 縁を暗く（敵の少し左を中心にした楕円）
  ctx.save(); ctx.translate(W * 0.7, H * 0.55); ctx.scale(1, H / W);
  g = ctx.createRadialGradient(0, 0, W * 0.3, 0, 0, W * 1.0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = g; ctx.fillRect(-W * 2, -W * 2, W * 4, W * 4); ctx.restore();
}

/** 神殿の広間の元の絵（320×180）。見本の pixelBg と同じ */
function templePixels() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const x = c.getContext('2d')!;
  let seed = 7; const R = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const W0 = ['#1a1210', '#2a1c18', '#3a2620'], F0 = ['#3a2f2a', '#2a211d'], G = '#ff7a2a', AC2 = '#ffb23a', hz = 104;
  x.fillStyle = W0[0]; x.fillRect(0, 0, 320, 180);
  for (let r = 0; r < 13; r++) for (let i = -1; i < 22; i++) { const bx = i * 16 + (r % 2 ? 8 : 0), by = r * 8; x.fillStyle = W0[1 + ((i * 7 + r * 3) % 5 === 0 ? 1 : 0)]; x.fillRect(bx, by, 15, 7); if ((i * 5 + r * 11) % 13 === 0) { x.fillStyle = '#120c0b'; x.fillRect(bx + 3, by + 2, 4, 1); } }
  x.fillStyle = '#241815'; x.fillRect(0, 0, 320, 6); for (let i = 0; i < 20; i++) { x.fillStyle = '#120c0b'; x.fillRect(i * 16 + 6, 6, 6, 2); }
  for (const ax of [130, 198]) { x.fillStyle = '#0c0807'; x.fillRect(ax - 14, 40, 28, hz - 42); x.beginPath(); x.arc(ax, 40, 14, Math.PI, 0); x.fill(); x.fillStyle = '#5a1a10'; x.fillRect(ax - 10, 70, 20, hz - 72); x.fillStyle = '#a8361a'; x.fillRect(ax - 6, 84, 12, hz - 86); }
  x.fillStyle = G; x.fillRect(0, hz - 3, 320, 5); x.fillStyle = AC2; x.fillRect(0, hz - 3, 320, 1); x.fillStyle = '#fff2b0'; for (let i = 0; i < 30; i++) x.fillRect(Math.floor(R() * 320), hz - 2, 2 + Math.floor(R() * 4), 1);
  for (let y = hz + 2; y < 180; y++) { const k = (y - hz) / (180 - hz); x.fillStyle = k > 0.5 ? F0[1] : F0[0]; x.fillRect(0, y, 320, 1); }
  for (let y = hz + 2; y < hz + 26; y++) { x.globalAlpha = 0.35 * (1 - (y - hz) / 26); x.fillStyle = G; x.fillRect(0, y, 320, 1); } x.globalAlpha = 1;
  x.fillStyle = '#0b0908'; for (let i = 1; i < 7; i++) { const y = Math.round(hz + 2 + (178 - hz) * Math.pow(i / 7, 1.8)); x.fillRect(0, y, 320, 1); }
  for (let i = -9; i <= 9; i++) for (let y = hz + 2; y < 180; y++) { const k = (y - hz) / (180 - hz); x.fillRect(Math.round(190 + i * (14 + k * 46)), y, 1, 1); }
  for (const px of [18, 92, 236, 300]) { x.fillStyle = W0[2]; x.fillRect(px - 9, 0, 18, hz - 2); x.fillStyle = '#4a322a'; x.fillRect(px - 9, 0, 3, hz - 2); x.fillStyle = '#000'; x.globalAlpha = 0.35; x.fillRect(px + 3, 0, 6, hz - 2); x.globalAlpha = 1; x.fillStyle = W0[1]; x.fillRect(px - 12, hz - 8, 24, 6); x.fillRect(px - 12, 0, 24, 5); }
  for (const px of [55, 268]) { x.fillStyle = W0[2]; x.fillRect(px - 5, 58, 10, 3); x.fillStyle = G; x.fillRect(px - 3, 50, 6, 8); x.fillStyle = AC2; x.fillRect(px - 1, 47, 3, 8); x.fillStyle = '#fff'; x.fillRect(px, 52, 1, 4); }
  return c;
}

/** 神殿の広間（戦闘の背景） */
function templeHall(ctx: CanvasRenderingContext2D) {
  const c = templePixels();
  // 見本と同じく、少しはみ出す大きさ（1040×600、左上 -40,-30）に広げ、弱くぼかして沈める
  ctx.save();
  ctx.filter = 'blur(2.5px) saturate(0.7) brightness(0.62)';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, -40, -30, 1040, 600);
  ctx.restore();
}

/** 抽象（討伐）。敵の色の光と、細い同心円・放射線 */
function abstractBg(ctx: CanvasRenderingContext2D, rgb: string) {
  ctx.fillStyle = '#0b0a09'; ctx.fillRect(0, 0, W, H);
  const { x, y } = ENEMY_AT;
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 1; i <= 9; i++) { ctx.strokeStyle = `rgba(216,180,106,${0.16 - i * 0.012})`; ctx.beginPath(); ctx.arc(x, y, 60 + i * 52, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.strokeStyle = `rgba(216,180,106,${i % 4 === 0 ? 0.1 : 0.04})`;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 120, y + Math.sin(a) * 120); ctx.lineTo(x + Math.cos(a) * 900, y + Math.sin(a) * 900); ctx.stroke();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(x, y, 0, x, y, 420);
  g.addColorStop(0, `rgba(${rgb},0.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

const rgbOf = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

/** 背景のテクスチャを作る。kind: 'temple'（ダンジョン）か、'hunt-<色>'（討伐。色は #rrggbb） */
export function ensureBattleBg(scene: Phaser.Scene, kind: string, zoom: number) {
  const key = battleBgKey(kind);
  if (scene.textures.exists(key)) return key;
  const { tex, ctx } = canvasTexture(scene, key, zoom);
  if (kind === 'temple') { templeHall(ctx); lightAndVignette(ctx, '255,150,70', 0.3); }
  else { const rgb = rgbOf(kind.slice(5)); abstractBg(ctx, rgb); lightAndVignette(ctx, rgb, 0.18); }
  tex.refresh();
  return key;
}

/** 行き先の画面の右の枠に入れる絵（450×426）。見本（look-gen2.cjs の menu）と同じく、広間の絵を切り出し、たいまつと溶岩を光らせる */
export const listArtKey = (id: string) => `listart-${id}`;
export function ensureListArt(scene: Phaser.Scene, id: string, zoom: number) {
  const key = listArtKey(id);
  if (scene.textures.exists(key)) return key;
  const w = 450, h = 426, tex = scene.textures.createCanvas(key, w * zoom, h * zoom)!, ctx = tex.getContext();
  ctx.scale(zoom, zoom);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.filter = 'blur(1.2px) saturate(0.8) brightness(0.8)'; ctx.drawImage(templePixels(), -80, -40, 900, 506); ctx.restore();
  // 光のにじみ: たいまつ・溶岩・扉の光だけを描いた絵を大きくぼかし、明るく重ねる
  const g = document.createElement('canvas'); g.width = 320; g.height = 180;
  const x = g.getContext('2d')!, hz = 104;
  x.fillStyle = '#000'; x.fillRect(0, 0, 320, 180); x.fillStyle = '#ff7a2a'; x.fillRect(0, hz - 6, 320, 10);
  for (const px of [55, 268]) { x.beginPath(); x.arc(px, 52, 12, 0, 7); x.fill(); }
  for (const ax of [130, 198]) { x.fillStyle = '#a8361a'; x.fillRect(ax - 8, 70, 16, 34); }
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.6; ctx.filter = 'blur(16px) brightness(1.5) saturate(1.5)';
  ctx.drawImage(g, -80, -40, 900, 506); ctx.restore();
  // 縁を暗く
  ctx.save(); ctx.translate(w / 2, h * 0.55); ctx.scale(1, h / w);
  const v = ctx.createRadialGradient(0, 0, w * 0.25, 0, 0, w * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = v; ctx.fillRect(-w, -w, w * 2, w * 2); ctx.restore();
  tex.refresh();
  return key;
}
