// 戦闘の Canvas 側（背景・敵・演出）。画面まわり（名前、HP、手札など）は HTML（src/views/battle.ts）が描く
import Phaser from 'phaser';
import { W, H, ZOOM } from '../game/display';
import { monsterKey } from '../game/art';
import { ensureBattleBg, ENEMY_AT, ENEMY_ART, battleBgImageKey } from '../game/battlebg';
import { SQUARE_GLOW } from '../game/runes';
import type { Layer } from '../game/ui';
import { ENEMY_COL } from './common';
import type { GameScene } from '../scenes/GameScene';

/** チェインのひし形の中心（HTML 側と同じ値）。演出の位置合わせに使う */
export const CHAIN_AT = { x: 406, y: 368 };   // 2026-11-22 に手札と一緒に 74 左へ
/** アイテムの選択中の段と、自分の HP の数字のあたり。数字が跳ねて出る位置 */
export const ITEM_AT = { x: 130, y: 233 };
export const HP_AT = { x: 150, y: 470 };

export function drawBattleScene(gs: GameScene, l: Layer) {
  const b = gs.battle, e = b.enemy!, act = b.enemyAction!;
  const fight = gs.base === 'fight' && gs.overlays.length === 0;
  const hidden = gs.base !== 'ready' && !fight;
  const big = fight && !!act.big && e.stunLeft <= 0;

  // 背景: ダンジョンは神殿の広間、討伐は敵の色の抽象
  // ダンジョンに背景の画像があれば、それを使い、炎と火の粉を出す（src/game/battlefx.ts）
  const dungeon = gs.inRun && gs.run ? gs.run.def.id : null, img = dungeon ? battleBgImageKey(dungeon) : '';
  if (dungeon && gs.textures.exists(img)) { l.image(img, W / 2, H / 2, W, 1, undefined, H); gs.battleFx.set(dungeon); }
  else {
    const kind = gs.inRun ? 'temple' : `hunt-${ENEMY_COL[e.def.id] ?? '#d8b46a'}`;
    l.image(ensureBattleBg(gs, kind, ZOOM), W / 2, H / 2, W, 1, undefined, H);
  }

  // 敵。強い攻撃の溜め中は赤く光る
  const sx = gs.enemyShake > 0 ? Phaser.Math.Between(-5, 5) : 0, dead = b.result === 'won';
  const key = monsterKey(e.def.id), art = ENEMY_ART[e.def.id], alpha = dead ? 0.3 : hidden ? 0.6 : 1, tint = big ? 0xffb0a0 : undefined;
  if (art && gs.textures.exists(key)) {
    // 画像の敵: 縦横比を保って、足元をそろえて置く。足元に橙の照り返し（加算）
    const src = gs.textures.get(key).getSourceImage(), h = art.w * src.height / src.width, cy = art.bottom - h / 2;
    if (gs.inRun) l.image(SQUARE_GLOW, art.cx, art.bottom - 4 + (art.shadowDy ?? 0), art.w * (art.shadowDy ? 0.6 : 0.75), art.shadowDy ? 0.4 : 0.55, 0xff7a3a, art.w * 0.14, 0, true)?.setDepth(1.55);   // 飛んでいる敵は、離れた床に小さく薄く
    if (big) l.ellipse(art.cx, cy, h * 0.9 + Math.sin(gs.clock * 10) * 14, h * 0.9 + Math.sin(gs.clock * 10) * 14, '#ff2a2a', 0.22);
    l.image(key, art.cx + sx, cy, art.w, alpha, tint, h)?.setDepth(1.6);   // 背景の演出（深さ 1.3）より手前
  } else {
    if (big) l.ellipse(ENEMY_AT.x, ENEMY_AT.y, 280 + Math.sin(gs.clock * 10) * 14, 280 + Math.sin(gs.clock * 10) * 14, '#ff2a2a', 0.22);
    l.image(key, ENEMY_AT.x + sx, ENEMY_AT.y, ENEMY_AT.size, alpha, tint)?.setDepth(1.6);
  }

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
