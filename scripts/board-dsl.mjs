// 盤面を組む道具。道を「右へ5、下へ3」のような指示で並べ、重なり・つながり・離れたマス同士の接触を調べる
// 指示: R/L/U/D と数（例 'R5D3'）。道の最初のマスは start で与える
export function walk(start, moves) {
  const out = [start.slice()];
  let [x, y] = start;
  for (const [, d, n] of moves.matchAll(/([RLUD])(\d+)/g)) for (let i = 0; i < +n; i++) {
    x += d === 'R' ? 1 : d === 'L' ? -1 : 0; y += d === 'D' ? 1 : d === 'U' ? -1 : 0;
    out.push([x, y]);
  }
  return out;
}
/** 道（segments）を確かめる。重なり、道の中のつながり、行き先とのつながり、つながっていないマス同士の接触 */
export function check(segs) {
  const errs = [], key = c => `${c[0]},${c[1]}`, at = new Map();
  for (const s of segs) for (const c of s.cells) { if (at.has(key(c))) errs.push(`重なり ${key(c)} (${at.get(key(c))} と ${s.id})`); at.set(key(c), s.id); }
  const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  const links = new Set();
  const link = (a, b) => { links.add(`${key(a)}|${key(b)}`); links.add(`${key(b)}|${key(a)}`); };
  for (const s of segs) {
    if (s.kinds.length !== s.cells.length) errs.push(`${s.id}: マス ${s.cells.length} と中身 ${s.kinds.length} の数が違う`);
    for (let i = 1; i < s.cells.length; i++) { if (!adj(s.cells[i - 1], s.cells[i])) errs.push(`${s.id}: ${i} 番目が離れている`); link(s.cells[i - 1], s.cells[i]); }
    for (const n of s.next) { const t = segs.find(o => o.id === n); if (!t) { errs.push(`${s.id}: 行き先 ${n} がない`); continue; }
      if (!adj(s.cells.at(-1), t.cells[0])) errs.push(`${s.id} → ${n}: 離れている`); link(s.cells.at(-1), t.cells[0]); }
  }
  // つながっていないのに隣り合うマス（道が分かりにくくなる）
  const all = segs.flatMap(s => s.cells);
  for (const a of all) for (const b of all) if (key(a) < key(b) && adj(a, b) && !links.has(`${key(a)}|${key(b)}`)) errs.push(`接触 ${key(a)} と ${key(b)}`);
  return errs;
}
/** 溶岩の上にマスが乗っていないか */
export function checkLava(segs, lava) {
  const errs = [];
  for (const [x, y, w, h] of lava) for (const s of segs) for (const c of s.cells) if (c[0] >= x && c[0] < x + w && c[1] >= y && c[1] < y + h) errs.push(`溶岩の上 ${c} (${s.id})`);
  return errs;
}
/** 確かめるための文字の地図 */
export function ascii(segs, lava = [], w = 30, h = 22) {
  const g = Array.from({ length: h }, () => Array(w).fill(' '));
  for (const [x, y, lw, lh] of lava) for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) if (g[y + j]) g[y + j][x + i] = '~';
  for (const s of segs) s.cells.forEach((c, i) => { if (g[c[1]]) g[c[1]][c[0]] = s.kinds[i]; });
  return g.map(r => r.join('')).join('\n');
}
/** 中身の文字列を n マスぶん作る（パターンを繰り返す） */
export const fill = (pat, n) => Array.from({ length: n }, (_, i) => pat[i % pat.length]).join('');
