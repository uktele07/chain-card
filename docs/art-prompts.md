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

背景の構図は、**横から見た舞台**にする（2026-11-22、持ち主）。戦闘は左のプレイヤーと右の敵が横に向き合うので、奥へ延びる通路を正面から見る構図は不自然（1回目の生成がそうなった）。
ゲームの中で弱くぼかし、暗くして使う。

置き場所の約束:
- 横長 16:9。奥の壁が画面と平行に立ち、床は左右に延びる帯。消失点（奥へ集まる線）を作らない。
- 床の奥の端は、高さの 60% あたり。敵は右の床（横 80% あたり）に立つので、そこだけ明るく空ける。
- 左と中央には文字と手札が重なる。細かい模様や明るいものを置かない。
- 生き物・人・文字・枠・紙の余白を描かない。

作り方:
1. Gemini で**新しい会話**を始める（同じ会話だと、前の絵の構図を引きずる）。
2. 構図の下絵 `docs/samples/bg-layout-guide.png` を添付する。敵の絵は添付しない（背景に描き込まれやすい）。
3. 下の指示文を送る。縦横比は 16:9。

```
Use the attached image only as a composition guide (layout of the wall, arches, floor and the lit area on the right). Do not copy its flat colors or simple shapes; paint a detailed scene.

Side view of a battle arena inside an ancient fire temple, wide 16:9 landscape, like a theater stage seen straight on. The back wall runs parallel to the picture plane across the whole image: massive dark stone pillars and old brick walls with tall arched openings, evenly spaced from left to right. Through the arches and from cracks at the base of the wall, rivers of lava glow, casting warm orange-red light on the floor. A wide flat stone floor of large cracked slabs runs horizontally across the lower part of the image (the back edge of the floor at about 60 percent of the image height), seen from a slightly raised eye level, with no strong perspective and no corridor leading into the distance. The right side of the floor is softly lit where a monster will stand; the left and center stay calm and dark. Embers drift in the air. No creatures, no people, no text. No border, no frame, no white paper margin; the painting fills the entire image edge to edge.

Watercolor painting with bold black ink linework, strong confident strokes, watercolor washes with controlled bleeding, dark muted palette of charcoal and deep brown with orange-red accents, subtle paper texture. Moody, quiet and dark overall.
```

うまくいかないときに足す一文:
- まだ奥へ延びる通路になる: `Orthographic side view. Do not draw a corridor or a vanishing point.`
- 壁が近すぎて床が見えない: `Show more floor: the floor fills the lower 40 percent of the image.`
- 明るすぎる: `Very dark overall; only the lava and the right side of the floor are lit.`

### 神々しく、明るめにする版（2026-11-22、持ち主の希望）

横から見た舞台の構図はそのまま。高い天井から差し込む光、金の装飾、炎の神をかたどった浮き彫りで、神殿らしい神々しさを足す。加工の明るさは 0.55 → 0.8 程度に上げる（`python3 scripts/art/bgproc.py <元> <出力> 2 0.8`）。

```
Use the attached image only as a composition guide (layout of the wall, arches, floor and the lit area on the right). Do not copy its flat colors or simple shapes; paint a detailed scene.

Side view of a sacred battle hall inside an ancient fire temple, wide 16:9 landscape, like a theater stage seen straight on. The back wall runs parallel to the picture plane across the whole image: tall majestic stone pillars with carved golden ornaments, high arched openings evenly spaced from left to right, and large stone reliefs of a flame deity and sun motifs between the arches. Beams of warm golden light fall from high windows above, with soft light rays and glowing dust in the air. Behind the arches, lava glows gently in orange-red. A wide flat polished stone floor runs horizontally across the lower part of the image (the back edge of the floor at about 60 percent of the image height), with faint golden inlaid patterns, no strong perspective and no corridor leading into the distance. The right side of the floor is bathed in golden light where a monster will stand; the left and center are calmer and slightly darker. Divine, solemn and majestic atmosphere. No creatures, no people, no text. No border, no frame, no white paper margin; the painting fills the entire image edge to edge.

Watercolor painting with bold black ink linework, strong confident strokes, watercolor washes with controlled bleeding, palette of warm stone, deep brown and charcoal with gold and orange-red accents, subtle paper texture.
```

## 効果音（ElevenLabs の Sound Effects。2026-11-24）

方針: 「カードを出す」は、キラキラした魔法の音（持ち主）。C の音を1つ作り、B・A は音程だけ上げる（+2・+4 半音。`src/game/audio.ts` の `CARD_RATE`）。S だけ特別な音。
設定: ループ（∞）オフ、長さ C 0.6秒・S 1.2秒、プロンプトの影響 70%。
**Free プランの音は商用に使えない。** 公開先（ゲーム本体）とリポジトリには入れず、試すだけ。使うと決めたら、Starter（商用可）で同じ指示文で作り直して `public/sfx/card.ogg`・`card-s.ogg` に置く（置けば、合成の音から自動で替わる）。

持ち主が気に入った指示文（2026-11-24）:
- C: `A quick enchanted twinkle: soft celesta-like ding with airy shimmering sparkles, 0.5 seconds, crisp attack, gentle fade, no reverb tail, game sound effect.`
- S: `Ultimate spell activation sound: a quick magical whoosh rising in pitch, ending in a brilliant bell-like flash with cascading twinkles and a subtle heavy thump, clean, no reverb wash.`

ほかの案:
- C: `A short magical sparkle sound for playing a card in a fantasy game: a bright crystalline chime with a soft shimmer tail, quick sharp attack, clean and dry, single hit, no music, no voice.`
- C: `Short magic spell cast sparkle, glassy bell tone with tiny glittering particles, fast attack and short decay, subtle and elegant, single one-shot game UI sound.`
- S: `A powerful magical finishing burst for a fantasy card game: a rising shimmering sweep into a bright crystalline explosion of sparkles with a deep soft low boom underneath, triumphant and special, single one-shot, no music, no voice.`
- S: `Epic magic spell climax: glittering chimes swirl upward and burst into a radiant shower of sparkles, layered with a warm resonant bass impact, 1.2 seconds, majestic and dramatic, game sound effect.`

C の加工（2026-11-24、持ち主「C〜A が少し軽い。音程を少し下げて、リバーブを少し足して」）: 3案を作った（ffmpeg の asetrate で -2・-3・-4 半音、aecho の細かい反射を重ねて響き 弱・中・強）。持ち主は C案3（-4半音・響き強）に決めた。S は「半音1つ上げて、リバーブを足して」→ +1半音で響き 弱・中・強の3案を作った（返事待ち）。
試し方: `node docs/samples/build-card-sfx-page.mjs <出力.html> <S.ogg> <C.ogg>...` で、実際の戦闘で鳴らせる1ファイルのページを作る（できたページは Free の音を含むので、リポジトリに入れない）。
