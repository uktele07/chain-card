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

export const monsterKey = (id: string) => `monster-${id}`;
export const iconKey = (id: string | null) => `icon-${id ?? 'none'}`;

function add(scene: Phaser.Scene, key: string, inner: string, box: number, px: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-box} ${-box} ${box * 2} ${box * 2}">${inner}</svg>`;
  const img = new Image();
  img.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, img); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** すべての絵をテクスチャとして登録する（読み込みは非同期。済むまでその絵は出ないだけ） */
export function loadArt(scene: Phaser.Scene, zoom: number) {
  for (const [id, inner] of Object.entries(MONSTERS)) add(scene, monsterKey(id), inner, 150, 300 * zoom);
  for (const [id, inner] of Object.entries(ICONS)) add(scene, iconKey(id), inner, 18, 48 * zoom);
}
