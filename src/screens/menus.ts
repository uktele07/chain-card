// 画面: メニュー、ポーズ、再開待ち、セーブリセット、売買の確認
import type { Layer } from '../game/ui';
import { SHOP } from '../game/content';
import { C, CX, CY, MENU, PAUSE, PAUSE_DUNGEON, guide, dim, panel } from './common';
import type { GameScene } from '../scenes/GameScene';

export function drawMenu(gs: GameScene, l: Layer) {
  dim(l);
  panel(l, 'メニュー', MENU.map(m => ({ label: m.label, off: m.off, note: m.off ? '準備中' : undefined })), gs.cur.menu, 44);
  guide(gs, l, '↑↓ 選ぶ　　○ 決定　　✕ / OPTIONS 閉じる', '↑↓ 選ぶ　　Enter 決定　　Backspace / Esc 閉じる');
}

export function drawPause(gs: GameScene, l: Layer) {
  dim(l, 0.6);
  if (gs.inRun) panel(l, 'PAUSE', PAUSE_DUNGEON.map((label, i) => ({ label, note: i === 1 ? '敗北になる' : undefined })), gs.cur.pause, 170);
  else panel(l, 'PAUSE', PAUSE.map((label, i) => ({ label, note: i === 2 ? '一覧に戻る' : undefined })), gs.cur.pause, 150);
  guide(gs, l, '↑↓ 選ぶ　　○ 決定　　✕ / OPTIONS 再開', '↑↓ 選ぶ　　Enter 決定　　Backspace / Esc 再開');
}

export function drawResume(gs: GameScene, l: Layer) {
  dim(l, 0.35);
  l.circle(CX, CY, 70, { fill: C.bg, alpha: 0.9 });
  l.circle(CX, CY, 70, { stroke: C.keep, sw: 4 });
  l.text(CX, CY - 18, 'READY', 18, C.keep, 'middle', true);
  l.text(CX, CY + 18, Math.max(0, gs.resumeLeft).toFixed(1), 26, C.keep, 'middle', true);
}

export function drawReset(gs: GameScene, l: Layer) {
  dim(l, 0.55);
  l.rect(CX - 250, 170, 500, 216, { fill: C.panel, stroke: C.miss, rx: 12 });
  l.text(CX, 206, 'セーブデータを消しますか？', 19, C.text, 'middle', true);
  l.text(CX, 244, '装備、所持金、持ち物、記録がすべて消えます。', 13, C.dim);
  l.text(CX, 268, '元に戻せません。', 13, C.warn);
  ['いいえ', 'はい、消す'].forEach((label, i) => {
    const on = i === gs.cur.reset, x = i === 0 ? CX - 216 : CX + 10;
    l.rect(x, 314, 206, 44, { fill: on ? C.sel : undefined, stroke: on ? C.white : i ? C.miss : C.line, rx: 8 });
    l.text(x + 103, 336, label, 16, i ? C.warn : C.text, 'middle', on);
  });
  guide(gs, l, '←→ 選ぶ　　○ 決定　　✕ やめる', '←→ 選ぶ　　Enter 決定　　Backspace やめる');
}

/** 売買の確認。売るときは、ここで個数も選ぶ */
export function drawConfirm(gs: GameScene, l: Layer) {
  const d = gs.deal, s = gs.save;
  if (!d) return;
  dim(l, 0.6);
  l.rect(CX - 250, 150, 500, 250, { fill: C.panel, stroke: C.line, rx: 12 });
  let act = '買う', after = s.gold;
  if (d.kind === 'buy') {
    const g = SHOP[d.index], price = g.def.price ?? 0;
    after = s.gold - price;
    l.text(CX, 188, `${g.def.name} を買いますか？`, 19, C.text, 'middle', true);
    l.text(CX, 244, `${price} G`, 26, C.keep, 'middle', true);
  } else if (d.kind === 'sell') {
    const x = gs.sellList().find(v => v.id === d.id), max = s.loot[d.id] ?? 0, price = x?.price ?? 0;
    act = '売る'; after = s.gold + price * d.qty;
    l.text(CX, 188, `${x?.name ?? ''} を売りますか？`, 19, C.text, 'middle', true);
    l.text(CX - 150, 244, '個数', 13, C.dim, 'start');
    l.text(CX - 46, 244, '▼', 14, max > 1 ? C.text : C.faint);
    l.text(CX, 244, d.qty, 26, C.text, 'middle', true);
    l.text(CX + 46, 244, '▲', 14, max > 1 ? C.text : C.faint);
    l.text(CX + 150, 244, `/ ${max}`, 13, C.dim, 'end');
    l.text(CX, 280, `+${price * d.qty} G`, 18, C.item, 'middle', true);
  } else {
    const list = gs.sellList(), total = list.reduce((n, x) => n + x.price * s.loot[x.id], 0);
    act = '売る'; after = s.gold + total;
    l.text(CX, 188, '戦利品をすべて売りますか？', 19, C.text, 'middle', true);
    l.text(CX, 226, list.map(x => `${x.name} ×${s.loot[x.id]}`).join('　'), 12, C.dim);
    l.text(CX, 262, `+${total} G`, 26, C.item, 'middle', true);
  }
  l.text(CX, 312, `所持金  ${s.gold} G  →  ${after} G`, 13, C.dim);
  [act, 'やめる'].forEach((label, i) => {
    const on = i === gs.dealCursor, x = i === 0 ? CX - 216 : CX + 10;
    l.rect(x, 338, 206, 44, { fill: on ? C.sel : undefined, stroke: on ? C.white : C.line, rx: 8 });
    l.text(x + 103, 360, label, 16, C.text, 'middle', on);
  });
  const qty = d.kind === 'sell';
  guide(gs, l, `${qty ? '↑↓ 個数　　' : ''}←→ 選ぶ　　○ 決定　　✕ やめる`, `${qty ? '↑↓ 個数　　' : ''}←→ 選ぶ　　Enter 決定　　Backspace やめる`);
}
