// 行き先の画面（HTML）。討伐とダンジョンの2つの一覧。右の枠の中の絵は Canvas（src/screens/listscene.ts）
// 見本は docs/samples/style-menu-select.png（ダンジョン）。仕様は docs/look.md の8章
import { html, nothing } from 'lit-html';
import { DUNGEONS, ENEMIES } from '../game/content';
import type { GameScene } from '../scenes/GameScene';

const ROW = (i: number) => `top:${140 + i * 60}px`;

/** 開始前の戦闘画面と同じ、ゲームパッドなどの案内（問題があるときだけ） */
export function noticeOf(gs: GameScene) {
  const ps = gs.input2.padStatus;
  return ps === 'blocked' ? 'このページではゲームパッドを使えない' : ps === 'nonstandard' ? 'ゲームパッドのボタン配置が標準と違う可能性あり' : !gs.snd.ready ? '音が出ないときは、画面を1回クリック' : gs.snd.muted ? '消音中（M キーで戻す）' : '';
}

function hunt(gs: GameScene) {
  const rows = ENEMIES.map((e, i) => {
    const on = i === gs.cur.list, open = gs.unlocked(e), rec = gs.save.records[e.id];
    return html`<div class="row ${on ? 'on' : ''}" style=${ROW(i)}>${on ? html`<div class="dia"></div>` : nothing}
      <div class="mk">${open ? e.rank ?? '' : '？'}</div><div class="nm">${open ? e.name : '？？？'}</div>
      <div class="st ${rec ? 'lit' : ''}">${!open ? '未出現' : rec ? html`<span class="tm">${rec.bestTime.toFixed(1)}<small>秒</small></span><span class="rank">${rec.bestRank}</span>` : '未討伐'}</div></div>`;
  });
  const e = ENEMIES[gs.cur.list], open = gs.unlocked(e), beaten = !!gs.save.records[e.id];
  let right;
  if (!open) right = html`<div class="en" style="color:#8d8576">？？？</div><div class="why">上の敵をすべて討伐すると現れる。</div>`;
  else {
    const pitch = Math.min(34, 170 / e.actions.length);
    const sec = e.actions.reduce((s, a) => s + a.chargeSec, 0), dmg = e.actions.reduce((s, a) => s + a.damage, 0);
    right = html`<div class="en">${e.name}</div><div class="ehp">HP ${e.hp}</div>
      <div class="sm ph">攻撃パターン（上から順に繰り返し）</div>
      ${e.actions.map((a, i) => html`<div class="act ${a.big ? 'big' : ''}" style="top:${272 + i * pitch}px;height:${pitch}px">
        <span class="an">${a.big ? '！' : ''}${a.name}</span>
        ${beaten ? html`<span class="as">${a.chargeSec}<small>秒</small></span><span class="ad">${a.damage}<small>ダメージ</small></span>` : html`<span class="q">？？？</span>`}</div>`)}
      <div class="foot"><span>${beaten ? `1巡 約${Math.round(sec)}秒・計 ${dmg} ダメージ` : ''}</span>
        ${e.drop ? html`<span>戦利品<b>${beaten ? `${e.drop.name}（${e.drop.price} G）` : '？？？'}</b></span>` : nothing}</div>`;
  }
  return { rows, right };
}

function dungeons(gs: GameScene) {
  const sv = gs.save;
  const rows = DUNGEONS.map((d, i) => {
    const on = i === gs.cur.dlist, open = !d.locked;
    const state = !open ? '準備中' : sv.run?.dungeon === d.id ? '探索中' : sv.cleared[d.id] ? '踏破' : '未踏破';
    return html`<div class="row ${on ? 'on' : ''}" style=${ROW(i)}>${on ? html`<div class="dia"></div>` : nothing}
      <div class="mk">${d.mark}</div><div class="nm">${d.name}</div><div class="st">${state}</div></div>`;
  });
  const d = DUNGEONS[gs.cur.dlist];
  return { rows, right: d.locked ? html`<div class="soon">準備中</div>` : nothing };
}

export function listView(gs: GameScene) {
  const dun = gs.listTab === 1, pad = gs.pad;
  const { rows, right } = dun ? dungeons(gs) : hunt(gs);
  const notice = noticeOf(gs);
  return html`<div class="ls">
    <div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div>
    <div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>
    <div class="title">行き先</div>
    <div class="tabs"><span class=${dun ? '' : 'on'}>討伐</span><span class=${dun ? 'on' : ''}>ダンジョン</span><span class="sw">${pad ? 'L1 / R1' : '← →'}</span></div>
    ${rows}
    <div class="sm gold-l">所持金</div>
    <div class="gold">${gs.save.gold}<small>G</small></div>
    <div class="fr2"></div><div class="fr"></div><div class="frl"></div>
    ${right}
    <div class="guide">${pad ? html`<span class="key">○</span>${dun ? '入る' : '決定'}<span class="key">OPTIONS</span>メニュー` : html`<span class="key">Enter</span>${dun ? '入る' : '決定'}<span class="key">Esc</span>メニュー`}</div>
    ${notice ? html`<div class="notice">${notice}</div>` : nothing}
  </div>`;
}
