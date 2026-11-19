// 盤面の案「輪」: 外周を回って中ボス → 中心を囲む輪（後半に鍵）→ 扉 → 中心のボス
import { walk, fill } from '../board-dsl.mjs';
/** 分かれ道: F から d の向きに短い道5マス、s の向きへ回り込む長い道11マス。行き先 N は F から d に6マス */
export function fork(F, d, s, shortK, longK) {
  const v = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] }, [dx, dy] = v[d], [sx, sy] = v[s];
  const short = [1, 2, 3, 4, 5].map(i => [F[0] + dx * i, F[1] + dy * i]);
  const long = [];
  for (let i = 1; i <= 3; i++) long.push([F[0] + sx * i, F[1] + sy * i]);
  for (let i = 1; i <= 6; i++) long.push([F[0] + dx * i + sx * 3, F[1] + dy * i + sy * 3]);
  for (let i = 2; i >= 1; i--) long.push([F[0] + dx * 6 + sx * i, F[1] + dy * 6 + sy * i]);
  return { short, long, N: [F[0] + dx * 6, F[1] + dy * 6], shortK, longK };
}
export const SHORT = ['mumni', 'mimnu'], LONG = ['nenhnnnrnen', 'nennhnnrnen'];
export function build() {
  const s0 = walk([2, 18], 'U4R6');
  const f1 = fork(s0.at(-1), 'R', 'D', SHORT[0], LONG[0]);
  const s2 = walk(f1.N, 'R6U10L4');
  const f2 = fork(s2.at(-1), 'L', 'U', SHORT[1], LONG[1]);
  const s4 = walk(f2.N, 'L6D5R2');
  const ringA = walk([7, 9], 'U2R9D3');
  const ringB = walk([16, 11], 'D1L9U2');
  const door = walk([15, 10], 'L3');
  const segs = [
    { id: 's0', cells: s0, kinds: 'Snmnhmrnmie', next: ['a1', 'b1'] },
    { id: 'a1', cells: f1.short, kinds: f1.shortK, next: ['s2'] }, { id: 'b1', cells: f1.long, kinds: f1.longK, next: ['s2'] },
    { id: 's2', cells: s2, kinds: fill('nmenmhrmnimn', s2.length), next: ['a2', 'b2'] },
    { id: 'a2', cells: f2.short, kinds: f2.shortK, next: ['s4'] }, { id: 'b2', cells: f2.long, kinds: f2.longK, next: ['s4'] },
    { id: 's4', cells: s4, kinds: 'nmnemhrnmenMhn', next: ['r1'] },
    { id: 'r1', cells: ringA, kinds: 'nmenmhnmrnmenmn', next: ['r2', 'dr'] },
    { id: 'r2', cells: ringB, kinds: 'nmenmhnmkenmn', next: ['r1'] },
    { id: 'dr', cells: door, kinds: 'DnnB', next: [] },
  ];
  const lava = [[9, 15, 5, 2], [11, 2, 5, 2], [8, 8, 8, 2], [8, 11, 8, 1], [8, 10, 4, 1], [22, 6, 3, 5], [17, 16, 3, 3]];
  return { name: '輪', size: [26, 20], segs, lava };
}
