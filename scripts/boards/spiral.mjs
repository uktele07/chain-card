// 炎の神殿の盤面「蛇行」（2026-11-19、持ち主が決めた）。曲がりくねった一本道（曲がる長さが毎回違う）で中ボスへ
// → 右下の輪（鍵）→ 扉 → ボス。書き込みは node scripts/boards/apply.mjs spiral
// 輪（2026-11-19 に手直し）:
// - 16マス（6×4 の長方形の外周）。中ボスの真下が入口で、入口で左右どちらへ進むか選ぶ
// - 輪の中は両向きに進める道（both）。来たマスには戻らないので、1周して入口に戻っても向きは変わらない
// - 鍵は、入口から左右どちら回りでも 8マス先（下辺。ちょうど反対側）
// - 扉は輪の上辺。入口の3つ左のマス（入口との間は2マス）から上へ出る
import { walk, fill } from '../board-dsl.mjs';
import { fork, SHORT, LONG } from './ring.mjs';
export function build() {
  const s0 = walk([1, 17], 'R3U3R4');
  const f1 = fork(s0.at(-1), 'R', 'D', SHORT[0], LONG[0]);
  const s2 = walk(f1.N, 'R2U5L5U4R7');
  const f2 = fork(s2.at(-1), 'R', 'U', SHORT[1], LONG[1]);
  const s4 = walk(f2.N, 'R2D6L4D3');
  // 輪: 入口 E=[22,15] から右回りに 0〜15 の番号。13番が扉への分かれ目
  const ring = [[22, 15], ...walk([22, 15], 'R1D3L5U3R3').slice(1, 16)];
  const RING = 'nmenhmnrknmennhn';   // 敵3、火柱2、回復2、ランダム1、鍵1（8番）、なし7
  const door = walk([19, 14], 'U2');
  const segs = [
    { id: 's0', cells: s0, kinds: 'Snmnhmrnmie', next: ['a1', 'b1'] },
    { id: 'a1', cells: f1.short, kinds: f1.shortK, next: ['s2'] }, { id: 'b1', cells: f1.long, kinds: f1.longK, next: ['s2'] },
    { id: 's2', cells: s2, kinds: fill('nmenmhrmnimn', s2.length), next: ['a2', 'b2'] },
    { id: 'a2', cells: f2.short, kinds: f2.shortK, next: ['s4'] }, { id: 'b2', cells: f2.long, kinds: f2.longK, next: ['s4'] },
    { id: 's4', cells: s4, kinds: 'nmnemhrnmenmM'.padStart(s4.length, 'n'), next: ['r1'] },
    { id: 'r1', cells: ring.slice(0, 14), kinds: RING.slice(0, 14), next: ['r2', 'dr'], both: true },
    { id: 'r2', cells: ring.slice(14), kinds: RING.slice(14), next: ['r1'], both: true },
    { id: 'dr', cells: door, kinds: 'DnB', next: [] },
  ];
  const lava = [[9, 15, 5, 2], [19, 3, 5, 2], [19, 16, 4, 2], [12, 6, 4, 3], [2, 2, 7, 4], [15, 15, 2, 4], [1, 7, 3, 6]];
  const labels = ring.map(([x, y], i) => [x, y, String(Math.min(i, 16 - i))]);   // 全体図の見本で、輪のマスに入口からの歩数を付ける
  const notes = [[22, 14, '中ボス → 入口で左右を選ぶ', 'r'], [19, 13, '扉 → ボス', 'l'], [19, 18, '鍵（入口から 8マス）', 'b']];
  return { name: '蛇行', size: [28, 21], segs, lava, labels, notes, ringView: [14, 9, 28, 21] };
}
