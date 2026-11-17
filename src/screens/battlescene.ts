// 戦闘の Canvas 側（背景・敵・演出）。画面まわり（名前、HP、手札など）は HTML（src/views/battle.ts）が描く
import Phaser from 'phaser';
import { W, H, ZOOM } from '../game/display';
import { monsterKey } from '../game/art';
import { ensureBattleBg, ENEMY_AT } from '../game/battlebg';
import type { Layer } from '../game/ui';
import { ENEMY_COL } from './common';
import type { GameScene } from '../scenes/GameScene';

/** チェインのひし形の中心（HTML 側と同じ値）。演出の位置合わせに使う */
export const CHAIN_AT = { x: 480, y: 368 };
/** アイテムの選択中の段と、自分の HP の数字のあたり。数字が跳ねて出る位置 */
export const ITEM_AT = { x: 130, y: 233 };
export const HP_AT = { x: 150, y: 470 };

export function drawBattleScene(gs: GameScene, l: Layer) {
  const b = gs.battle, e = b.enemy!, act = b.enemyAction!;
  const fight = gs.base === 'fight' && gs.overlays.length === 0;
  const hidden = gs.base !== 'ready' && !fight;
  const big = fight && !!act.big && e.stunLeft <= 0;

  // 背景: ダンジョンは神殿の広間、討伐は敵の色の抽象
  const kind = gs.inRun ? 'temple' : `hunt-${ENEMY_COL[e.def.id] ?? '#d8b46a'}`;
  l.image(ensureBattleBg(gs, kind, ZOOM), W / 2, H / 2, W, 1, undefined, H);

  // 敵。強い攻撃の溜め中は赤く光る
  const sx = gs.enemyShake > 0 ? Phaser.Math.Between(-5, 5) : 0, dead = b.result === 'won';
  if (big) l.ellipse(ENEMY_AT.x, ENEMY_AT.y, 280 + Math.sin(gs.clock * 10) * 14, 280 + Math.sin(gs.clock * 10) * 14, '#ff2a2a', 0.22);
  l.image(monsterKey(e.def.id), ENEMY_AT.x + sx, ENEMY_AT.y, ENEMY_AT.size, dead ? 0.3 : hidden ? 0.6 : 1, big ? 0xffb0a0 : undefined);

  // 被弾の赤い光と、強い攻撃の予告（画面の縁とチェインの周りが赤く点滅）
  if (gs.hurt > 0 && fight) gs.fx.fillStyle(0xff2a2a, Math.min(0.35, gs.hurt * 0.7)).fillRect(0, 0, W, H);
  if (big) {
    const left = act.chargeSec - e.gauge, near = left <= 1.5;
    const pulse = 0.5 + 0.5 * Math.sin(gs.clock * (near ? 22 : 9));
    const th = (near ? 20 : 10) + pulse * (near ? 10 : 5), alpha = (near ? 0.5 : 0.28) + pulse * 0.3;
    gs.fx.fillStyle(0xff2a2a, alpha);
    gs.fx.fillRect(0, 0, W, th).fillRect(0, H - th, W, th).fillRect(0, th, th, H - th * 2).fillRect(W - th, th, th, H - th * 2);
    gs.fx.lineStyle(near ? 5 : 3, 0xff2a2a, alpha).strokeCircle(CHAIN_AT.x, CHAIN_AT.y, 54 + pulse * 5);
  }
}
