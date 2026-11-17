// 画面どうしで共有する色・配置・小さな部品。
import { LEVEL_LABELS } from '../game/battle';
import { W, H } from '../game/display';
import type { Rank } from '../game/save';
import type { Layer } from '../game/ui';
import type { GameScene } from '../scenes/GameScene';
import type { Btn } from '../game/input';

export const C = {
  bg: '#0d1017', panel: '#171c26', deep: '#10141c', line: '#2c3442', text: '#e6e9ef', dim: '#8a93a3', faint: '#59606e',
  attack: '#d9534a', spell: '#4a8fd9', item: '#4fae6a', itemBg: '#1c3527', keep: '#f2c230', miss: '#ff5a5a', warn: '#ff8a8a',
  gauge: '#e0b040', sel: '#243047', ng: '#3a4250', white: '#ffffff', ink: '#10141c',
};
export const CHAIN_COL = ['#3a4250', '#5fb0e8', '#6fd08a', '#f2a23a', '#ff5a4a'];
export const RANK_COL: Record<string, string> = { S: '#ff5a4a', A: '#f2a23a', B: '#6fd08a', C: '#5fb0e8' };
export const ENEMY_COL: Record<string, string> = { slime: '#5fb0e8', golem: '#6fd08a', dragon: '#ff5a4a', maou: '#b9a3ea', kami: '#ffd24a' };

export const CX = 480, CY = 326, CW = 100, CH = 104, RING = 46;
export const POS = [{ x: CX, y: CY - 104 }, { x: CX + 134, y: CY }, { x: CX, y: CY + 104 }, { x: CX - 134, y: CY }];
export const GLY = ['△', '○', '✕', '□'];
export const CARD_BTN: Btn[] = ['tri', 'circle', 'cross', 'square'];
export const KEEP_BTN: Btn[] = ['up', 'right', 'down', 'left'];
export const MON = { x: 808, y: 330, size: 258 };
export const RESULT_WAIT = 0.8;

export type Base = 'list' | 'ready' | 'fight' | 'result' | 'board';
export type Overlay = 'menu' | 'equip' | 'deck' | 'shop' | 'confirm' | 'help' | 'reset' | 'pause' | 'resume' | 'dmenu' | 'legend';
/** 売買の確認。buy=購入 / sell=個数を選んで売る / sellAll=戦利品をすべて売る */
export type Deal = { kind: 'buy'; index: number } | { kind: 'sell'; id: string; qty: number } | { kind: 'sellAll' };
export const MENU: { label: string; off?: boolean; act?: Overlay | 'close' }[] = [
  { label: '装備', act: 'equip' }, { label: 'カード編集', act: 'deck' }, { label: 'ショップ', act: 'shop' }, { label: '設定', off: true },
  { label: '操作説明', act: 'help' }, { label: 'セーブリセット', act: 'reset' }, { label: '閉じる', act: 'close' },
];
export const PAUSE = ['戦闘再開', 'やり直す', '戦闘終了'];
/** ダンジョンの戦闘中のポーズ（逃げる手段はないので、やり直しはない） */
export const PAUSE_DUNGEON = ['戦闘再開', 'ダンジョンから出る'];
/** 盤面でのメニュー */
export const DMENU = ['マスの説明', '操作説明', '最初からやり直す', 'ダンジョンから出る', '閉じる'];
/** マスの種類ごとの色と絵 */
export const SQUARE: Record<string, { color: string; icon: string; name: string }> = {
  start: { color: '#8a93a3', icon: 'gate', name: '入口' }, none: { color: '#6b5f58', icon: '', name: '何も起こらない' },
  monster: { color: '#d9534a', icon: 'mon', name: 'モンスター' }, heal: { color: '#4fae6a', icon: 'heal', name: '回復' },
  maxhp: { color: '#e07ab0', icon: 'heart', name: '最大HPアップ' }, item: { color: '#3fb7c9', icon: 'bag', name: 'アイテム' },
  event: { color: '#f2a23a', icon: 'flame', name: 'イベント' }, random: { color: '#9b7be0', icon: 'q', name: 'ランダム' },
  mid: { color: '#c8453c', icon: 'mid', name: '中ボス' }, boss: { color: '#ff5a4a', icon: 'boss', name: 'ボス' },
};
export const EQUIP_ROWS = ['武器', '防具', 'アクセサリ', 'アイテム 1', 'アイテム 2', 'アイテム 3'];

