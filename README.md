# Chain Card

カードを C → B → A → S の順に出して敵を倒す、ハイスピードなカードバトルの試作です。

遊ぶ: https://uktele07.github.io/chain-card/

## 操作

| 操作 | ゲームパッド | キーボード |
|---|---|---|
| カードを出す | △ ○ ✕ □ | W D S A（上・右・下・左） |
| キープ / 解除 | 十字キー | 矢印キー |
| 入れ替え | R1・L1 | スペース |
| アイテム | L2・R2 | Q・E |
| やり直し | OPTIONS | R |
| 消音 | – | M |

## 開発

```bash
npm install
```

```bash
npm run dev
```

- `npm test`: ルールのテスト
- `npm run sim`: 自動プレイヤーによる勝率のシミュレーション
- `npm run build`: 公開用のビルド（`dist/`）。main に push すると GitHub Pages へ自動で公開されます
- `npm run page`: 1ファイルにまとめた版（`dist-single/`）

## 構成

- `data/cards.json`: カード、アイテム、敵、ルールの数値
- `src/game/battle.ts`: 戦闘ルール本体（描画に依存しない）
- `src/game/input.ts`: キーボードとゲームパッドの入力
- `src/game/audio.ts`: 効果音とBGM（その場で合成）
- `src/scenes/BattleScene.ts`: 画面
- `sim/`: シミュレーション（`sim/old/` は過去のルール用）
