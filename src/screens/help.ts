// 画面: 操作説明
import { W, H } from '../game/display';
import type { Layer } from '../game/ui';
import { C, guide } from './common';
import type { GameScene } from '../scenes/GameScene';

export function drawHelp(gs: GameScene, l: Layer) {
  l.rect(0, 0, W, H, { fill: C.bg });
  l.text(40, 40, '操作説明', 24, C.text, 'start', true);
  const rows: [string, string, string][] = [
    ['カードを出す', '△ ○ ✕ □', 'W D S A（上・右・下・左）'], ['キープ / 解除', '十字キー', '矢印キー'], ['入れ替え', 'R1・L1', 'スペース'],
    ['アイテムを切り替える', 'L2', 'Q'], ['アイテムを使う', 'R2', 'E'], ['メニュー / ポーズ', 'OPTIONS', 'Esc'],
    ['決定 / 戻る（メニュー）', '○ / ✕', 'Enter / Backspace'], ['消音', '–', 'M'], ['無敵（テスト用）', 'タッチパッド', 'T'],
  ];
  l.rect(40, 72, 880, 30, { fill: C.panel, rx: 6 });
  l.text(60, 87, '操作', 12, C.dim, 'start', true); l.text(360, 87, 'ゲームパッド', 12, C.dim, 'start', true); l.text(620, 87, 'キーボード', 12, C.dim, 'start', true);
  rows.forEach((r, i) => {
    const y = 120 + i * 28;
    l.text(60, y, r[0], 14, C.text, 'start'); l.text(360, y, r[1], 14, C.text, 'start', true); l.text(620, y, r[2], 14, C.text, 'start', true);
  });
  const rules = [
    'カードは C → B → A → S の順。同じレベル・1つ下・C はいつでも出せる。S を出すとチェインは消える。',
    'スペルの効果は、次に出すアタックに乗る。重ね掛け可。',
    '入れ替えるとチェインが1段下がる。使い切れば下がらない。4枚目がアタックなら +1 ダメージ。',
    '出せるカードがなくなると、自動で入れ替わる。',
    'アイテムは3つまで。それぞれ1戦に1回。',
    'ダンジョンでは、HPとアイテムの使用を次の戦闘に持ち越す。マスの効果で回復・復活する。',
  ];
  l.text(40, 380, 'ルール', 12, C.dim, 'start', true);
  rules.forEach((r, i) => l.text(40, 400 + i * 19, r, 12, C.text, 'start'));
  guide(gs, l, '✕ 戻る', 'Backspace 戻る');
}
