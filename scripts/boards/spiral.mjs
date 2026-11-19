// 盤面の案「蛇行」: 曲がりくねった一本道（曲がる長さが毎回違う）で中ボスへ → 右下の輪（鍵）→ 扉 → 左へ突き出た岬のボス
import { walk, fill } from '../board-dsl.mjs';
import { fork, SHORT, LONG } from './ring.mjs';
export function build() {
  const s0 = walk([1, 17], 'R3U3R4');
  const f1 = fork(s0.at(-1), 'R', 'D', SHORT[0], LONG[0]);
  const s2 = walk(f1.N, 'R2U5L5U4R7');
  const f2 = fork(s2.at(-1), 'R', 'U', SHORT[1], LONG[1]);
  const s4 = walk(f2.N, 'R2D6L2D3');
  const ringA = walk([24, 15], 'R1D3L6U1');
  const ringB = walk([19, 16], 'U1R4');
  const door = walk([18, 17], 'L2');
  const segs = [
    { id: 's0', cells: s0, kinds: 'Snmnhmrnmie', next: ['a1', 'b1'] },
    { id: 'a1', cells: f1.short, kinds: f1.shortK, next: ['s2'] }, { id: 'b1', cells: f1.long, kinds: f1.longK, next: ['s2'] },
    { id: 's2', cells: s2, kinds: fill('nmenmhrmnimn', s2.length), next: ['a2', 'b2'] },
    { id: 'a2', cells: f2.short, kinds: f2.shortK, next: ['s4'] }, { id: 'b2', cells: f2.long, kinds: f2.longK, next: ['s4'] },
    { id: 's4', cells: s4, kinds: 'nmnemhrnmenmM'.padStart(s4.length, 'n'), next: ['r1'] },
    { id: 'r1', cells: ringA, kinds: fill('nmenmhnmren', ringA.length), next: ['r2', 'dr'] },
    { id: 'r2', cells: ringB, kinds: 'nkmenn', next: ['r1'] },
    { id: 'dr', cells: door, kinds: 'DnB', next: [] },
  ];
  const lava = [[9, 15, 5, 2], [19, 3, 5, 2], [20, 16, 5, 2], [12, 6, 4, 3], [2, 2, 7, 4], [15, 16, 1, 3], [1, 7, 3, 6]];
  return { name: '蛇行', size: [28, 21], segs, lava };
}
