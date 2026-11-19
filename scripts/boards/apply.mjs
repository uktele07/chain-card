// 盤面の案を data/dungeons.json の炎の神殿に書き込む。使い方: node scripts/boards/apply.mjs spiral
import fs from 'node:fs';
import { check, checkLava } from '../board-dsl.mjs';
const b = (await import(`./${process.argv[2]}.mjs`)).build();
const errs = [...check(b.segs), ...checkLava(b.segs, b.lava)];
if (errs.length) throw new Error(errs.join('\n'));
const data = JSON.parse(fs.readFileSync('data/dungeons.json', 'utf8')), fire = data.dungeons.find(d => d.id === 'fire');
fire.size = b.size; fire.lava = b.lava;
fire.segments = b.segs.map(s => ({ id: s.id, next: s.next, ...(s.both ? { both: true } : {}), cells: s.cells.map((c, i) => [c[0], c[1], s.kinds[i]]) }));
fire.event.damage = 7;   // 案H
// 書式はもとのファイルに合わせる（区間は1行ずつ、マスは [x, y, "種類"]）
const j = v => JSON.stringify(v).replace(/,/g, ', ').replace(/:/g, ': ');
const seg = s => `        { "id": ${j(s.id)}, "next": ${j(s.next)}, ${s.both ? '"both": true, ' : ''}"cells": ${j(s.cells)} }`;
let text = fs.readFileSync('data/dungeons.json', 'utf8');
text = text.replace(/"event": \{[^}]*\}/, `"event": ${j(fire.event).replace('{', '{ ').replace(/}$/, ' }')}`)
  .replace(/"cell": 64, "size": \[[^\]]*\]/, `"cell": 64, "size": ${j(fire.size)}`)
  .replace(/"lava": \[\[.*\]\],/, `"lava": ${j(fire.lava)},`)
  .replace(/"segments": \[\n[\s\S]*?\n      \]/, `"segments": [\n${fire.segments.map(seg).join(',\n')}\n      ]`);
JSON.parse(text);
fs.writeFileSync('data/dungeons.json', text);
console.log('書き込んだ', b.name, b.segs.reduce((n, s) => n + s.cells.length, 0), 'マス');
