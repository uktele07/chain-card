// 画面: カード編集
import { LEVEL_LABELS } from '../game/battle';
import { W, H } from '../game/display';
import type { Layer } from '../game/ui';
import { RULES, ATTACKS, SPELLS } from '../game/content';
import { C, guide, rows } from './common';
import type { GameScene } from '../scenes/GameScene';

export function drawDeck(gs: GameScene, l: Layer) {
  l.rect(0, 0, W, H, { fill: C.bg });
  const sp = gs.save.spells, p = gs.weapon.power, nAtk = ATTACKS.reduce((n, c) => n + c.copies, 0);
  l.text(40, 40, 'カード編集', 24, C.text, 'start', true);
  l.text(920, 40, `デッキ ${nAtk + sp.length}枚　（アタック ${nAtk}　スペル ${sp.length}）`, 14, C.dim, 'end');
  // 左上: アタック（枚数は固定。威力は装備で決まる）
  const ay = rows(l, 40, 72, 400, 50, ATTACKS.length, -1, { heads: { 0: 'アタック（枚数は固定）' } });
  ATTACKS.forEach((c, i) => {
    const y = ay[i];
    l.rect(60, y - 16, 32, 32, { fill: C.attack, rx: 6 });
    l.text(76, y, LEVEL_LABELS[c.lv!], 18, C.text, 'middle', true);
    l.text(108, y, `威力 ${p[c.lv! - 1]}`, 15, C.text, 'start');
    l.text(418, y, `× ${c.copies}`, 17, C.text, 'end', true);
  });
  // 左下: 威力のもとになる装備
  const ey = rows(l, 40, 330, 400, 44, 2, -1, { heads: { 0: '装備' } });
  l.text(60, ey[0], '武器', 13, C.dim, 'start'); l.text(150, ey[0], gs.weapon.name, 16, C.text, 'start', true);
  l.text(60, ey[1], 'アクセサリ', 13, C.dim, 'start'); l.text(150, ey[1], 'なし', 16, C.faint, 'start', true);
  // 右: スペル（2枚まで、重複不可）。枠の下部に説明
  const sy = rows(l, 470, 72, 450, 50, SPELLS.length, gs.cur.deck, { heads: { 0: 'スペル（重複不可）' }, extra: 40 });
  const full = sp.length >= RULES.maxSpells;
  l.rect(828, 80, 72, 24, { fill: C.deep, stroke: full ? C.item : C.spell, sw: 1.5, rx: 12 });
  l.text(864, 92, `${sp.length} / ${RULES.maxSpells} 枚`, 12, C.text, 'middle', true);
  SPELLS.forEach((c, i) => {
    const y = sy[i], on = i === gs.cur.deck, inDeck = sp.includes(c.id);
    l.rect(506, y - 16, 32, 32, { fill: C.spell, rx: 6, alpha: inDeck ? 1 : 0.35 });
    l.text(522, y, c.mark, 15, C.text, 'middle', true, inDeck ? 1 : 0.6);
    l.text(554, y, c.name, 16, inDeck ? C.text : C.dim, 'start', on || inDeck);
    l.rect(832, y - 12, 68, 24, { fill: inDeck ? C.item : undefined, stroke: inDeck ? undefined : C.ng, sw: 1.5, rx: 12 });
    l.text(866, y, inDeck ? '採用中' : '未採用', 11, inDeck ? C.ink : C.faint, 'middle', inDeck);
  });
  l.line(490, 310, 900, 310, C.line, 1);
  l.text(490, 330, 'スペルの効果は、次に出すアタックに乗る。重ね掛け可。', 12, C.dim, 'start');
  const d = SPELLS[gs.cur.deck];
  l.rect(470, 368, 450, 76, { fill: C.deep, stroke: C.line, rx: 10 });
  l.text(494, 392, d.name, 15, C.text, 'start', true);
  l.text(494, 420, d.long, 12, C.dim, 'start');
  guide(gs, l, '↑↓ 選ぶ　　○ 入れる / 外す　　✕ 戻る', '↑↓ 選ぶ　　Enter 入れる / 外す　　Backspace 戻る');
}
