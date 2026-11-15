// 画面: 装備
import { W, H } from '../game/display';
import { iconKey } from '../game/art';
import type { Layer } from '../game/ui';
import { itemOf } from '../game/content';
import { C, EQUIP_ROWS, guide, powerChips, rows } from './common';
import type { GameScene } from '../scenes/GameScene';

export function drawEquip(gs: GameScene, l: Layer) {
  l.rect(0, 0, W, H, { fill: C.bg });
  l.text(40, 40, '装備', 24, C.text, 'start', true);
  const slots = gs.equipFocus === 'slots', s = gs.save;
  const value = (i: number) => (i === 0 ? gs.weapon.name : i === 1 ? gs.armor.name : i === 2 ? '準備中' : itemOf(s.items[i - 3])?.name ?? 'なし');
  const ys = rows(l, 40, 72, 400, 50, EQUIP_ROWS.length, gs.cur.slot, { heads: { 0: '装備', 3: 'アイテム（重複不可）' }, active: slots });
  EQUIP_ROWS.forEach((name, i) => {
    const y = ys[i], off = i === 2, v = value(i), empty = off || v === 'なし';
    l.text(80, y, name, 14, off ? C.faint : C.dim, 'start');
    l.text(418, y, v, 16, empty ? C.faint : C.text, 'end', i === gs.cur.slot && !empty);
    if (i >= 3 && !empty) l.image(iconKey(s.items[i - 3]), 418 - v.length * 16 - 20, y, 26);
  });
  const opts = gs.equipOptions(), shown = slots ? Math.max(0, opts.findIndex(o => o.on)) : gs.cur.opt;
  const oy = rows(l, 470, 72, 450, 46, opts.length, shown, { heads: { 0: `${EQUIP_ROWS[gs.cur.slot]} を選ぶ` }, active: !slots, dim: slots });
  opts.forEach((o, i) => {
    const y = oy[i], on = i === shown, al = slots ? 0.55 : 1;
    if (o.id) l.image(iconKey(o.id === 'none' ? null : o.id), 526, y, 28, al);
    l.text(o.id ? 550 : 510, y, o.name, 16, C.text, 'start', on, al);
    if (o.note) l.text(898, y, o.note, 11, C.dim, 'end');
  });
  const d = opts[shown];
  l.rect(470, 400, 450, 96, { fill: C.deep, stroke: C.line, rx: 10 });
  if (d && (d.power || d.def !== undefined)) {
    // 武器・防具: ショップと同じく、選んでいる物と現在の装備を上下にそろえて比べる
    const same = d.on;
    l.text(494, 422, d.name, 14, C.text, 'start', true);
    if (d.power) powerChips(l, 660, 422, d.power); else l.text(660, 422, `被ダメージ −${d.def}${d.def ? '（最低1）' : ''}`, 15, C.text, 'start', true);
    if (same) l.text(494, 448, '装備中', 12, C.dim, 'start');
    else {
      l.text(494, 448, `現在: ${d.power ? gs.weapon.name : gs.armor.name}`, 12, C.dim, 'start');
      if (d.power) powerChips(l, 660, 448, gs.weapon.power, 0.6); else l.text(660, 448, `被ダメージ −${gs.armor.def}`, 15, C.dim, 'start', true);
    }
    l.text(494, 476, d.desc, 12, C.dim, 'start');
  } else {
    if (d?.id) l.image(iconKey(d.id === 'none' ? null : d.id), 506, 448, 44);
    l.text(d?.id ? 542 : 494, 434, d?.name ?? '', 15, C.text, 'start', true);
    l.text(d?.id ? 542 : 494, 462, d?.desc ?? '', 12, C.dim, 'start');
  }
  guide(gs, l, slots ? '↑↓ 選ぶ　　○ 変更　　✕ 戻る' : '↑↓ 選ぶ　　○ セット　　✕ やめる', slots ? '↑↓ 選ぶ　　Enter 変更　　Backspace 戻る' : '↑↓ 選ぶ　　Enter セット　　Backspace やめる');
}
