// すごろくの盤面の上の情報（HTML）。A 角の直し（docs/samples/style-S5-A.png）。仕様は docs/look.md の14章
// 盤面・マス・駒・ボスの瘴気は Canvas（src/screens/board.ts）
import { html, nothing, svg } from 'lit-html';
import { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';
import { ACCESSORIES, itemOf } from '../game/content';
import { effectText } from '../screens/board';
import type { GameScene } from '../scenes/GameScene';
import { noticeOf } from './list';

const corners = html`<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div>
  <div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;
const key = (gs: GameScene, p: string, k: string, t: string) => html`<span class="key">${gs.pad ? p : k}</span>${t}`;

// ---- サイコロ（黒曜石の立方体）。上の面を読む。手前と右には、上と向かい合う目（和が 7）を出さない ----
const PIPS: Record<number, number[][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const SIDES: Record<number, [number, number]> = { 0: [2, 3], 1: [2, 3], 2: [6, 3], 3: [2, 6], 4: [5, 1], 5: [3, 6], 6: [4, 5] };
const GRAIN = `url('data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .9  0 0 0 .22 -.06"/></filter><rect width="120" height="120" filter="url(#f)"/></svg>')}')`;
const VEIN = `url('data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M-5 70 C20 60 30 75 55 52 S90 40 105 30" stroke="rgba(255,240,220,.08)" stroke-width="1.2" fill="none"/></svg>')}')`;
function face(k: number, s: number, tf: string, light: number, glow: number) {
  const r = s * (k === 1 ? .1 : .075);
  return html`<div class="face" style="width:${s}px;height:${s}px;transform:${tf};border-radius:${s * .13}px;
    background:${GRAIN},${VEIN},linear-gradient(150deg,hsl(25 6% ${10 + light * 14}%) 0%,hsl(25 6% ${6 + light * 6}%) 55%,#060505 100%);background-size:${s * .9}px,${s}px,100%;
    box-shadow:inset 0 0 0 1px rgba(255,240,220,.07),inset ${s * .03}px ${s * .03}px ${s * .06}px rgba(255,240,220,${.04 + light * .05}),inset 0 0 ${s * .22}px rgba(0,0,0,.75)">
    ${k ? (PIPS[k] ?? []).map(([x, y]) => html`<div class="pip" style="left:${s / 2 + x * s * .24 - r}px;top:${s / 2 + y * s * .24 - r}px;width:${r * 2}px;height:${r * 2}px;box-shadow:0 0 ${r * 2 * glow}px #ff6a1f;opacity:${.55 + glow * .45}"></div>`) : html`<div class="q">?</div>`}</div>`;
}
function dice(gs: GameScene) {
  const n = gs.diceFace, size = 100, s = size * .62, [front, right] = SIDES[n] ?? SIDES[0];
  const wob = gs.bmode === 'rolling' && !gs.diceTest ? Math.sin(gs.clock * 31) * 6 : 0;   // 回している間は、少し揺らす
  return html`<div class="dice"><div class="sh"></div>
    <div class="cube" style="left:${(size - s) / 2}px;top:${(size - s) / 2 + 2}px;width:${s}px;height:${s}px;transform:rotateX(-52deg) rotateY(${-32 + wob}deg)">
      ${face(n, s, `rotateX(90deg) translateZ(${s / 2}px)`, .55, 1)}
      ${face(front, s, `translateZ(${s / 2}px)`, .22, .35)}
      ${face(right, s, `rotateY(90deg) translateZ(${s / 2}px)`, .08, .25)}</div></div>`;
}

/** 全体図（道・関所・いる場所・いま映っている範囲）。金の濃淡だけで描く */
function minimap(gs: GameScene) {
  const run = gs.run!, [cols, rows] = run.def.size, G = run.def.cell, w = 120, k = w / cols, h = rows * k;
  const vx = Math.max(0, gs.cam.x) / G * k, vy = Math.max(0, gs.cam.y) / G * k, vw = 960 / G * k, vh = 540 / G * k;
  return html`<div class="map"><svg width=${w} height=${h}>
    ${run.board.map(q => { const st = run.state, here = q.id === st.pos, gate = q.kind === 'boss' || (q.kind === 'mid' && !st.midDone), key = (q.kind === 'key' && !st.key && !st.doorOpen) || (q.kind === 'door' && !st.doorOpen), r = here || gate || key ? 1.6 : 0;
      return `<rect x="${q.x * k - r}" y="${q.y * k - r}" width="${k * .8 + r * 2}" height="${k * .8 + r * 2}" fill="${here ? '#fff' : gate ? '#ff4b1f' : key ? '#ffd76a' : 'rgba(216,180,106,.55)'}"/>`; }).map(t => html`${unsafeSvg(t)}`)}
    <rect x=${vx} y=${vy} width=${Math.min(vw, w - vx)} height=${Math.min(vh, h - vy)} fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".8"></rect></svg></div>`;
}
// マスの並びは数が多いので、svg の文字列にしてまとめて入れる（中身はゲームのデータだけ）
const unsafeSvg = (t: string) => svg`${unsafeSVG(t)}`;

