// 画面: 結果
import type { Layer } from '../game/ui';
import { C, CX, guide, dim, rankBadge } from './common';
import type { GameScene } from '../scenes/GameScene';

// --- 結果 ---
export function drawResult(gs: GameScene, l: Layer) {
  const b = gs.battle, won = b.result === 'won';
  dim(l, 0.5);
  l.rect(CX - 230, 150, 460, 336, { fill: C.panel, stroke: won ? C.line : C.miss, rx: 12 });
  l.text(CX, 190, won ? `${gs.enemy.name} 討伐` : '敗北', 24, won ? C.text : C.warn, 'middle', true);
  if (won) {
    l.text(CX - 190, 252, '討伐タイム', 13, C.dim, 'start');
    l.text(CX + 120, 252, `${b.time.toFixed(1)} 秒`, 30, C.text, 'end', true);
    if (gs.outcome.rank) rankBadge(l, CX + 164, 252, gs.outcome.rank, 52);
    if (gs.outcome.newBest) { l.rect(CX + 16, 280, 104, 22, { fill: C.keep, rx: 11 }); l.text(CX + 68, 291, '自己ベスト更新', 11, C.ink, 'middle', true); }
    else if (b.usedInvincible) l.text(CX + 120, 291, '無敵使用のため記録なし', 11, C.keep, 'end');
    l.line(CX - 190, 314, CX + 190, 314, C.line);
    l.text(CX - 190, 336, '残りHP', 13, C.dim, 'start');
    l.text(CX + 190, 336, gs.inRun ? `${b.hp} / ${b.maxHp}` : b.hp, 16, C.text, 'end', true);
    l.text(CX - 190, 362, '最大ダメージ（1ターン）', 13, C.dim, 'start');
    l.text(CX + 190, 362, b.stats.maxTurn, 16, C.text, 'end', true);
    l.text(CX - 190, 388, '戦利品', 13, C.dim, 'start');
    l.text(CX + 190, 388, gs.gained ? `${gs.gained.name} ×1` : 'なし', 15, gs.gained ? C.keep : C.faint, 'end', true);
  } else {
    l.text(CX - 190, 262, `${gs.enemy.name} の残りHP`, 13, C.dim, 'start');
    l.text(CX + 190, 262, `${b.enemy!.hp} / ${gs.enemy.hp}`, 22, C.text, 'end', true);
    l.line(CX - 190, 318, CX + 190, 318, C.line);
    l.text(CX - 190, 344, '経過時間', 13, C.dim, 'start');
    l.text(CX + 190, 344, `${b.time.toFixed(1)} 秒`, 16, C.text, 'end', true);
    l.text(CX - 190, 376, '最大ダメージ（1ターン）', 13, C.dim, 'start');
    l.text(CX + 190, 376, b.stats.maxTurn, 16, C.text, 'end', true);
  }
  const ready = gs.resultWait <= 0;
  if (gs.inRun && gs.run) {
    // ダンジョン: 選ぶものはない。勝てば先へ、負ければ入口（中ボス討伐後は中間地点）へ
    const label = won ? '進む' : gs.run.state.doorOpen ? '扉に戻る' : gs.run.state.midDone ? '中間地点に戻る' : '入口に戻る';
    l.rect(CX - 98, 418, 196, 44, { fill: ready ? C.sel : undefined, stroke: ready ? C.white : C.line, rx: 8 });
    l.text(CX, 440, label, 16, C.text, 'middle', ready, ready ? 1 : 0.4);
    guide(gs, l, '○ 決定', 'Enter 決定');
    return;
  }
  ['もう一度', '一覧に戻る'].forEach((label, i) => {
    const on = ready && i === gs.cur.result, x = i === 0 ? CX - 206 : CX + 10;
    l.rect(x, 418, 196, 44, { fill: on ? C.sel : undefined, stroke: on ? C.white : C.line, rx: 8 });
    l.text(x + 98, 440, label, 16, C.text, 'middle', on, ready ? 1 : 0.4);
  });
  guide(gs, l, '←→ 選ぶ　　○ 決定', '←→ 選ぶ　　Enter 決定');
}
