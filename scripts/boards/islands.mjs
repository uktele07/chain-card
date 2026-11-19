// 盤面の案「島」: 溶岩の海の中、下から上へ島を渡る。分かれ道は、まっすぐの橋か回り込む橋か
// 中ボスの先は、溶岩の穴を囲む輪の島（鍵）→ 扉の橋 → 左の小島のボス
import { walk, fill } from '../board-dsl.mjs';
import { fork, SHORT, LONG } from './ring.mjs';
export function build() {
  const s0 = walk([11, 20], 'U3L4U2');
  const f1 = fork(s0.at(-1), 'U', 'L', SHORT[0], LONG[0]);
  const s2 = walk(f1.N, 'U2R8D4R3');
  const f2 = fork(s2.at(-1), 'U', 'R', SHORT[1], LONG[1]);
  const s4 = walk(f2.N, 'U2L7');
  const ringA = walk([10, 3], 'U2L6D2');
  const ringB = walk([4, 4], 'D1R6U1');
  const door = walk([3, 3], 'L2');
  const segs = [
    { id: 's0', cells: s0, kinds: 'Snmnhmrnmi', next: ['a1', 'b1'] },
    { id: 'a1', cells: f1.short, kinds: f1.shortK, next: ['s2'] }, { id: 'b1', cells: f1.long, kinds: f1.longK, next: ['s2'] },
    { id: 's2', cells: s2, kinds: fill('nmenmhrmnimn', s2.length), next: ['a2', 'b2'] },
    { id: 'a2', cells: f2.short, kinds: f2.shortK, next: ['s4'] }, { id: 'b2', cells: f2.long, kinds: f2.longK, next: ['s4'] },
    { id: 's4', cells: s4, kinds: 'nmnehmrnMn', next: ['r1'] },
    { id: 'r1', cells: ringA, kinds: fill('nmenmhnmren', ringA.length), next: ['r2', 'dr'] },
    { id: 'r2', cells: ringB, kinds: 'nmenkmhnm', next: ['r1'] },
    { id: 'dr', cells: door, kinds: 'DnB', next: [] },
  ];
  // 溶岩の海: 島と橋のまわりを広く埋める
  const lava = [[5, 2, 5, 3], [8, 10, 6, 6], [12, 13, 7, 3], [16, 8, 1, 3], [5, 10, 2, 4], [0, 5, 3, 13], [13, 18, 9, 3], [19, 6, 1, 4], [22, 3, 3, 12], [11, 0, 12, 2], [0, 0, 3, 2], [0, 4, 3, 1], [1, 2, 1, 1], [16, 12, 5, 1], [8, 16, 3, 1]];
  return { name: '島', size: [25, 22], segs, lava };
}
