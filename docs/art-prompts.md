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

## 大きさと位置（2026-11-22、持ち主）

- 大ボス（炎の古竜）だけ大きく、幅 640（960×540 の座標）。右の翼と尾は画面の外にはみ出してよい。頭が HP の帯に重ならないよう、足元を y 500 に置く（見本 `docs/samples/style-E1-dragon-B2.png`）。
- 雑魚と中ボスは、幅 460 くらい（見本 `docs/samples/style-E1-dragon-A.png`）。画面に収める。
- 床の影（橙の楕円）は、足元に合わせて動かす（入れるときに直す）。

## 指示文の型

うまくいったのは Gemini に「共通部分＋描き分け W1」を渡したとき（2026-11-22、炎の古竜）。ChatGPT で「重い顎」「縁全体を強く光らせる」「見上げて大きく」を足すと、ずんぐりして体中が光る、ださい絵になった。**指示は足しすぎない。**

**共通部分（Design の段落だけを敵ごとに書き換える）**
```
[Design]. Full body, facing LEFT (head, face and body turned to the left side of the image), three-quarter view from the left. Cool and intimidating (not cute). Glowing orange-red embers and cracks, rim light in orange-red from behind and above. Clear readable silhouette. Plain background, no scenery, no text.

Watercolor painting with bold black ink linework, strong confident strokes, watercolor washes with controlled bleeding, dark muted palette of charcoal and deep brown with orange-red accents, dark gray paper background.
```

仲間の敵は、炎の古竜の絵を見本として一緒に渡し、最後に次の一文を足す:
```
Same art style, linework, palette, paper and lighting as the reference image. A different creature, not a dragon unless stated.
```

## 炎の神殿の Design の段落

| 敵 | Design |
|---|---|
| 炎の古竜（大ボス。済み） | `A fearsome ancient fire dragon, the final boss of a fire temple, slender and sharp, tattered wings, long spiked tail` |
| 炎の飛竜（中ボス） | `A fierce young fire wyvern, smaller and leaner than an ancient dragon, two legs and two large wings (wings are its arms), long neck, sharp beak-less snout, spiked tail, in mid-air hovering pose with wings raised` |
| フレイムリザード（雑魚・強め） | `A large fire lizard the size of a crocodile, low and wide stance on four legs, heavy armored scales, glowing throat sac about to breathe fire, spiked back ridge, long thick tail` |
| トレジャーハンター（雑魚・中） | `A ruthless human treasure hunter raiding a fire temple, lean and hooded, wearing a scorched leather coat and a scarf over the mouth, a curved dagger in one hand and a lit powder bomb in the other, satchel full of stolen gold, crouched ready to strike, the face half hidden in shadow` |
| 赤スライム（雑魚・弱め） | `A menacing red slime made of semi-molten magma, a low blob with a glowing molten core visible inside, bubbling surface with dark crusted patches, drips of lava, no cute face (only two small glowing eye-like embers)` |

注意:
- 炎の飛竜は、古竜と同じ系統に見えるよう、古竜の絵を見本として必ず渡す。
- 赤スライムは、かわいくならないよう「顔を描かない」が要。
- トレジャーハンターだけ人間。暗く、顔を半分隠す。

## 戦闘の背景（炎の神殿）

いまの背景（コードで描いた神殿の広間）を、画像に替えるための指示文。ゲームの中で弱くぼかし、暗くして使う（敵と手札を読みやすくするため）。

置き場所の約束（いまの画面の配置に合わせる）:
- 横長 16:9。敵は画面の右寄り（横 80% あたり、床の上）に立つ。そこに床が見え、奥から光が当たっていること。
- 左と中央には、文字（アイテム、HP、次の攻撃）と手札が重なる。細かい模様や明るいものを置かない。
- 床の奥行きの線（地平線）は、高さの 55〜60% あたり。
- 生き物・人・文字を描かない。

```
Interior of an ancient fire temple, a vast stone hall seen from inside, wide 16:9 landscape, eye-level view. Massive dark stone pillars and old brick walls on both sides, tall arched doorways in the back wall, a stone floor of large cracked slabs receding into the distance (horizon at about 58 percent of the image height). Far in the back, rivers of lava glow behind the arches, casting warm orange-red light across the floor. The right side of the floor is softly lit, an open empty area where a monster will stand. The left and center are calm and dark with few details. Embers drift in the air. No creatures, no people, no text.

Watercolor painting with bold black ink linework, strong confident strokes, watercolor washes with controlled bleeding, dark muted palette of charcoal and deep brown with orange-red accents, subtle paper texture. Moody, quiet and dark overall.
```

うまくいかないときに足す一文:
- 明るすぎる: `Very dark overall; only the lava and the right side of the floor are lit.`
- 真ん中に目立つものが来る: `Keep the center of the image empty and dark.`
- 敵の場所がない: `Leave the right third of the floor open and empty.`
