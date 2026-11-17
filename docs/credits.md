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

## ライブラリ

| ライブラリ | 版 | ライセンス | 用途 |
|---|---|---|---|
| Phaser | 3.90 | MIT | 描画（Canvas / WebGL） |
| lit-html | 3.3.3 | BSD-3-Clause | 画面まわりの HTML を、変わった所だけ書き換える（`src/views/root.ts`） |

- BSD-3-Clause と MIT は、商用利用可。配るときに著作権表示とライセンス文を含める（Steam などで出すときは、クレジット画面か同梱の文書に載せる）。
