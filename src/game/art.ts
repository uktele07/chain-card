// 図形で描いた仮の絵（敵とアイテム）。SVGの文字列から画像を作って、Phaserのテクスチャとして登録する。
import type Phaser from 'phaser';

const C = { line: '#2c3442' };
const shadow = (rx: number, y: number) => `<ellipse cx="0" cy="${y}" rx="${rx}" ry="${Math.round(rx / 9)}" fill="#05070b" opacity="0.6"/>`;

/** 敵の絵。原点が中心で、おおよそ ±150 の範囲に収まる */
const MONSTERS: Record<string, string> = {
  slime: shadow(88, 92) + `<path d="M-90 70 C-96 10 -52 -60 0 -70 C52 -60 96 10 90 70 C60 96 -60 96 -90 70 Z" fill="#3fb7c9"/><path d="M-60 20 C-58 -20 -30 -48 -6 -52" stroke="#a9eef6" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/><circle cx="-28" cy="22" r="11" fill="#0d1017"/><circle cx="30" cy="22" r="11" fill="#0d1017"/><circle cx="-24" cy="18" r="4" fill="#fff"/><circle cx="34" cy="18" r="4" fill="#fff"/><path d="M-14 50 Q0 60 16 50" stroke="#0d1017" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  golem: shadow(96, 118) + `<rect x="-52" y="-34" width="104" height="104" rx="12" fill="#8b8f9c"/><rect x="-38" y="-96" width="76" height="66" rx="10" fill="#a2a6b3"/><rect x="-98" y="-30" width="40" height="92" rx="12" fill="#767a87"/><rect x="58" y="-30" width="40" height="92" rx="12" fill="#767a87"/><rect x="-46" y="68" width="36" height="50" rx="8" fill="#767a87"/><rect x="10" y="68" width="36" height="50" rx="8" fill="#767a87"/><rect x="-24" y="-74" width="16" height="10" fill="#ffd24a"/><rect x="8" y="-74" width="16" height="10" fill="#ffd24a"/><path d="M-30 -8 L-6 14 L-22 40 M14 -16 L30 12" stroke="#5c606c" stroke-width="4" fill="none"/>`,
  dragon: shadow(110, 132) + `<polygon points="-18,-10 -128,-96 -112,-22 -140,-8 -96,26 -30,36" fill="#8f2f2a"/><polygon points="18,-10 128,-96 112,-22 140,-8 96,26 30,36" fill="#8f2f2a"/><path d="M-46 126 C-70 60 -44 4 0 -6 C44 4 70 60 46 126 Z" fill="#c8453c"/><path d="M-22 122 C-34 70 -22 30 0 22 C22 30 34 70 22 122 Z" fill="#e8b98a"/><path d="M40 112 C92 118 118 92 126 62 C104 86 80 92 44 86 Z" fill="#c8453c"/><polygon points="-36,-36 0,-112 36,-36 22,-4 -22,-4" fill="#d9534a"/><polygon points="-24,-78 -44,-132 -8,-96" fill="#e8dcc4"/><polygon points="24,-78 44,-132 8,-96" fill="#e8dcc4"/><polygon points="-22,-58 -6,-50 -20,-42" fill="#ffd24a"/><polygon points="22,-58 6,-50 20,-42" fill="#ffd24a"/><polygon points="-10,-18 0,-10 10,-18 6,-8 -6,-8" fill="#5a1512"/>`,
  maou: shadow(104, 130) + `<path d="M-112 124 C-124 24 -72 -38 0 -48 C72 -38 124 24 112 124 Z" fill="#241a40"/><polygon points="-76,-8 -138,-52 -104,44" fill="#241a40"/><polygon points="76,-8 138,-52 104,44" fill="#241a40"/><path d="M-62 126 C-66 40 -42 -18 0 -28 C42 -18 66 40 62 126 Z" fill="#3d2c6e"/><path d="M-12 126 L0 -6 L12 126 Z" fill="#c9a23a"/><circle cx="0" cy="-62" r="36" fill="#4a3a80"/><polygon points="-28,-86 -62,-140 -10,-98" fill="#e8dcc4"/><polygon points="28,-86 62,-140 10,-98" fill="#e8dcc4"/><polygon points="-22,-68 -6,-61 -22,-54" fill="#ff5a4a"/><polygon points="22,-68 6,-61 22,-54" fill="#ff5a4a"/><path d="M-12 -40 L-6 -46 L0 -40 L6 -46 L12 -40" stroke="#1a1230" stroke-width="3" fill="none"/><polygon points="-16,-96 -8,-110 0,-98 8,-110 16,-96" fill="#c9a23a"/>`,
  kami: shadow(100, 132) + `<circle cx="0" cy="-20" r="118" fill="none" stroke="#ffd24a" stroke-width="5" opacity="0.85"/><circle cx="0" cy="-20" r="96" fill="none" stroke="#ffe9a8" stroke-width="2" stroke-dasharray="6 10"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(r => `<polygon points="0,-146 7,-124 -7,-124" fill="#ffd24a" transform="rotate(${r} 0 -20)"/>`).join('')}<polygon points="0,-104 62,-10 0,124 -62,-10" fill="#f4f6fb"/><polygon points="0,-104 62,-10 0,-10" fill="#d9deea"/><polygon points="0,124 -62,-10 0,-10" fill="#c3c9d8"/><polygon points="-62,-10 -124,-44 -92,26" fill="#e6e9f2"/><polygon points="62,-10 124,-44 92,26" fill="#e6e9f2"/><ellipse cx="0" cy="-22" rx="24" ry="14" fill="#10141c"/><circle cx="0" cy="-22" r="9" fill="#ffd24a"/><circle cx="0" cy="-22" r="3.5" fill="#10141c"/>`,
  unknown: shadow(96, 118) + `<path d="M-70 118 C-96 20 -60 -70 0 -110 C60 -70 96 20 70 118 Z" fill="#1d2330" stroke="${C.line}" stroke-width="3"/><polygon points="-34,-84 -62,-140 -14,-104" fill="#1d2330" stroke="${C.line}" stroke-width="3"/><polygon points="34,-84 62,-140 14,-104" fill="#1d2330" stroke="${C.line}" stroke-width="3"/><text x="0" y="30" font-size="80" font-weight="700" fill="#59606e" text-anchor="middle" font-family="sans-serif">?</text>`,
};

const st = (c: string) => `fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
/** アイテムの絵（線画）。原点が中心で、±16 の範囲 */
const ICONS: Record<string, string> = {
  potion: `<g ${st('#6fd08a')}><path d="M-5 -14 h10 M-3 -14 v6 L-10 5 a8.5 8.5 0 0 0 20 0 L3 -8 v-6"/><path d="M0 1 v8 M-4 5 h8"/></g>`,
  flash: `<g ${st('#ffd24a')}><circle r="5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -9 V${a % 90 ? -12.5 : -15}" transform="rotate(${a})"/>`).join('')}</g>`,
  sand: `<g ${st('#b9a3ea')}><path d="M-8 -14 h16 M-8 14 h16 M-6 -14 c0 9 12 19 12 28 M6 -14 c0 9 -12 19 -12 28"/><path d="M-3 9 h6 M0 0 v4"/></g>`,
  awake: `<g ${st('#f2a23a')}><path d="M0 -6 C9 -11 15 0 12 7 C9 14 3 15 0 12.5 C-3 15 -9 14 -12 7 C-15 0 -9 -11 0 -6 Z"/><path d="M0 -6 C0 -10 2 -13 5 -15"/><ellipse cx="-3" cy="4" rx="4.5" ry="2.8"/><ellipse cx="3" cy="4" rx="4.5" ry="2.8"/></g>`,
  rage: `<g ${st('#ff6a5a')}><path d="M-6 -14 h12 M-4 -14 v5 l-5 5 v14 a4 4 0 0 0 4 4 h10 a4 4 0 0 0 4 -4 v-14 l-5 -5 v-5"/><path d="M0 10 v-11 M-4.5 3.5 L0 -1 L4.5 3.5"/></g>`,
  none: `<rect x="-11" y="-11" width="22" height="22" rx="5" fill="none" stroke="#59606e" stroke-width="1.6" stroke-dasharray="4 3"/>`,
};

/** マスの絵柄（白）。原点が中心で、±24 の範囲 */
const SQUARE_ICONS: Record<string, string> = {
  mon: `<path d="M-8 -3 L-11 -11 L-3 -7 Z M8 -3 L11 -11 L3 -7 Z" fill="#fff"/><circle cy="2" r="7.5" fill="#fff"/><circle cx="-3" cy="1" r="1.8" fill="#7a1d18"/><circle cx="3" cy="1" r="1.8" fill="#7a1d18"/><path d="M-3 6 h6" stroke="#7a1d18" stroke-width="1.6"/>`,
  heal: `<path d="M-2.6 -9 h5.2 v6.4 h6.4 v5.2 h-6.4 v6.4 h-5.2 v-6.4 h-6.4 v-5.2 h6.4 z" fill="#fff"/>`,
  heart: `<path d="M0 9 C-12 0 -9 -9 -4 -9 C-1.5 -9 0 -7 0 -5 C0 -7 1.5 -9 4 -9 C9 -9 12 0 0 9 Z" fill="#fff"/><path d="M0 4 v-7 M-3 0 l3 -3 l3 3" stroke="#b84a85" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  bag: `<path d="M-3 -10 h6 v4 l5 9 a7 7 0 0 1 -7 7 h-2 a7 7 0 0 1 -7 -7 l5 -9 z" fill="#fff"/><path d="M-4 -6 h8" stroke="#1f7f8c" stroke-width="1.6"/>`,
  flame: `<path d="M0 -11 C2 -5 8 -3 8 3 A8 8 0 0 1 -8 3 C-8 -1 -5 -2 -4 -6 C-2 -4 -1 -7 0 -11 Z" fill="#fff"/><path d="M0 -1 C1 2 4 3 4 6 A4 4 0 0 1 -4 6 C-4 4 -2 3 -2 1 C-1 2 -0.5 1 0 -1 Z" fill="#f2a23a"/>`,
  q: `<text y="1" font-size="19" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">?</text>`,
  gate: `<path d="M-8 9 V-2 A8 8 0 0 1 8 -2 V9 Z" fill="#fff"/><path d="M0 9 V-9" stroke="#59606e" stroke-width="1.6"/>`,
  mid: `<path d="M-10 -5 L-14 -16 L-4 -10 Z M10 -5 L14 -16 L4 -10 Z" fill="#fff"/><circle cy="2" r="10" fill="#fff"/><path d="M-6 -1 l4 2 l-4 2 z M6 -1 l-4 2 l4 2 z" fill="#7a1d18"/><path d="M-5 8 l2.5 -3 l2.5 3 l2.5 -3 l2.5 3" stroke="#7a1d18" stroke-width="1.6" fill="none"/>`,
  boss: `<path d="M-12 -6 L-18 -22 L-5 -13 Z M12 -6 L18 -22 L5 -13 Z" fill="#fff"/><circle cy="3" r="12.5" fill="#fff"/><path d="M-8 -2 l5 3 l-5 3 z M8 -2 l-5 3 l5 3 z" fill="#7a1d18"/><path d="M-7 10 l2.5 -4 l2.2 4 l2.3 -4 l2.3 4 l2.2 -4 l2.5 4" stroke="#7a1d18" stroke-width="1.8" fill="none"/>`,
};
export const squareIconKey = (icon: string) => `sq-${icon}`;
export const boardKey = (id: string) => `board-${id}`;
/** 盤面の絵の外側に足す余白（端のマスでも画面の中央近くに置けるように） */
export const BOARD_PAD = 256;
export const templeKey = (id: string) => `temple-${id}`;
export const monsterKey = (id: string) => `monster-${id}`;
export const iconKey = (id: string | null) => `icon-${id ?? 'none'}`;

