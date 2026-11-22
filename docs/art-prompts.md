# 絵の生成の指示文

敵・背景・カードの絵を画像生成AIで作るときの指示文。持ち主が ChatGPT（GPT-6.2 Sol）や Gemini で生成し、こちらで切り抜いてゲームに入れる。

## 決まっていること（2026-11-22、持ち主）

- 画風: **墨の線＋水彩（W1）**。かっこいい路線（かわいくしない）。見本は ChatGPT で作った炎の古竜（作業用の場所にだけあり、リポジトリには入れていない）。
- 向き: 敵は**顔も体も左向き**（画面の右に立ち、左のプレイヤーを向く）。
- 素材は使ってよい（持ち主が判断）。使う絵は `docs/credits.md` に、作ったサービスと日付を記録する。

## 共通の決まり（全部の敵で同じにする）

- 背景は単色の暗い灰。景色、文字、枠を入れない（切り抜くため）。
- 全身が画面に収まる。正方形（1:1）。
- 光は上の後ろから当てる。輪郭の縁を差し色（炎の神殿は橙赤）で強く光らせる。
- 色は黒と暗い茶に、差し色1色。
- 形ははっきり、描き込みは中くらい（小さく映しても読めるように）。

## 炎の古竜（大ボス）

```
A fearsome ancient fire dragon, the final boss of a fire temple. Full body, facing LEFT: the head, face, chest and body are turned toward the left side of the image, three-quarter view from the left, slightly low angle looking up at the dragon so it feels huge and dominant.

Composition: square image (1:1). Close and tall framing, the dragon fills most of the frame with a little margin on every side; the whole body, wings, tail and claws stay inside the frame. Wings raised upward and slightly back, not spread flat to the sides. Tail curls behind the body toward the right.

Design: massive heavy jaw, thick curved horns sweeping back, glowing orange eyes, menacing ancient face (not bird-like, no beak). Dark charcoal and deep brown armored scales, glowing orange-red cracks and embers between the scales, tattered wing membranes in dark red. Cool and intimidating, not cute.

Lighting: strong bright orange-red rim light outlining the whole silhouette from behind and above, the front of the body in deep shadow, the cracks and eyes glowing.

Style: watercolor painting with bold black ink linework, strong confident strokes, watercolor washes with controlled bleeding, subtle paper texture, dark muted palette of charcoal and deep brown with orange-red accents only. Clear readable silhouette.

Background: plain flat dark gray background, no scenery, no ground shadow, no text, no frame, no signature.
```

うまくいかないときに足す一文:
- 右を向いてしまう: `The dragon must face left. Mirror the pose if needed.`
- 小さく描かれる: `The dragon fills about 85 percent of the image height.`
- 背景に模様が出る: `The background is a single flat color without texture.`

## ほかの敵に使うとき

上の「Design」の段落だけを、その敵の姿に書き換える。ほかの段落は変えない。仲間の敵は、気に入った1枚を見本の画像として一緒に渡し、`Same art style, linework, palette and lighting as the reference image.` を足す。
