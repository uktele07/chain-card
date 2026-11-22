// 戦闘の画面まわり（HTML）。開始前・戦闘中を描く。背景・敵・演出は Canvas（src/screens/battlescene.ts）
// 仕様は docs/look.md。見本は docs/samples/style-D6B-fight.png（戦闘中）と style-D4-start.png（開始前）
import { html, nothing, svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { LEVEL_LABELS, type Card } from '../game/battle';
import { RULES, MARK, ITEMS } from '../game/content';
import { GLY } from '../screens/common';
import type { GameScene } from '../scenes/GameScene';

/** 敵の名前の左に出す種別（金）。ダンジョンの雑魚は出さない */
const KIND: Record<string, string> = { 主: 'BOSS', 中: 'GUARD', 弱: '弱', 並: '並', 強: '強', 魔: '魔', 神: '神' };
/** 差し色（ダンジョンごと）。討伐の差し色は未定なので、火と同じにしている */
const ACCENT: Record<string, string> = { fire: '#ff4b1f', water: '#1fa8ff' };
/** 手札の置き場（中心からのずれ。82×92 の 0.9倍で、上下に 90、左右に 98） */
// 手札の4枚の中心（チェインのひし形からの距離）。2026-11-22 に間隔を縮めた（左右 98→86、上下 90→86。見本 docs/samples/style-L2-*.png）
const OFF = [[0, -86], [86, 0], [0, 86], [-86, 0]];
/** 手札とチェインのひし形の中心。2026-11-22 にカード1枚分（74）左へ寄せた（敵を広く見せるため） */
export const HAND_AT = { x: 406, y: 368 };
/** アイテムの段（上から。1段目が選択中） */
const SLOT = [{ x: 0, y: 0, w: 204, h: 38, fs: 14, a: 1 }, { x: -9, y: 43, w: 190, h: 32, fs: 12.5, a: 0.8 }, { x: -18, y: 80, w: 174, h: 26, fs: 11, a: 0.6 }];

// カードの傾き: 配られたカードが変わるたびに、−2〜+2度でランダムに決め直す
const tilts: { uid: number; deg: number }[] = [];
function tiltOf(i: number, c: Card | null) {
  const uid = c ? c.uid : -1, t = tilts[i];
  if (!t || t.uid !== uid) tilts[i] = { uid, deg: Math.round((Math.random() * 4 - 2) * 10) / 10 };
  return tilts[i].deg;
}

export function battleView(gs: GameScene) {
  const b = gs.battle, e = b.enemy!, act = b.enemyAction!;
  const ready = gs.base === 'ready', fight = gs.base === 'fight' && gs.overlays.length === 0;
  const hidden = !ready && !fight;
  const stun = e.stunLeft > 0, big = !!act.big && !stun;
  const locked = b.lock > 0 && b.missLock;
  const ac = ACCENT[gs.inRun && gs.run ? gs.run.def.id : 'fire'] ?? ACCENT.fire;
  const kind = KIND[e.def.rank ?? ''];
  const pad = gs.pad;

  // 次の攻撃
  const left = Math.max(0, act.chargeSec - e.gauge);
  const blink = big && fight && Math.floor(gs.clock * 6) % 2 ? 0.75 : 1;
  const next = hidden ? nothing : html`
    <div class="next1"><span class="tag">NEXT</span>
      <span class="atk ${stun ? 'stun' : big ? 'big' : ''}">${stun ? 'スタン中' : (big ? '！' : '') + act.name}</span></div>
    <div class="next2 ${stun ? 'stun' : ''}">
      <span class="dmg ${big ? 'big' : ''}">${act.damage}<span class="unit">ダメージ</span></span><span class="sep"></span>
      <span class="sec">${left.toFixed(1)}<span class="unit">秒</span></span></div>
    <div class="gauge"><i class=${big ? 'big' : ''} style="width:${Math.min(1, e.gauge / act.chargeSec) * 100}%;opacity:${blink}"></i></div>`;

  // 手札
  const cards = OFF.map(([dx, dy], i) => {
    const slot = b.slots[i], c = slot?.card ?? null;
    const at = `left:${HAND_AT.x + dx - 41}px;top:${HAND_AT.y + dy - 46}px;transform:rotate(${tiltOf(i, ready ? null : c)}deg) scale(.855)`;   // 82×92 を 0.855倍（以前の 0.9 の 95%）
    if (ready) return html`<div class="c off q" style=${at}><div class="lv">?</div><div class="gl">${GLY[i]}</div></div>`;
    if (hidden || !c) {
      const pr = !hidden && b.charging && b.chargeTotal > 0 ? 1 - b.chargeLeft / b.chargeTotal : 0;
      return html`<div class="c empty" style=${at}>${pr > 0 ? html`<div class="fill" style="height:${pr * 100}%"></div>` : nothing}<div class="gl">${GLY[i]}</div></div>`;
    }
    const ok = b.canPlay(c) && !locked, spell = c.type === 'spell';
    return html`<div class="c ${spell ? 'sp' : ''} ${ok ? '' : 'off'} ${slot.kept ? 'kept' : ''}" style=${at}>
      <div class="lv">${spell ? MARK[c.effect!] ?? '?' : LEVEL_LABELS[c.lv!]}</div>
      <div class="pw">${spell ? c.name : `威力 ${b.powerOf(c.lv!)}`}</div>
      <div class="gl">${GLY[i]}</div>${slot.kept ? html`<div class="kp">KEEP</div>` : nothing}</div>`;
  });

  // チェイン（開始前は START）
  let chain;
  if (ready) {
    chain = html`<div class="chain st"></div>
      <div class="chs" style="top:348px;font-weight:500;font-size:8px;letter-spacing:3px">START</div>
      <div class="chl" style="top:360px;font:${pad ? '300 26px/30px var(--f-ja)' : '500 12px/30px var(--f-num)'};letter-spacing:${pad ? 0 : 2}px">${pad ? '○' : 'Enter'}</div>`;
  } else {
    const waiting = !locked && b.lock > 0.15, ratio = !hidden && b.chain > 0 ? b.chainTimer / RULES.chainTimerSec : 0;
    const label = locked ? 'ミス' : waiting ? '構え' : b.charging && b.chargeTotal > 0.2 ? '入れ替え中' : 'CHAIN';
    const r = 48, path = `M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`;
    const marks = (Object.keys(MARK) as (keyof typeof b.buffs)[]).filter(k => b.buffs[k] > 0).map(k => MARK[k]);
    chain = html`<div class="chain ${locked ? 'miss' : ''}"></div>
      <svg class="ctimer" viewBox="-50 -50 100 100">
        ${svg`<path d=${path} fill="none" stroke="rgba(216,180,106,.25)" stroke-width="1"/>`}
        ${ratio > 0 ? svg`<path d=${path} fill="none" stroke=${ratio < 0.34 ? '#ff5a5a' : '#d8b46a'} stroke-width="2" pathLength="1" stroke-dasharray="${Math.min(1, ratio)} 1" style="filter:drop-shadow(0 0 3px ${ratio < 0.34 ? '#ff5a5a' : '#d8b46a'})"/>` : nothing}
      </svg>
      ${hidden ? nothing : html`<div class="chs ${label === 'CHAIN' ? '' : 'ja'} ${locked ? 'miss' : ''}">${label}</div>`}
      <div class="chl ${locked ? 'miss' : ''}" style="transform:scale(${1 + gs.ringPulse * 1.2})">${locked ? '✕' : !hidden && b.chain > 0 ? LEVEL_LABELS[b.chain] : '–'}</div>
      ${!hidden && marks.length ? html`<div class="buffs">${marks.map(m => html`<span>${m}</span>`)}</div>` : nothing}`;
  }

  // アイテム（リボルバー）: 選択中から順に並べる。段の位置は CSS の動きでなめらかに移る
  const n = b.items.length, order = Array.from({ length: n }, (_, k) => (b.selected + k) % n).slice(0, SLOT.length);
  const sel = b.items[b.selected], selLive = !!sel && !sel.used;
  const rows = repeat(order, i => i, (i, k) => {
    const it = b.items[i], s = SLOT[k], live = !!it && !it.used, top = k === 0 && live;
    const st = styleMap({ left: `${28 + s.x}px`, top: `${214 + s.y}px`, width: `${s.w}px`, height: `${s.h}px`, lineHeight: `${s.h}px`, fontSize: `${s.fs}px`, opacity: String(live || !it ? s.a : s.a * 0.45), zIndex: String(3 - k) });
    return html`<div class="rv ${top ? 'sel' : ''}" style=${st}>${it ? it.def.name : 'なし'}${top && !ready ? html`<span class="r2">${pad ? 'R2' : 'E'}</span>` : it?.used ? html`<span class="usd">使用済み</span>` : nothing}</div>`;
  });
  const desc = selLive ? (ITEMS.find(d => d.id === sel!.def.id)?.desc ?? '').replace(/。$/, '') : '';
  const total = (eff: string) => ITEMS.find(d => d.effect === eff)?.durationSec ?? 10;
  const timers: [string, number, number][] = [];
  if (b.rageLeft > 0) timers.push(['強化薬', b.rageLeft, total('rage')]);
  if (b.sandLeft > 0) timers.push(['時の砂', b.sandLeft, total('sand')]);

  // 自分のHP
  const low = b.hp <= b.maxHp * 0.3;

  // 開始前の案内
  const ps = gs.input2.padStatus;
  const notice = ps === 'blocked' ? 'このページではゲームパッドを使えない' : ps === 'nonstandard' ? 'ゲームパッドのボタン配置が標準と違う可能性あり' : !gs.snd.ready ? '音が出ないときは、画面を1回クリック' : gs.snd.muted ? '消音中（M キーで戻す）' : '';

  return html`<div class="bt" style="--ac:${ac}">
    <div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div>
    <div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>

    <div class="band"></div>
    <div class="ename">${kind ? html`<span class="kind">${kind}</span>` : nothing}<span class="nm">${e.def.name}</span></div>
    <div class="sm" style="right:44px;top:84px">HP</div>
    <div class="num" style="right:44px;top:102px">${e.hp}<span class="of"> / ${e.def.hp}</span></div>
    <div class="bar ehp" style="right:44px;top:148px;width:230px"><i style="width:${(e.hp / e.def.hp) * 100}%"></i></div>

    ${next}
    ${cards}
    ${chain}

    <div class="sm" style="left:28px;top:192px">アイテム</div>
    ${rows}
    <div class="side">
      ${desc ? html`<div class="desc">${desc}</div>` : nothing}
      ${timers.length ? html`<div class="eff-h">効果</div>${timers.map(([nm, l, t]) => html`<div class="tm">
        <div class="row"><span class="n">${nm}</span><span class="s">${l.toFixed(1)}<small>秒</small></span></div>
        <div class="b"><i style="width:${Math.min(1, l / t) * 100}%"></i></div></div>`)}` : nothing}
    </div>

    <div class="sm" style="left:30px;bottom:66px">HP${b.burning && !b.invincible ? html`<span class="burn">やけど　${b.burning.everySec}秒ごとに −${b.burning.damage}</span>` : nothing}</div>
    <div class="num ${low ? 'low' : ''}" style="left:30px;bottom:24px">${b.hp}<span class="of"> / ${b.maxHp}</span></div>
    <div class="bar php" style="left:30px;bottom:14px;width:230px"><i style="width:${(b.hp / b.maxHp) * 100}%"></i></div>

    ${ready && !gs.inRun ? html`<div class="guide">${pad ? html`<span class="key">✕</span>戻る<span class="key">OPTIONS</span>メニュー` : html`<span class="key">Backspace</span>戻る<span class="key">Esc</span>メニュー`}</div>` : nothing}
    ${ready && notice ? html`<div class="notice">${notice}</div>` : nothing}
  </div>`;
}
