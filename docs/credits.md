# 外から入れた素材とライブラリ

`CLAUDE.md` の約束: 商用利用可・クレジット表記不要のものだけを入れ、ここに出典とライセンスを書く。

## 書体（画面まわりの HTML で使う。`src/views/fonts.ts`）

| 書体 | npm パッケージ | 版 | ライセンス | 出典 |
|---|---|---|---|---|
| Noto Sans JP（400、500） | `@fontsource/noto-sans-jp` | 5.3.1 | SIL Open Font License 1.1 | Google Fonts（https://fonts.google.com/noto/specimen/Noto+Sans+JP） |
| Dela Gothic One（400） | `@fontsource/dela-gothic-one` | 5.3.0 | SIL Open Font License 1.1 | Google Fonts（https://fonts.google.com/specimen/Dela+Gothic+One） |
| Inter（可変。光学サイズの軸つき） | `@fontsource-variable/inter` | 5.3.0 | SIL Open Font License 1.1 | https://rsms.me/inter/ |

- SIL Open Font License は、商用利用可。ゲームに同梱して配ってよい。書体だけを単体で売ることは禁止。クレジットの表記は求められていない（ライセンス文は各パッケージの `LICENSE` にある）。
- Inter は可変フォントの「Inter Variable」として読み、`font-optical-sizing: auto` で大きな文字を Display の字形にしている（見本の「Inter Display」に当たる）。
- 1ファイル版（`npm run page`）には入れない。代わりの書体で表示される。

## 音楽（`public/audio/`）

| ファイル | 元の名前 | 使う所 | 出典・ライセンス |
|---|---|---|---|
| `bgm-dungeon.mp3` | BGM_神秘.mp3 | ダンジョン（すごろくの盤面） | 持ち主が用意（2026-11-19）。出典とライセンスは持ち主が管理 |
| `bgm-battle.mp3` | BGM_BOSS.mp3 | 戦闘 | 同上 |

- 公開先（GitHub Pages）にそのまま載る。配布の条件（商用利用・クレジット表記）は、持ち主に確かめてもらう。

## 絵（画像生成AI）

持ち主が画像生成AI（ChatGPT、Gemini など）で作った絵を使う。使ってよいと持ち主が判断した（2026-11-22）。指示文は `docs/art-prompts.md`。ゲームに入れた絵は、ここにファイル名・作ったサービス・日付を書く。

| ファイル | 中身 | 作ったサービス | 日付 |
|---|---|---|---|
| `public/enemies/red_slime.webp` | 赤スライム | Gemini（持ち主が生成） | 2026-11-22 |
| `public/enemies/treasure_hunter.webp` | トレジャーハンター | Gemini（持ち主が生成） | 2026-11-22 |
| `public/enemies/flame_lizard.webp` | フレイムリザード | Gemini（持ち主が生成） | 2026-11-22 |
| `public/enemies/fire_wyvern.webp` | 炎の飛竜 | Gemini（持ち主が生成） | 2026-11-22 |
| `public/enemies/elder_dragon.webp` | 炎の古竜 | Gemini（持ち主が生成） | 2026-11-22 |
| `public/battle/fire.jpg` | 炎の神殿の戦闘背景（横から見た舞台） | Gemini（持ち主が生成） | 2026-11-22 |

- 背景（紙の灰色）は `scripts/art/cut.py` で切り抜き、余白を切り落として webp にした（`python3 scripts/art/cut.py <元の画像> <出力.png> 13`）。元の画像はリポジトリに入れていない。戦闘背景は `scripts/art/bgproc.py` で暗くぼかした（`python3 scripts/art/bgproc.py <元> <出力> 2 0.8`）。

- Steam で出すときは、AIで作った素材を使っていることをストアページで申告する（出す前に、その時点の規定を確かめる）。

## ライブラリ

| ライブラリ | 版 | ライセンス | 用途 |
|---|---|---|---|
| Phaser | 3.90 | MIT | 描画（Canvas / WebGL） |
| lit-html | 3.3.3 | BSD-3-Clause | 画面まわりの HTML を、変わった所だけ書き換える（`src/views/root.ts`） |

- BSD-3-Clause と MIT は、商用利用可。配るときに著作権表示とライセンス文を含める（Steam などで出すときは、クレジット画面か同梱の文書に載せる）。
