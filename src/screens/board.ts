// 画面: ダンジョンの盤面（すごろく）
// 層の使い方: 0=盤面の絵 / 1=マスの絵柄と行き先の印 / 2=駒と情報の枠 / 3=メニューなど
import { W } from '../game/display';
import { BOARD_PAD, boardKey, squareIconKey } from '../game/art';
import type { Layer } from '../game/ui';
import type { Effect, Square } from '../game/dungeon';
import { enemyById, itemOf, ACCESSORIES } from '../game/content';
import { C, CX, SQUARE, DMENU, guide, dim, panel } from './common';
import type { GameScene } from '../scenes/GameScene';

const BOX = '#0b0d13';

/** マスの効果を、画面に出す言葉にする */
export function effectText(gs: GameScene, eff: Effect): { head: string; main: string; color: string; icon: string } {
  const run = gs.run!, kind = eff.kind === 'monster' ? (eff.rank === 'zako' ? 'monster' : eff.rank) : eff.kind;
  const sq = SQUARE[kind], head = eff.random ? 'ランダムのマス' : `${sq.name}のマス`;
  let main = '何も起こらない';
  if (eff.kind === 'monster') main = `${enemyById(eff.enemy).name} が現れた！`;
  else if (eff.kind === 'heal') main = eff.amount > 0 ? `HP +${eff.amount}` : 'HP は満タン';
  else if (eff.kind === 'maxhp') main = `最大HP +${eff.amount}`;
  else if (eff.kind === 'item') main = eff.index >= 0 ? `${itemOf(gs.save.items[eff.index])?.name ?? 'アイテム'} が復活` : '復活するアイテムなし';
  else if (eff.kind === 'event') main = `${run.def.event.name}！ ${eff.damage} ダメージ`;
  return { head, main, color: sq.color, icon: sq.icon };
}

