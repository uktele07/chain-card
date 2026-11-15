// 画面: 敵の一覧
import { iconKey, monsterKey } from '../game/art';
import type { Layer } from '../game/ui';
import { ENEMIES, itemOf } from '../game/content';
import { C, ENEMY_COL, guide, rankBadge, rows } from './common';
import type { GameScene } from '../scenes/GameScene';

// --- 敵の一覧 ---
export function drawList(gs: GameScene, l: Layer) {
  l.text(40, 40, '敵を選ぶ', 24, C.text, 'start', true);
  l.text(920, 40, `所持金  ${gs.save.gold} G`, 16, C.keep, 'end', true);
  const ys = rows(l, 40, 72, 400, 62, ENEMIES.length, gs.cur.list);
  ENEMIES.forEach((e, i) => {
    const y = ys[i], on = i === gs.cur.list, open = gs.unlocked(e), rec = gs.save.records[e.id];
    l.rect(78, y - 20, 40, 40, { fill: open ? ENEMY_COL[e.id] ?? C.dim : C.ng, rx: 8, alpha: 0.9 });
    l.text(98, y, open ? e.rank ?? '' : '？', 18, open ? C.ink : C.dim, 'middle', true);
    if (!open) {
      l.text(134, y - 10, '？？？', 17, C.dim, 'start', true);
      l.text(134, y + 12, '出現条件: 上の敵をすべて討伐', 11, C.dim, 'start');
      return;
    }
    l.text(134, y - 10, e.name, 17, C.text, 'start', on);
    l.text(134, y + 12, `HP ${e.hp}`, 11, C.dim, 'start');
    if (rec) {
      rankBadge(l, 406, y, rec.bestRank, 32);
      l.text(378, y - 10, '自己ベスト', 10, C.dim, 'end');
      l.text(378, y + 11, `${rec.bestTime.toFixed(1)}秒`, 15, C.text, 'end', true);
    } else l.text(418, y, '未討伐', 14, C.faint, 'end', true);
  });
  l.text(40, 414, 'アイテム', 12, C.dim, 'start');
  gs.save.items.forEach((id, i) => {
    const it = itemOf(id), x = 40 + i * 136;
    l.rect(x, 428, 128, 40, { fill: it ? C.itemBg : C.panel, stroke: it ? C.item : C.ng, sw: 1.5, rx: 8 });
    l.image(iconKey(id), x + 22, 448, 26);
    l.text(x + 42, 448, it ? it.name : 'なし', 13, it ? C.text : C.faint, 'start');
  });

  // 右: 選択中の敵
  const e = ENEMIES[gs.cur.list], open = gs.unlocked(e), beaten = !!gs.save.records[e.id];
  l.rect(470, 72, 450, 420, { fill: C.panel, stroke: C.line, rx: 12 });
  l.image(monsterKey(open ? e.id : 'unknown'), 800, 160, 186);
  if (!open) {
    l.text(494, 106, '？？？', 24, C.dim, 'start', true);
    l.text(494, 290, '上の敵をすべて討伐すると現れる。', 14, C.dim, 'start');
  } else {
    l.text(494, 106, e.name, 24, C.text, 'start', true);
    l.text(494, 136, `HP ${e.hp}`, 15, C.dim, 'start', true);
    l.text(494, 250, '攻撃パターン（上から順に繰り返し）', 12, C.dim, 'start');
    const pitch = Math.min(36, 196 / e.actions.length);
    e.actions.forEach((a, i) => {
      const y = 266 + i * pitch, h = pitch - 6;
      l.rect(494, y, 402, h, { fill: a.big ? '#3a1d20' : C.deep, stroke: a.big ? C.miss : undefined, sw: 1.5, rx: 6 });
      l.text(510, y + h / 2, (a.big ? '！ ' : '') + a.name, 14, a.big ? C.warn : C.text, 'start', !!a.big);
      if (beaten) {
        l.text(760, y + h / 2, `${a.chargeSec}秒`, 13, C.dim, 'end');
        l.text(880, y + h / 2, `${a.damage} ダメージ`, 13, a.big ? C.warn : C.text, 'end');
      } else l.text(880, y + h / 2, '？？？', 13, C.faint, 'end');
    });
    const sec = e.actions.reduce((s, a) => s + a.chargeSec, 0), dmg = e.actions.reduce((s, a) => s + a.damage, 0);
    if (beaten) l.text(494, 474, `1巡 約${Math.round(sec)}秒・計 ${dmg} ダメージ`, 12, C.dim, 'start');
    if (e.drop) l.text(896, 474, beaten ? `戦利品  ${e.drop.name}（${e.drop.price} G）` : '戦利品  ？？？', 12, C.dim, 'end');
  }
  guide(gs, l, '↑↓ 選ぶ　　○ 決定　　OPTIONS メニュー', '↑↓ 選ぶ　　Enter 決定　　Esc メニュー');
}
