# 画面まわりを HTML と CSS に移す手順（設計メモ）

**状態: 併用に移すことは決定（2026-11-17）。段階0（土台）、段階1（戦闘）、段階2（結果・ポーズ・再開のカウント）、段階3（行き先）は済み。段階4から先は合図待ち。**
実装を始めたら `CLAUDE.md` の「構成」と「画面の作り方の約束」を直すこと。

## 1. 何をするか

いまは、すべての画面を Phaser の Canvas に描いている（`src/game/ui.ts` の `Layer`。四角・円・文字を毎フレーム描き直す）。
これを、次の併用に変える。

| 担当 | 描くもの |
|---|---|
| Phaser（Canvas） | 戦闘の背景、敵の絵、攻撃・被弾の演出、画面の揺れ、ダメージの数字、ダンジョンの盤面（床・マス・駒） |
| HTML と CSS | 敵の名前とHP、手札、チェイン、アイテム、自分のHP、すべてのメニュー、結果、盤面の上の情報の枠、下の操作案内 |

**理由**: 持ち主は見た目を最優先にした（`CLAUDE.md` の「見た目の方針」、仕様は `docs/look.md`）。細い線、濃淡、光、傾き、文字の太さの使い分け、なめらかな動きは、CSS なら数行で質も出る。`Layer` で同じことをするには部品を自作する必要があり、手間がかかって質も落ちる。見本（`docs/samples/`）は CSS で組んだ。

**変えないもの**: ルール（`battle.ts`、`dungeon.ts`）、数値データ、セーブ、音、入力、状態を持つ場所（`GameScene`）、テストの仕組み。

## 2. 仕組み

### 重ね方
- `index.html` の `#game` の上に、同じ大きさの `#ui` を重ねる。
- `#ui` は 960×540 で組み、CSS の `transform: scale()` で画面に合わせる。倍率と位置は Canvas と同じにする（Phaser は `Scale.FIT` と中央寄せ。`scale.on('resize')` で `canvas.getBoundingClientRect()` を読み、`#ui` に写すのが確実）。
- `#ui` は `pointer-events: none`。入力はこれまでどおり `Input` → `GameScene.handle()` だけが受ける。ボタンなどフォーカスを取る部品は置かない（置くと、キーが二重に効く）。

### 描き方
- 状態は `GameScene` に置いたまま。画面側は読むだけ。この約束は今と同じ。
- **lit-html を使い、毎フレーム `render()` を呼ぶ**形を勧める。
  - いまの `drawXxx(gs, layer)` と同じ考え方（状態を読んで全部描く）で書ける。書き換えが素直。
  - lit-html は変わった所だけを DOM に反映するので、CSS の動き（transition / animation）が途切れない。`innerHTML` で毎回作り直すと、動きがすべて最初からになるので使わない。
  - 小さい（数KB）。ライセンスは BSD-3-Clause。
  - 代案: ライブラリなしで、画面ごとに `mount()` / `update()` を書く。依存は増えないが、書く量が増え、更新漏れの不具合が出やすい。
- ゲージのように毎フレーム変わる値は、CSS 変数で渡す（`style="--v:0.64"`、CSS 側は `width: calc(var(--v) * 100%)`）。
- 画面ごとに1ファイル。`src/views/battle.ts` のように置き、`src/screens/` の同名ファイルと入れ替えていく。CSS は `src/views/*.css`。色・文字・影は `tokens.css` に変数でまとめる。
- 差し色は `#ui` の `--ac` に入れる（ダンジョンごとに変える。火は橙赤、水は青）。

### 移行中の切り替え
- `GameScene.draw()` に「移し終えた画面の一覧」を持ち、そこに入っている画面は `Layer` で描かず、HTML 側だけを描く。
- 1画面ずつ移せる。途中の状態でも公開できる（新旧の見た目が混ざる期間はできる。持ち主に伝えておくこと）。

## 3. 気をつけること

- **Canvas の上で `backdrop-filter`（背後をぼかす）や `mix-blend-mode` を使わない。** 動いている Canvas を毎フレームぼかすことになり、重い。見本ではこの2つを使ったが、ゲームでは次のようにする。
  - 背景のぼかしと光のにじみは、Phaser の FX（bloom / bokeh）か、あらかじめぼかした画像で作る。
  - 枠の背景は、半透明の黒で足りる。
- **フォント**: Dela Gothic One と Noto Sans JP（どちらも SIL Open Font License）を `@fontsource/*` で入れる。
  - 日本語フォントは大きい。`@fontsource` は文字の範囲ごとに分割されていて、使う分だけ読まれる。
  - 読み込み前に描くと、文字の幅が変わって一瞬崩れる。起動時に `document.fonts.ready` を待つ。
  - 1ファイル版（`npm run page`）にはフォントを埋め込めない（大きすぎる）。1ファイル版は代わりの書体で出る、と割り切る。
  - 入れたら、出典とライセンスを `docs/` に記録する（`CLAUDE.md` の約束）。
- **文字の位置**: Canvas の文字と DOM の文字は、同じ大きさでも見え方が違う。座標をそのまま写さず、見本に合わせて組み直す。
- **ダメージの数字と揺れ**: いまは Phaser 側（`popup()`、`cameras.main.shake`）。最初はそのまま残す。HTML 側も揺らしたくなったら、`#ui` にクラスを付けて CSS で揺らす。
- **盤面**: 床・マス・駒・行き先の印は Phaser に残す（大きな絵を動かすのは Canvas が得意）。情報の枠、サイコロ、止まったマスの表示、全体図だけを HTML に移す。全体図は Canvas のままでもよい。
- **演出は入力を止めない**（決定済み）。CSS の動きの最中も、`handle()` は受け付ける。
- **通しテスト**: `window.__scene` の状態を見ているので、ほとんど変えずに通るはず。画面の確認は、これまでどおり1ファイル版のスクリーンショットを目で見る。DOM を見るテストは、足すとしても少数にする。
- **タッチ操作**: 今回は作らない。ただ、HTML にしておくと、あとでスマホ向けのボタンを足しやすくなる。