export function drawBoard(gs: GameScene, l0: Layer, l1: Layer, l2: Layer) {
  const run = gs.run;
  if (!run) return;
  const def = run.def, G = def.cell, Wd = def.size[0] * G, Hd = def.size[1] * G, P = BOARD_PAD;
  const cx = gs.cam.x, cy = gs.cam.y, st = run.state, mode = gs.bmode, look = mode === 'look';
  l0.rect(0, 0, W, 540, { fill: '#0e0b0a' });
  l0.image(boardKey(def.id), Wd / 2 - cx, Hd / 2 - cy, Wd + P * 2, 1, undefined, Hd + P * 2);

  // マス
  const ahead = gs.aheadOf(st.pos), reach = mode === 'idle' || look ? gs.reachOf(st.pos) : new Set<number>();
  const opts = mode === 'choose' ? run.options() : [];
  const mid = (q: Square) => ({ x: q.x * G + G / 2 - cx, y: q.y * G + G / 2 - cy });
  for (const q of run.board) {
    const { x, y } = mid(q);
    if (x < -G || x > W + G || y < -G || y > 540 + G) continue;
    const sq = SQUARE[q.kind], passed = !ahead.has(q.id) && q.id !== st.pos, al = passed ? 0.4 : 1;
    const big = q.kind === 'boss' ? 54 : q.kind === 'mid' ? 48 : 38;
    if (sq.icon) {
      l1.rect(x - big / 2, y - big / 2, big, big, { fill: sq.color, stroke: '#1b1513', sw: 3, rx: 8, alpha: al });
      l1.image(squareIconKey(sq.icon), x, y, big * 1.25, al);
    }
    if (reach.has(q.id)) l1.rect(x - G / 2 + 2, y - G / 2 + 2, G - 4, G - 4, { stroke: C.keep, sw: 3, rx: 5 });
  }
  // 分かれ道: 行き先のマスを強調して選ぶ
  opts.forEach((id, i) => {
    const q = run.board[id], { x, y } = mid(q), from = mid(run.square), on = i === gs.pick, col = on ? C.white : C.keep;
    const a = Math.atan2(y - from.y, x - from.x), n = run.board.filter(o => o.seg === q.seg).length;
    l1.rect(x - G / 2 + 1, y - G / 2 + 1, G - 2, G - 2, { stroke: col, sw: on ? 5 : 3, rx: 5 });
    l1.tri((x + from.x) / 2, (y + from.y) / 2, on ? 13 : 10, a, col);
    const ly = y + (a > 0.1 ? 46 : -46);
    l1.rect(x - 44, ly - 12, 88, 24, { fill: BOX, stroke: col, sw: 1.5, rx: 12 });
    l1.text(x, ly, `${n}マスの道`, 12, col, 'middle', true);
  });
  // いまのマスと駒
  const here = mid(run.square), px = gs.piece.x - cx, py = gs.piece.y - cy;
  if (mode !== 'moving') l2.rect(here.x - G / 2 + 1, here.y - G / 2 + 1, G - 2, G - 2, { stroke: C.white, sw: 4, rx: 5 });
  l2.circle(px, py + 2, 17, { fill: '#10141c', alpha: 0.5 });
  l2.circle(px, py, 15, { fill: '#f4f6fb', stroke: '#10141c', sw: 2.5 });
  l2.circle(px, py, 7, { fill: '#4a8fd9' });

  if (mode === 'cleared') { drawCleared(gs, l2); return; }

  // 情報の枠（先を見ている間は隠す）
  if (look) {
    l2.rect(360, 16, 240, 36, { fill: BOX, stroke: C.keep, sw: 1.5, rx: 18, alpha: 0.9 });
    l2.text(CX, 34, '先を見ています', 14, C.keep, 'middle', true);
    ([[CX, 76, -Math.PI / 2], [CX, 488, Math.PI / 2], [26, 270, Math.PI], [934, 270, 0]] as const).forEach(([x, y, a]) => l2.tri(x, y, 11, a, C.white, 0.85));
  } else {
    const gate = run.distanceToGate(), where = mode === 'choose' ? '分かれ道' : `${st.midDone ? 'ボス' : '中ボス'}まで あと ${gate}マス`;
    l2.rect(16, 14, 330, 92, { fill: BOX, stroke: C.line, sw: 1.5, rx: 12, alpha: 0.9 });
    l2.text(32, 36, def.name, 18, C.text, 'start', true);
    l2.text(330, 30, where, 11, C.dim, 'end');
    if (st.maxBonus > 0) l2.text(330, 46, `最大HP +${st.maxBonus}`, 10, '#e07ab0', 'end', true);
    l2.text(32, 63, 'HP', 11, C.dim, 'start', true);
    l2.rect(60, 57, 170, 12, { fill: '#1d2330', rx: 6 });
    l2.rect(60, 57, 170 * st.hp / run.maxHp, 12, { fill: st.hp <= run.maxHp * 0.3 ? C.miss : C.item, rx: 6 });
    l2.text(330, 64, `${st.hp} / ${run.maxHp}`, 14, C.text, 'end', true);
    gs.save.items.forEach((id, i) => {
      const it = itemOf(id), used = !it || st.used[i], x = 32 + i * 100;
      l2.rect(x, 78, 94, 20, { fill: used ? '#141821' : C.itemBg, stroke: used ? C.ng : C.item, sw: 1.2, rx: 6 });
      l2.text(x + 47, 88, it ? it.name : 'なし', 11, used ? C.faint : C.text);
    });
    const drop = enemyById(def.zako[0]).drop;
    l2.rect(700, 14, 244, 44, { fill: BOX, stroke: C.line, sw: 1.5, rx: 12, alpha: 0.9 });
    l2.text(716, 36, `${gs.save.gold} G`, 13, C.keep, 'start', true);
    if (drop) l2.text(928, 36, `${drop.name} ×${gs.save.loot[drop.id] ?? 0}`, 13, C.keep, 'end', true);
    drawDice(gs, l2);
  }
  drawMinimap(gs, l2, Wd, Hd);

  if (mode === 'landed' && gs.effect) {
    const t = effectText(gs, gs.effect), fightNext = gs.effect.kind === 'monster';
    l2.rect(300, 372, 360, 104, { fill: BOX, stroke: t.color, rx: 14, alpha: 0.96 });
    l2.rect(322, 400, 48, 48, { fill: t.color, rx: 10 });
    if (t.icon) l2.image(squareIconKey(t.icon), 346, 424, 58);
    l2.text(388, 398, t.head, 12, C.dim, 'start');
    l2.text(388, 424, t.main, 19, C.text, 'start', true);
    l2.text(388, 452, `${gs.pad ? '○' : 'Enter'} ${fightNext ? '戦う' : '次へ'}`, 13, C.keep, 'start', true);
  }
  if (mode === 'choose') {
    l2.rect(330, 458, 300, 34, { fill: BOX, stroke: C.keep, sw: 1.5, rx: 17, alpha: 0.92 });
    l2.text(CX, 475, '進む道を選ぶ', 14, C.keep, 'middle', true);
  }
  if (look) guide(gs, l2, '十字キー 動かす　　□ / ✕ 戻る', '矢印キー 動かす　　A / Backspace 戻る');
  else if (mode === 'choose') guide(gs, l2, '十字キー 選ぶ　　○ 決定　　□ 先を見る', '矢印キー 選ぶ　　Enter 決定　　A 先を見る');
  else if (mode === 'landed') guide(gs, l2, gs.effect?.kind === 'monster' ? '○ 戦う' : '○ 次へ', gs.effect?.kind === 'monster' ? 'Enter 戦う' : 'Enter 次へ');
  else if (mode === 'idle') guide(gs, l2, '○ サイコロを振る　　□ 先を見る　　OPTIONS メニュー', 'Enter サイコロを振る　　A 先を見る　　Esc メニュー');
  else guide(gs, l2, '', '');
}