// ---------------- 共通の部品 ----------------
export function guide(gs: GameScene, l: Layer, padText: string, keyText: string) {
  l.rect(0, 508, W, 32, { fill: '#0a0c12' });
  l.text(920, 524, gs.pad ? padText : keyText, 13, C.dim, 'end');
  const ps = gs.input2.padStatus;
  const msg = ps === 'blocked' ? 'このページではゲームパッドを使えない。' : ps === 'nonstandard' ? 'ゲームパッドのボタン配置が標準と違う可能性あり。' : !gs.snd.ready ? '音が出ないときは、画面を1回クリック。' : gs.snd.muted ? '消音中（M キーで戻す）' : '';
  if (msg) l.text(40, 524, msg, 12, '#ffb04a', 'start');
}
export function dim(l: Layer, alpha = 0.72) { l.rect(0, 0, W, H, { fill: '#05070b', alpha }); }
export function rankBadge(l: Layer, x: number, y: number, r: Rank, size: number) {
  l.circle(x, y, size / 2, { stroke: RANK_COL[r], sw: size / 10 });
  l.text(x, y, r, Math.round(size * 0.6), RANK_COL[r], 'middle', true);
}
export function cursor(l: Layer, x: number, y: number) { l.text(x, y, '▶', 12, C.white); }
/** 武器の威力を、レベルごとの札で並べる（C 1  B 2  A 3  S 10 を文字で詰めて書くと読みにくいため） */
export function powerChips(l: Layer, x: number, y: number, power: number[], alpha = 1) {
  power.forEach((v, i) => {
    const cx = x + i * 58;
    l.rect(cx, y - 10, 20, 20, { fill: C.attack, rx: 5, alpha });
    l.text(cx + 10, y, LEVEL_LABELS[i + 1], 12, C.text, 'middle', true, alpha);
    l.text(cx + 27, y, v, 15, C.text, 'start', true, alpha);
  });
}
/**
 * まとめて1つの枠に入った一覧を描く。行は細い線で区切り、選択中の行だけ帯で示す。
 * 各行の中心のy座標を返すので、呼び出し側はそこに中身を描く（文字は x+40 から）。
 */
export function rows(l: Layer, x: number, y: number, w: number, rowH: number, n: number, sel: number, o: { heads?: Record<number, string>; active?: boolean; dim?: boolean; extra?: number } = {}): number[] {
  const headH = 28, heads = o.heads ?? {}, active = o.active ?? true;
  l.rect(x, y, w, n * rowH + Object.keys(heads).length * headH + 12 + (o.extra ?? 0), { fill: C.panel, stroke: C.line, rx: 12, alpha: o.dim ? 0.55 : 1 });
  const ys: number[] = [];
  let yy = y + 6;
  for (let i = 0; i < n; i++) {
    if (heads[i] !== undefined) { l.text(x + 20, yy + headH / 2 + 2, heads[i], 11, C.dim, 'start', true); yy += headH; }
    else if (i > 0 && i !== sel && i - 1 !== sel) l.line(x + 20, yy, x + w - 20, yy, C.line, 1);
    if (i === sel) {
      l.rect(x + 6, yy + 2, w - 12, rowH - 4, { fill: C.sel, stroke: active ? C.white : C.line, rx: 8 });
      if (active) cursor(l, x + 22, yy + rowH / 2);
    }
    ys.push(yy + rowH / 2);
    yy += rowH;
  }
  return ys;
}
// --- メニュー類 ---
export function panel(l: Layer, title: string, rows: { label: string; off?: boolean; note?: string }[], sel: number, y0: number, w = 340) {
  const pitch = rows.length > 6 ? 46 : 50, h = 74 + rows.length * pitch, x = CX - w / 2;
  l.rect(x, y0, w, h, { fill: C.panel, stroke: C.line, rx: 12 });
  l.text(CX, y0 + 34, title, 18, C.text, 'middle', true);
  rows.forEach((r, i) => {
    const y = y0 + 62 + i * pitch, on = i === sel;
    if (on) { l.rect(x + 20, y, w - 40, 40, { fill: C.sel, stroke: C.white, rx: 8 }); cursor(l, x + 38, y + 20); }
    l.text(x + 58, y + 20, r.label, 16, r.off ? C.faint : C.text, 'start', on);
    if (r.note) l.text(x + w - 34, y + 20, r.note, 11, C.faint, 'end');
  });
}