## 4. 進める順番

1つずつ、`npm run check` を通して公開できる単位にする。各段階の前に、その画面の見本を出して了承を取る（`CLAUDE.md` の進め方）。

| 段階 | 内容 | 元のファイル（行数） | 備考 |
|---|---|---|---|
| 0 | **済み**。土台: `#ui` の重ね合わせと拡大、`tokens.css`、フォント、lit-html、`draw()` の切り替え | `main.ts`、`GameScene.draw()`、`src/views/` | 見た目は変わらない。`?uidebug` を付けて開くと、HTML（水色の枠）と Canvas（赤い四角）の目印が出る。4つの画面の大きさで、ずれが 0 ピクセルなのを確かめた |
| 1 | **済み**。戦闘の画面まわり。同時に、戦闘の背景（ダンジョンA、討伐C）を Phaser 側に入れる | `screens/battle.ts`（144） | 一番見られる画面。見本は `docs/samples/style-D3-final.png`（持ち主が「いったんOK」とした）。仕様は `docs/look.md` |
| 2 | **済み**（B 帯）。結果、ポーズ、再開のカウント | `result.ts`（49）、`menus.ts` の一部 | 戦闘と続けて出るので、すぐ後に |
| 3 | **済み**（段階2より先に行った）。行き先（討伐 / ダンジョン） | `list.ts`（96） | |
| 4 | メニュー、装備、カード編集、ショップ、確認、操作説明、マスの説明、セーブリセット | `menus.ts`（79）、`equip.ts`（48）、`deck.ts`（47）、`shop.ts`（80）、`help.ts`（32）、`board.ts` の一部 | 一覧の共通部品（今の `rows()`、`powerChips()`）を CSS のクラスとして先に作る |
| 5 | 盤面の上の情報（状態の枠、サイコロ、止まったマスの表示、分かれ道の案内、盤面のメニュー） | `board.ts`（205）の後半 | 床・マス・駒は Phaser のまま |
| 6 | 片付け: 使わなくなった `Layer` の機能と `common.ts` の部品を消す。`CLAUDE.md` の「画面の作り方の約束」を書き直す | `ui.ts`（88）、`common.ts`（104） | `Layer` は盤面用に残る |

書き直す量は、画面の描画が約900行。状態と入力（`GameScene.ts`、627行）は `draw()` 以外ほぼそのまま。

## 5. 始める前に持ち主に確かめたこと（すべて済み）

1. 併用に移すこと: 決定。
2. 戦闘の見た目: 段階1は、戦闘中 `docs/samples/style-D6B-fight.png`、開始前 `docs/samples/style-D4-start.png` をもとに作る。仕様は `docs/look.md`。
3. 移行の途中、新旧の見た目が混ざった状態で公開してよい。1画面ずつ公開する。
4. 戦闘画面に載せる情報: アイテムの説明は小さく残す。強化薬・時の砂の残り時間は残す。無敵（テスト用）の表示は消す。ゲームパッドの案内と START は開始前だけ。くわしくは `docs/look.md` の4章。

## 6. 段階0で作ったもの

- `src/views/root.ts`: `UIRoot`（HTML の層）。`VIEWS` に画面の描き方を足すと、その画面は Canvas に描かれなくなり、HTML で描かれる。画面の名前は `ViewName`。
- `src/views/tokens.css`: 色と書体の変数。`src/views/ui.css`: 層の土台。どちらも `?inline` で読み、`<style>` として入れる（1ファイル版でも効くように）。
- `src/views/fonts.ts`: 書体。`src/main.ts` が最初に読み、最大 2.5秒待ってから Phaser を始める。1ファイル版（`__SINGLE__`）では読まない。
- 重ね方: `#ui` は `#game`（Phaser の親）の子。Canvas の位置と幅を `ResizeObserver` と `resize` で読み、`translate` と `scale` で写す。
- 出典とライセンス: `docs/credits.md`。

## 7. 段階1で作ったもの

- `src/views/battle.ts`、`battle.css`: 開始前・戦闘中の画面まわり（HTML）。
- `src/screens/battlescene.ts`: 戦闘の Canvas 側（背景・敵・演出）。HTML へ移したときは `drawBattle` の代わりにこれを描く。
- `src/game/battlebg.ts`: 戦闘の背景。ダンジョンは神殿の広間、討伐は敵の色の抽象。Canvas に描いてテクスチャにする。
- `src/screens/battle.ts`（以前の Canvas の戦闘画面）は、段階6で消す。
- まだ Canvas で描く画面（結果、ポーズなど）が上に重なるときは、HTML の画面を隠す（`UIRoot.draw`）。

## 8. 段階3で作ったもの

- `src/views/list.ts`、`list.css`: 行き先の画面（HTML）。
- `src/screens/listscene.ts`: Canvas 側（地の色と、右の枠の中の絵）。
- `src/game/battlebg.ts` の `ensureListArt`: 右の枠の絵（神殿の広間の切り出し）。
- `src/screens/list.ts`（以前の Canvas の行き先）は、段階6で消す。

## 9. 段階2で作ったもの

- `src/views/overlays.ts`、`overlays.css`: 結果・ポーズ・再開のカウント（B 帯）。
- `src/screens/result.ts` と `menus.ts` の `drawPause`・`drawResume` は、段階6で消す。