function drawDice(gs: GameScene, l: Layer) {
  const x = 892, y = 428, n = gs.diceFace, st = gs.run!.state, mode = gs.bmode;
  const PIPS: Record<number, number[][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  l.rect(x - 34, y - 34, 68, 68, { fill: n ? '#f4f6fb' : '#1d2330', stroke: n ? '#c9cfdb' : C.line, rx: 14 });
  for (const [dx, dy] of PIPS[n] ?? []) l.circle(x + dx * 18, y + dy * 18, 6.5, { fill: C.ink });
  if (!n) l.text(x, y, '？', 28, C.dim, 'middle', true);
  const label = mode === 'idle' ? `${gs.pad ? '○' : 'Enter'} 振る` : mode === 'rolling' ? '…' : st.steps > 0 ? `あと ${st.steps}マス` : `${gs.rolled} 進んだ`;
  l.rect(x - 46, y + 42, 92, 24, { fill: BOX, rx: 12, alpha: 0.85 });
  l.text(x, y + 54, label, 12, C.keep, 'middle', true);
}

/** 左下の全体図。道・関所・いる場所・いま映っている範囲 */
function drawMinimap(gs: GameScene, l: Layer, Wd: number, Hd: number) {
  const run = gs.run!, G = run.def.cell, k = 5.4 / G, w = Wd * k + 12, h = Hd * k + 12, x0 = 16, y0 = 500 - h;
  l.rect(x0, y0, w, h, { fill: BOX, stroke: C.line, sw: 1.5, rx: 8, alpha: 0.9 });
  for (const q of run.board) {
    const x = x0 + 6 + q.x * G * k, y = y0 + 6 + q.y * G * k, here = q.id === run.state.pos;
    const col = here ? '#5fb0e8' : q.kind === 'boss' ? '#ff5a4a' : q.kind === 'mid' && !run.state.midDone ? '#c8453c' : '#6b5f58';
    const big = here || q.kind === 'boss' || q.kind === 'mid' ? 1.5 : 0;
    l.rect(x - big, y - big, 4.6 + big * 2, 4.6 + big * 2, { fill: col, stroke: here ? C.white : undefined, sw: 1, rx: 1 });
  }
  const vx = Math.max(0, gs.cam.x), vy = Math.max(0, gs.cam.y), vr = Math.min(Wd, gs.cam.x + W), vb = Math.min(Hd, gs.cam.y + 540);
  l.rect(x0 + 6 + vx * k, y0 + 6 + vy * k, (vr - vx) * k, (vb - vy) * k, { stroke: C.white, sw: 1, rx: 2, alpha: 0.7 });
}

/** 踏破: 報酬だけを見せる */
function drawCleared(gs: GameScene, l: Layer) {
  const run = gs.run!, r = gs.reward, acc = ACCESSORIES.find(a => a.id === r?.accessory);
  dim(l);
  l.rect(280, 110, 400, 330, { fill: '#12151d', stroke: C.keep, rx: 16 });
  l.text(CX, 152, `${run.def.name} 踏破`, 24, C.text, 'middle', true);
  l.text(CX, 192, acc ? '初回の踏破報酬' : '踏破報酬', 12, C.keep, 'middle', true);
  if (acc) {
    l.circle(CX, 262, 40, { fill: '#ff8a2a', alpha: 0.25 });
    l.circle(CX, 262, 27, { stroke: '#ffd24a', sw: 9 });
    l.circle(CX, 232, 9, { fill: '#ff5a2a', stroke: '#ffd24a', sw: 2 });
    l.text(CX, 328, acc.name, 22, C.text, 'middle', true);
    l.text(CX, 356, acc.desc, 13, C.dim);
  } else {
    l.text(CX, 268, `${r?.gold ?? 0} G`, 40, C.keep, 'middle', true);
    l.text(CX, 340, `所持金  ${gs.save.gold} G`, 13, C.dim);
  }
  l.rect(380, 384, 200, 40, { fill: C.sel, stroke: C.white, rx: 8 });
  l.text(CX, 404, '外に出る', 15, C.text, 'middle', true);
  guide(gs, l, '○ 決定', 'Enter 決定');
}

export function drawDMenu(gs: GameScene, l: Layer) {
  dim(l, 0.6);
  panel(l, gs.run?.def.name ?? '', DMENU.map((label, i) => ({ label: i === 1 && gs.restartArmed ? 'もう一度押すと、やり直す' : label, note: i === 2 ? '続きから再開できる' : undefined })), gs.cur.dmenu, 130, 380);
  guide(gs, l, '↑↓ 選ぶ　　○ 決定　　✕ / OPTIONS 閉じる', '↑↓ 選ぶ　　Enter 決定　　Backspace / Esc 閉じる');
}
