// 盤面の案「蛇行」の手直し（2026-11-19、持ち主の指示。見本だけ。data にはまだ書き込まない）
// - 右下の輪を 18 → 16マスに（モンスター1つ、火柱1つを減らす）。6×4 の長方形の外周
// - 中ボスの下（輪の上辺の真ん中）から輪に入り、左右どちらへ進むか選べる（輪の中は両向きに進める。引き返しはしない）
// - 鍵は、入口から左右どちら回りでも 7マス以上先（下辺の真ん中。ちょうど反対側）
// - ボスの扉は輪の上辺（入口の2つ左のマスから上へ）
import { walk } from '../board-dsl.mjs';
import { build as base } from './spiral.mjs';
export function build() {
  const b = base();
  const s4 = walk(b.segs.find(s => s.id === 's4').cells[0], 'R2D6L4D3');   // 中ボスを輪の上辺の真ん中の真上に
  // 輪: 入口 E=[22,15] から右回りに 0〜15 の番号
  const ring = [[22, 15], ...walk([22, 15], 'R2D3L5U3R2').slice(1, 16)];
  const RING = 'nmenhmnrknmennnn';   // 敵3、火柱2、回復1、ランダム1、鍵1（8番）、なし8。14番が扉への分かれ目
  const door = walk([20, 14], 'U2');
  const segs = b.segs.filter(s => !['s4', 'r1', 'r2', 'dr'].includes(s.id));
  segs.push(
    { id: 's4', cells: s4, kinds: 'nmnemhrnmenmM'.padStart(s4.length, 'n'), next: ['r1'] },
    // 見本では片向きの道として並べる（両向きの動きは、ルールを変えるときに作る）
    { id: 'r1', cells: ring.slice(0, 15), kinds: RING.slice(0, 15), next: ['r2', 'dr'] },
    { id: 'r2', cells: ring.slice(15), kinds: RING.slice(15), next: [] },
    { id: 'dr', cells: door, kinds: 'DnB', next: [] },
  );
  const lava = b.lava.filter(l => !(l[0] === 20 && l[1] === 16) && !(l[0] === 15 && l[1] === 16)).concat([[20, 16, 4, 2], [15, 15, 3, 4]]);
  // 見本で示す範囲と、輪のマスに付ける番号（入口からの近いほうの歩数）
  const labels = ring.map(([x, y], i) => [x, y, String(Math.min(i, 16 - i))]);
  const notes = [[22, 14, '中ボス → 入口で左右を選ぶ', 'r'], [20, 13, '扉 → ボス', 'l'], [21, 18, '鍵（入口から 8マス）', 'b']];
  return { name: '蛇行（輪の手直し）', size: b.size, segs, lava, view: [14, 9, 28, 21], labels, notes };
}
