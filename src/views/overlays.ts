// 結果・ポーズ・再開のカウント（HTML）。B 帯の案（docs/samples/style-S2-B.png）
import { html, nothing } from 'lit-html';
import { PAUSE, PAUSE_DUNGEON } from '../screens/common';
import type { GameScene } from '../scenes/GameScene';

const ACCENT: Record<string, string> = { fire: '#ff4b1f', water: '#1fa8ff' };
const accent = (gs: GameScene) => ACCENT[gs.inRun && gs.run ? gs.run.def.id : 'fire'] ?? ACCENT.fire;
const key = (k: string) => html`<span class="key">${k}</span>`;
const corners = html`<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div>
  <div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;

export function resultView(gs: GameScene) {
  const b = gs.battle, won = b.result === 'won', ready = gs.resultWait <= 0, pad = gs.pad;
  // 選ぶもの: 討伐は「もう一度 / 一覧に戻る」、ダンジョンは1つだけ（勝てば進む、負ければ入口か中間地点）
  // ダンジョンで負けたときは「ダンジョンから出る」も選べる
  const choices = gs.inRun && gs.run ? (won ? ['進む'] : [gs.run.state.doorOpen ? '扉に戻る' : gs.run.state.midDone ? '中間地点に戻る' : '入口に戻る', 'ダンジョンから出る']) : ['もう一度', '一覧に戻る'];
  const sel = choices.length === 1 ? 0 : gs.cur.result;
  const long = choices.some(c => c.length > 6);   // 「ダンジョンから出る」など長い項目は、少し左から詰めて並べる
  const chs = choices.map((c, i) => html`<div class="ch ${ready && i === sel ? 'on' : ''} ${ready ? '' : 'wait'}" style="left:${long ? 762 : 770}px;letter-spacing:${long ? 2 : 4}px;top:${244 + (choices.length === 1 ? 20 : i * 40)}px">${c}</div>`);
  const guide = html`<div class="guide">${choices.length > 1 ? html`${key(pad ? '↑ ↓' : '↑ ↓')}選ぶ` : nothing}${key(pad ? '○' : 'Enter')}決定</div>`;
  if (!won) {
    const rows: [string, string][] = [[`${gs.enemy.name} の残りHP`, `${b.enemy!.hp} / ${gs.enemy.hp}`], ['経過時間', `${b.time.toFixed(1)} 秒`]];
    return html`<div class="ov" style="--ac:${accent(gs)}"><div class="dim" style="background:rgba(5,4,3,.55)"></div>
      <div class="band lose" style="top:170px;height:200px"></div>
      <div class="lose-t" style="top:248px">敗北</div>
      <div class="vl" style="left:300px;top:200px;height:140px"></div>
      ${rows.map(([k, v], i) => html`<div class="st" style="left:330px;top:${214 + i * 58}px"><div class="k">${k}</div><div class="v">${v}</div></div>`)}
      <div class="vl" style="left:740px;top:200px;height:140px"></div>
      ${chs}${corners}${guide}</div>`;
  }
  const o = gs.outcome;
  // 討伐回数と、この戦闘より前の最速タイム（無敵を使った戦闘は記録しないので出さない）
  const rows: [string, string, string][] = [
    ['討伐回数', b.usedInvincible ? '記録なし' : `${o.wins} 回`, b.usedInvincible ? 'none' : ''],
    ['これまでの最速タイム', o.prevBest === null ? '—' : `${o.prevBest.toFixed(1)} 秒`, o.prevBest === null ? 'none' : ''],
    ['戦利品', gs.gained ? (gs.gained.money ? gs.gained.name : `${gs.gained.name} ×1`) : 'なし', gs.gained ? 'g' : 'none'],
  ];
  return html`<div class="ov" style="--ac:${accent(gs)}"><div class="dim"></div>
    <div class="band" style="top:150px;height:240px"></div>
    <div class="ttl" style="top:176px">${gs.enemy.name}<small>討伐</small></div>
    <div class="sm" style="left:60px;top:240px">討伐タイム</div>
    <div class="time" style="top:254px">${b.time.toFixed(1)}<small>秒</small></div>
    ${o.rank ? html`<div class="rank" style="left:330px;top:250px;width:84px;height:84px">${o.rank}</div>` : nothing}
    ${o.newBest ? html`<div class="best" style="top:352px">自己ベスト更新</div>` : b.usedInvincible ? html`<div class="best no" style="top:352px">無敵使用のため記録なし</div>` : nothing}
    <div class="vl" style="left:460px;top:180px;height:180px"></div>
    ${rows.map(([k, v, c], i) => html`<div class="st" style="left:490px;top:${186 + i * 58}px"><div class="k">${k}</div><div class="v ${c}">${v}</div></div>`)}
    <div class="vl" style="left:740px;top:180px;height:180px"></div>
    ${chs}${corners}${guide}</div>`;
}

export function pauseView(gs: GameScene) {
  const pad = gs.pad;
  const items: [string, string, boolean][] = gs.inRun ? PAUSE_DUNGEON.map(l => [l, '', false]) : PAUSE.map((l, i) => [l, i === 2 ? '一覧に戻る' : '', false]);
  return html`<div class="ov" style="--ac:${accent(gs)}"><div class="dim" style="background:rgba(5,4,3,.55)"></div>
    <div class="band" style="top:226px;height:88px"></div>
    <div class="pz" style="top:257px">PAUSE</div>
    ${items.map(([l, note, warn], i) => html`<div class="ch ${i === gs.cur.pause ? 'on' : ''}" style="left:${(items.length > 2 ? 360 : 420) + i * (items.length > 2 ? 190 : 220)}px;top:260px">${l}${note ? html`<span class="note ${warn ? 'warn' : ''}">${note}</span>` : nothing}</div>`)}
    <div class="guide">${key('← →')}選ぶ${key(pad ? '○' : 'Enter')}決定${key(pad ? '✕' : 'Esc')}再開</div></div>`;
}

export function resumeView(gs: GameScene) {
  return html`<div class="ov"><div class="dim" style="background:rgba(5,4,3,.3)"></div>
    <div class="band" style="top:236px;height:68px"></div>
    <div class="cnt" style="top:248px"><span>READY</span>${Math.max(0, gs.resumeLeft).toFixed(1)}</div></div>`;
}