export function boardView(gs: GameScene) {
  const run = gs.run;
  if (!run) return html``;
  const st = run.state, mode = gs.bmode, def = run.def;
  if (mode === 'cleared') {
    const r = gs.reward, acc = ACCESSORIES.find(a => a.id === r?.accessory);
    return html`<div class="bd"><div class="dim"></div><div class="shade-tl"></div>
      <div class="clr">踏破</div><div class="ttl">${def.name}</div>
      <div class="reward"><div class="sm" style="position:static;color:var(--gold)">${acc ? '初回の踏破報酬' : '踏破報酬'}</div>
        ${acc ? html`<div class="ring"></div><div style="font-size:22px;letter-spacing:5px;margin-top:22px">${acc.name}</div><div style="font-size:12px;letter-spacing:1px;color:var(--sub);margin-top:10px">${acc.desc}</div>`
        : html`<div style="font:300 56px var(--f-num);color:var(--gold);margin-top:30px">${r?.gold ?? 0}<span style="font-size:16px;margin-left:8px">G</span></div><div style="font-size:12px;letter-spacing:2px;color:var(--sub);margin-top:14px">所持金 ${gs.save.gold} G</div>`}</div>
      <div class="guide">${key(gs, '○', 'Enter', '決定')}</div>${corners}</div>`;
  }
  const look = mode === 'look';
  const gate = mode === 'choose' ? '分かれ道' : `${run.goalName}まで あと ${run.distanceToGate()}マス`;
  const low = st.hp <= run.maxHp * 0.3;
  const label = mode === 'idle' ? '振る' : mode === 'rolling' ? (gs.diceTest ? '十字キーで目を選ぶ' : '止める') : st.steps > 0 ? `あと ${st.steps}マス` : gs.rolled ? `${gs.rolled} 進んだ` : '';
  let mid: unknown = nothing;
  if (mode === 'landed' && gs.effect) {
    const t = effectText(gs, gs.effect);
    mid = gs.effect.kind === 'monster'
      ? html`<div class="band warn" style="top:292px;height:80px"></div><div class="haz" style="top:286px"></div><div class="haz" style="top:372px"></div>
        <div class="warnt" style="top:302px">WARNING</div><div class="msg" style="top:342px">${t.main}</div>`
      : html`<div class="band" style="top:292px;height:80px"></div><div class="msg-h" style="top:306px">${t.head}</div><div class="msg" style="top:330px">${t.main}</div>`;
  } else if (mode === 'choose') mid = html`<div class="prompt">進む道を選ぶ</div>`;
  else if (look) mid = html`<div class="prompt">先を見ています</div>
    <div class="arrow" style="left:471px;top:60px;border-bottom-color:var(--gold);border-top-width:0"></div><div class="arrow" style="left:471px;top:470px;border-top-color:var(--gold);border-bottom-width:0"></div>
    <div class="arrow" style="left:16px;top:261px;border-right-color:var(--gold);border-left-width:0"></div><div class="arrow" style="right:16px;top:261px;border-left-color:var(--gold);border-right-width:0"></div>`;
  const guide = look ? [key(gs, '十字', '矢印', '動かす'), key(gs, '□ / ✕', 'A / Backspace', '戻る')]
    : mode === 'choose' ? [key(gs, '十字', '矢印', '選ぶ'), key(gs, '○', 'Enter', '決定'), key(gs, '□', 'A', '先を見る'), key(gs, '△', 'W', 'マスの説明')]
    : mode === 'landed' ? [key(gs, '○', 'Enter', gs.effect?.kind === 'monster' ? '戦う' : '次へ')]
    : mode === 'idle' ? [key(gs, '○', 'Enter', 'サイコロ'), key(gs, '□', 'A', '先を見る'), key(gs, '△', 'W', 'マスの説明'), key(gs, 'OPTIONS', 'Esc', 'メニュー')]
    : mode === 'rolling' ? [...(gs.diceTest ? [key(gs, '十字', '矢印', '目を選ぶ')] : []), key(gs, '○', 'Enter', gs.diceTest ? '決定' : '止める'), key(gs, '✕', 'Backspace', 'やめる')] : [];
  const notice = noticeOf(gs);
  return html`<div class="bd"><div class="shade-tl"></div><div class="shade-bl"></div><div class="shade-r"></div>
    <div class="ttl">${def.name}</div>
    <div class="gate">${gate}${st.maxBonus > 0 ? html`<span class="bonus">最大HP +${st.maxBonus}</span>` : nothing}</div>
    ${minimap(gs)}
    <div class="items">${gs.save.items.map((id, i) => { const it = itemOf(id); return html`<span class="item ${!it || st.used[i] ? 'used' : ''}">${it ? it.name : 'なし'}</span>`; })}${st.key ? html`<span class="item key">最深部の鍵</span>` : nothing}</div>
    <div class="sm" style="left:40px;bottom:66px">HP</div>
    <div class="hp ${low ? 'low' : ''}">${st.hp}<small> / ${run.maxHp}</small></div>
    <div class="bar"><i style="width:${Math.min(1, st.hp / run.maxHp) * 100}%"></i></div>
    ${look ? nothing : html`${dice(gs)}<div class="dlabel">${label}</div>`}
    ${gs.diceTest ? html`<div class="test">テスト: 目を選べる</div>` : nothing}
    ${mid}
    <div class="guide">${guide}</div>
    ${notice ? html`<div class="notice">${notice}</div>` : nothing}
    ${corners}</div>`;
}
