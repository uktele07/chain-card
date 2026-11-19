// 炎の神殿の盤面（マスの座標・分かれ道・溶岩）を作る。案H（2026-11-19、持ち主の指示）
// 使い方: node scripts/layout-fire.mjs <出力する dungeons.json>（省くと data/dungeons.json を書き換える）
// 形: 横に長い道を4段、つづら折りに並べる。各段の端は縦に4マスでつなぐ。
//     分かれ道は 1〜3段目に1つずつ。短い道は横にまっすぐ5マス、長い道は下へ3・横へ6・上へ2の11マス（同じ所に戻る）
//     長い道の内側（2×5マス）と、段の間のあいた所に溶岩を置く
import fs from 'node:fs';
const OUT = process.argv[2] || 'data/dungeons.json';
const RUN = 24, GAP = 5, X0 = 1, Y0 = 1, AT = 8;   // 段の長さ、段の間隔、左上、分かれ道の位置（段の頭から）

// 本道のマスの並び（S 入口 n なし m 敵 h 回復 u 最大HP i アイテム e 火柱 r ランダム M 中ボス B ボス）。sim/variants.ts の案H と同じ
const MAIN = 'Snmnhmrnmienmnrmen' + 'nmenmhrmnihmnemrnmhn' + 'Mhnmenmrnen' + 'nmnemhrmnimhnmenrmnhmn' + 'nmenmrnihnmeB';
const SHORT = ['mumni', 'mimnu', 'mumni'], LONG = ['nenhnnnrnen', 'nennhnnrnen', 'nenrnhnnnen'];

// 本道と短い道を1本の道として、つづら折りに並べる（段の頭から AT マス目に分かれ道を置く）
const cells = [];   // [x, y]
for (let row = 0; cells.length < 200; row++) {
  const y = Y0 + row * GAP, right = row % 2 === 0;
  for (let i = 0; i < RUN; i++) cells.push([right ? X0 + i : X0 + RUN - 1 - i, y]);
  const cx = right ? X0 + RUN - 1 : X0;
  for (let k = 1; k < GAP; k++) cells.push([cx, y + k]);
}
const period = RUN + GAP - 1;
const fork = [0, 1, 2].map(r => r * period + AT);          // 分かれ道（本道の最後のマス）の位置
const lens = [fork[0] + 1, fork[1] - (fork[0] + 6) + 1, fork[2] - (fork[1] + 6) + 1];
const main = [MAIN.slice(0, lens[0]), MAIN.slice(lens[0], lens[0] + lens[1]), MAIN.slice(lens[0] + lens[1], lens[0] + lens[1] + lens[2])];
main.push(MAIN.slice(lens[0] + lens[1] + lens[2]));
const total = main.join('').length + SHORT.join('').length;
const route = cells.slice(0, total);

const segs = [], ids = ['s0', 's2', 's4', 's6'];
let p = 0;
for (let k = 0; k < 4; k++) {
  const m = main[k], at = route.slice(p, p + m.length); p += m.length;
  segs.push({ id: ids[k], next: k < 3 ? [`a${k + 1}`, `b${k + 1}`] : [], cells: at.map(([x, y], i) => [x, y, m[i]]) });
  if (k === 3) break;
  const s = route.slice(p, p + 5); p += 5;
  segs.push({ id: `a${k + 1}`, next: [ids[k + 1]], cells: s.map(([x, y], i) => [x, y, SHORT[k][i]]) });
  // 長い道: 分かれ道のマスの真下から下へ3、横へ6、上へ2（行き先の段の向きに合わせる）
  const [fx, fy] = at[at.length - 1], dir = route[p][0] > fx ? 1 : -1, L = [];
  for (let d = 1; d <= 3; d++) L.push([fx, fy + d]);
  for (let d = 1; d <= 6; d++) L.push([fx + dir * d, fy + 3]);
  for (let d = 2; d >= 1; d--) L.push([fx + dir * 6, fy + d]);
  segs.push({ id: `b${k + 1}`, next: [ids[k + 1]], cells: L.map(([x, y], i) => [x, y, LONG[k][i]]) });
}
// 溶岩: 長い道の内側（2×5）と、各段の下のあいた所（分かれ道と反対の側）
const lava = [];
for (const k of [1, 2, 3]) {
  const b = segs.find(s => s.id === `b${k}`).cells, xs = b.map(c => c[0]), y = b[0][1];
  lava.push([Math.min(...xs) + 1, y, 5, 2]);
}
const rows = Math.floor((route[route.length - 1][1] - Y0) / GAP) + 1;   // 段の数（最後の段の下には置かない）
for (let r = 0; r < rows - 1; r++) {
  const y = Y0 + r * GAP + 2, right = r % 2 === 0;
  lava.push(right ? [X0 + 17, y, 5, 2] : [X0 + 2, y, 5, 2]);
}
// 確かめる: 重なりなし、続くマスは縦か横に1マス
const all = segs.flatMap(s => s.cells.map(c => `${c[0]},${c[1]}`));
if (new Set(all).size !== all.length) throw new Error('マスが重なっている');
for (const l of lava) for (const c of segs.flatMap(s => s.cells)) if (c[0] >= l[0] && c[0] < l[0] + l[2] && c[1] >= l[1] && c[1] < l[1] + l[3]) throw new Error('溶岩の上にマス ' + c);
const maxX = Math.max(...segs.flatMap(s => s.cells.map(c => c[0]))), maxY = Math.max(...segs.flatMap(s => s.cells.map(c => c[1])));
const data = JSON.parse(fs.readFileSync('data/dungeons.json', 'utf8'));
const fire = data.dungeons.find(d => d.id === 'fire');
fire.size = [maxX + 2, maxY + 2]; fire.segments = segs; fire.lava = lava; fire.event.damage = 7;
fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log('マス', all.length, '本道', main.map(m => m.length).join('/'), '大きさ', fire.size.join('×'), '→', OUT);