function add(scene: Phaser.Scene, key: string, inner: string, box: number, px: number) {
  addSvg(scene, key, `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-box} ${-box} ${box * 2} ${box * 2}">${inner}</svg>`);
}
function addSvg(scene: Phaser.Scene, key: string, svg: string) {
  const img = new Image();
  img.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, img); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** すべての絵をテクスチャとして登録する（読み込みは非同期。済むまでその絵は出ないだけ） */
export function loadArt(scene: Phaser.Scene, zoom: number) {
  for (const [id, inner] of Object.entries(MONSTERS)) add(scene, monsterKey(id), inner, 150, 300 * zoom);
  for (const [id, inner] of Object.entries(ICONS)) add(scene, iconKey(id), inner, 18, 48 * zoom);
  for (const [id, inner] of Object.entries(SQUARE_ICONS)) add(scene, squareIconKey(id), inner, 24, 64 * zoom);
}

/**
 * ダンジョンの盤面の絵（神殿の石床）。レンガの壁、四角い石の床、まっすぐな溶岩、柱と火皿。
 * 岩肌のまだら模様や、丸く光る溶岩は「気持ち悪い」と言われたので使わない。直線と直角だけで組む。
 */
export function loadBoardArt(scene: Phaser.Scene, def: { id: string; cell: number; size: [number, number]; lava: [number, number, number, number][] }, squares: { x: number; y: number }[], zoom: number) {
  if (scene.textures.exists(boardKey(def.id))) return;
  const G = def.cell, [cols, rows] = def.size, Wd = cols * G, Hd = rows * G, k = Math.min(2, zoom), P = BOARD_PAD;
  const path = new Set(squares.map(s => `${s.x},${s.y}`));
  const inLava = (x: number, y: number) => def.lava.some(([lx, ly, lw, lh]) => x >= lx && x < lx + lw && y >= ly && y < ly + lh);
  let s = `<defs>
    <pattern id="brick" width="44" height="44" patternUnits="userSpaceOnUse"><rect width="44" height="44" fill="#0e0b0a"/><rect x="1" y="1" width="42" height="20" rx="2" fill="#17110f"/><rect x="-21" y="23" width="42" height="20" rx="2" fill="#17110f"/><rect x="23" y="23" width="42" height="20" rx="2" fill="#17110f"/></pattern>
    <linearGradient id="slab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#585049"/><stop offset="1" stop-color="#3d3631"/></linearGradient>
    <linearGradient id="canal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb23a"/><stop offset="1" stop-color="#d9481a"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs><rect x="${-P}" y="${-P}" width="${Wd + P * 2}" height="${Hd + P * 2}" fill="url(#brick)"/>`;
  for (const [lx, ly, lw, lh] of def.lava) {
    const x = lx * G, y = ly * G, w = lw * G, h = lh * G;
    s += `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" fill="#ff7a2a" opacity="0.45" filter="url(#gl)"/><rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="6" fill="url(#canal)" stroke="#2a1410" stroke-width="5"/>`;
    if (w > 100 && h > 100) s += `<rect x="${x + 22}" y="${y + 22}" width="${w - 44}" height="${h - 44}" rx="4" fill="none" stroke="#ffe08a" stroke-width="2" opacity="0.5"/>`;
  }
  for (const q of squares) s += `<rect x="${q.x * G + 2}" y="${q.y * G + 2}" width="${G - 4}" height="${G - 4}" rx="4" fill="url(#slab)" stroke="#241d1a" stroke-width="2"/><rect x="${q.x * G + 7}" y="${q.y * G + 7}" width="${G - 14}" height="${G - 14}" rx="2" fill="none" stroke="#6b6159" stroke-width="1" opacity="0.5"/>`;
  // 道の脇に、柱と火皿を規則的に置く
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (path.has(`${x},${y}`) || inLava(x, y)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => path.has(`${x + dx},${y + dy}`));
    if (!near) continue;
    const h = (x * 7 + y * 13) % 6, cx = x * G + G / 2, cy = y * G + G / 2;
    if (h === 0) s += `<rect x="${x * G + 14}" y="${y * G + 14}" width="${G - 28}" height="${G - 28}" rx="4" fill="#2c2522" stroke="#4a403a" stroke-width="2"/><rect x="${x * G + 22}" y="${y * G + 22}" width="${G - 44}" height="${G - 44}" rx="2" fill="#3a312d"/>`;
    else if (h === 3) s += `<circle cx="${cx}" cy="${cy}" r="34" fill="#ff8a2a" opacity="0.32" filter="url(#gl)"/><circle cx="${cx}" cy="${cy}" r="11" fill="#2c2522" stroke="#6b6159" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="6" fill="#ffc45a"/>`;
  }
  addSvg(scene, boardKey(def.id), `<svg xmlns="http://www.w3.org/2000/svg" width="${(Wd + P * 2) * k}" height="${(Hd + P * 2) * k}" viewBox="${-P} ${-P} ${Wd + P * 2} ${Hd + P * 2}">${s}</svg>`);
}

