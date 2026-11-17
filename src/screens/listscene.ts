// 行き先の画面の Canvas 側（地の色と、右の枠の中の絵）。文字・枠・一覧は HTML（src/views/list.ts）
import { W, H, ZOOM } from '../game/display';
import { monsterKey } from '../game/art';
import { ensureListArt } from '../game/battlebg';
import { DUNGEONS, ENEMIES } from '../game/content';
import type { Layer } from '../game/ui';
import type { GameScene } from '../scenes/GameScene';

/** 右の枠（HTML 側と同じ値） */
export const LIST_FRAME = { x: 470, y: 60, w: 450, h: 426 };

/** covered: まだ Canvas で描くメニューなどが上にある。絵は出さず、地の色だけにする */
export function drawListScene(gs: GameScene, l: Layer, covered: boolean) {
  l.rect(0, 0, W, H, { fill: '#0b0a09' });
  if (covered) return;
  const f = LIST_FRAME;
  if (gs.listTab === 1) {
    const d = DUNGEONS[gs.cur.dlist];
    if (!d.locked) l.image(ensureListArt(gs, d.id, ZOOM), f.x + f.w / 2, f.y + f.h / 2, f.w, 1, undefined, f.h);
  } else {
    const e = ENEMIES[gs.cur.list];
    l.image(monsterKey(gs.unlocked(e) ? e.id : 'unknown'), 806, 168, 180);
  }
}
