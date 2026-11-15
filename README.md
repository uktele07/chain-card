# Chain Card

カードを C → B → A → S の順に出して敵を倒す、ハイスピードなカードバトルの試作です。

遊ぶ: https://uktele07.github.io/chain-card/

## 操作

| 操作 | ゲームパッド | キーボード |
|---|---|---|
| カードを出す | △ ○ ✕ □ | W D S A（上・右・下・左） |
| キープ / 解除 | 十字キー | 矢印キー |
| 入れ替え | R1・L1 | スペース |
| アイテムを切り替える / 使う | L2 / R2 | Q / E |
| メニュー / ポーズ | OPTIONS | Esc |
| 決定 / 戻る（メニュー） | ○ / ✕ | Enter / Backspace |
| 消音 | – | M |
| 無敵（テスト用） | タッチパッド | T |

## 開発

```bash
npm install
```

```bash
npm run dev
```

- `npm test`: ルールのテスト
- `npm run e2e`: 画面を通しで動かすテスト（先に `npm run build` が必要。初回は `npx playwright install chromium`）
- `npm run check`: 上の2つとビルドをまとめて実行
- `npm run sim`: 自動プレイヤーによる勝率のシミュレーション
- `npm run build`: 公開用のビルド（`dist/`）。main に push すると GitHub Pages へ自動で公開されます
- `npm run page`: 1ファイルにまとめた版（`dist-single/`）

## 構成

- `data/cards.json`: カード、アイテム、武器、防具、敵、ルールの数値
- `src/game/battle.ts`: 戦闘ルール本体（描画に依存しない）
- `src/game/input.ts`: キーボードとゲームパッドの入力
- `src/game/audio.ts`: 効果音とBGM（その場で合成）
- `src/game/ui.ts`: 描画の土台（毎フレーム描き直す層）
- `src/game/art.ts`: 敵とアイテムの仮の絵（SVGの図形）
- `src/game/save.ts`: セーブデータ（装備、デッキのスペル、お金、持ち物、敵ごとの記録）
- `src/game/loadout.ts`: デッキと装備補正の組み立て
- `src/game/content.ts`: データを型付きで取り出す場所
- `src/scenes/GameScene.ts`: 状態と入力（どの画面にいるか、ボタンで何が起きるか）
- `src/screens/`: 画面ごとの描画（`list` `battle` `result` `menus` `equip` `deck` `shop` `help`）と共通部品（`common`）
- `e2e/`: 画面を通しで動かすテスト
- `sim/`: シミュレーション（`run.ts` が実行口、`battlesim.ts` が自動プレイヤー、`sim/old/` は過去のルール用）