/** ダンジョンを選ぶ画面の絵（炎の神殿）。450x420 */
export function loadTempleArt(scene: Phaser.Scene, zoom: number) {
  const w = 450, h = 420, cx = w / 2, by = h - 60, tw = 260;
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0b12"/><stop offset="0.6" stop-color="#5a1a12"/><stop offset="1" stop-color="#c8451a"/></linearGradient>
    <radialGradient id="lava" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#ffe27a"/><stop offset="0.45" stop-color="#ff8a2a"/><stop offset="1" stop-color="#b02a12"/></radialGradient>
    <radialGradient id="vg" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter><filter id="soft"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>`;
  for (let i = 0; i < 40; i++) s += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h * 0.8).toFixed(0)}" r="${(1 + rnd() * 1.6).toFixed(1)}" fill="#ffb04a" opacity="${(0.3 + rnd() * 0.5).toFixed(2)}"/>`;
  s += `<polygon points="${cx - 250},${h} ${cx - 60},70 ${cx - 20},86 ${cx + 30},64 ${cx + 250},${h}" fill="#1c0f0d"/>`;
  s += `<ellipse cx="${cx - 12}" cy="70" rx="60" ry="26" fill="#ff7a2a" opacity="0.7" filter="url(#glow)"/><path d="M${cx - 30} 76 C${cx - 50} 160 ${cx - 100} 190 ${cx - 130} ${h} L${cx - 90} ${h} C${cx - 60} 200 ${cx - 20} 150 ${cx - 6} 80 Z" fill="url(#lava)"/><path d="M${cx + 12} 72 C${cx + 40} 150 ${cx + 110} 200 ${cx + 150} ${h} L${cx + 180} ${h} C${cx + 130} 180 ${cx + 60} 130 ${cx + 26} 70 Z" fill="url(#lava)" opacity="0.9"/>`;
  s += `<ellipse cx="${cx}" cy="${by - 60}" rx="190" ry="120" fill="#ff6a1a" opacity="0.35" filter="url(#glow)"/>`;
  s += `<rect x="${cx - tw / 2 - 30}" y="${by}" width="${tw + 60}" height="60" fill="#120a09"/><rect x="${cx - tw / 2 - 16}" y="${by - 14}" width="${tw + 32}" height="14" fill="#241614"/><rect x="${cx - tw / 2}" y="${by - 26}" width="${tw}" height="12" fill="#2e1d1a"/>`;
  for (let i = 0; i < 6; i++) { const px = cx - tw / 2 + 14 + i * ((tw - 28 - 22) / 5); s += `<rect x="${px}" y="${by - 150}" width="22" height="124" fill="#2a1a17"/><rect x="${px + 3}" y="${by - 150}" width="5" height="124" fill="#4a302a"/><rect x="${px - 4}" y="${by - 158}" width="30" height="10" fill="#33201c"/>`; }
  s += `<polygon points="${cx - tw / 2 - 14},${by - 158} ${cx},${by - 226} ${cx + tw / 2 + 14},${by - 158}" fill="#241614"/><polygon points="${cx - tw / 2 + 20},${by - 164} ${cx},${by - 212} ${cx + tw / 2 - 20},${by - 164}" fill="#3a2520"/>`;
  s += `<path d="M${cx - 26} ${by - 26} V${by - 96} A26 26 0 0 1 ${cx + 26} ${by - 96} V${by - 26} Z" fill="url(#lava)"/><path d="M${cx} ${by - 192} c4 8 10 9 10 16 a10 10 0 0 1 -20 0 c0 -4 3 -6 5 -10 c2 2 3 -1 5 -6 z" fill="#ff8a2a"/><rect width="${w}" height="${h}" fill="url(#vg)"/>`;
  addSvg(scene, templeKey('fire'), `<svg xmlns="http://www.w3.org/2000/svg" width="${w * zoom}" height="${h * zoom}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
}
