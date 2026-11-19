// 盤面の案を確かめる: node scripts/boards/show.mjs ring
import { check, checkLava, ascii } from '../board-dsl.mjs';
const m = await import(`./${process.argv[2]}.mjs`), b = m.build();
const errs = [...check(b.segs), ...checkLava(b.segs, b.lava)];
console.log(ascii(b.segs, b.lava, b.size[0], b.size[1]));
console.log('マス', b.segs.reduce((n, s) => n + s.cells.length, 0), errs.length ? '\n' + errs.join('\n') : 'OK');
