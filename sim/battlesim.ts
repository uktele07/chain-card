// 本番と同じルール（src/game/battle.ts）で、敵との戦闘を自動プレイして勝率と撃破タイムを出す。
// 使い方: npm run sim            （全部の敵）
//         npm run sim -- maou    （指定した敵だけ）
import data from '../data/cards.json';
import { Battle, type CardDef, type EnemyDef, type ItemDef, type Rules } from '../src/game/battle';

const rules = data.rules as unknown as Rules;
const defs = data.cards as CardDef[];
const items = (ids: string[]) => ids.map(id => (data.items as ItemDef[]).find(d => d.id === id) ?? null);
const SKILLS = { '初心者': { play: 0.8, read: 0.5, keep: 0.4 }, '普通': { play: 0.5, read: 0.3, keep: 0.25 }, '上級': { play: 0.3, read: 0.15, keep: 0.15 } };
type Skill = { play: number; read: number; keep: number };

export function battle(skill: Skill, keepS: boolean, enemy: EnemyDef, itemIds: string[]) {
  const b = new Battle(defs, rules, Math.random, items(itemIds), enemy);
  const tickItems = () => {
    b.items.forEach((it, i) => {
      if (!it || it.used) return;
      const a = b.enemyAction!, e = it.def.effect;
      if (e === 'heal' && b.hp <= 60) b.useItem(i);
      if (e === 'flash' && a.big && b.enemy!.gauge >= a.chargeSec - 0.5) b.useItem(i);
      if ((e === 'sand' || e === 'rage') && b.time > 2) b.useItem(i);
      // チェインの実: 出せないSを持っていて、チェインが足りないとき
      if (e === 'awake' && b.chain < 3 && b.slots.some(s => s.card?.lv === 4)) b.useItem(i);
    });
  };
  const adv = (sec: number) => { for (let t = 0; t < sec - 1e-9 && b.result === 'playing'; t += 0.02) { b.update(0.02); tickItems(); } };
  let wasCharging = false;
  while (b.result === 'playing' && b.time < 300) {
    if (b.charging) { wasCharging = true; adv(0.02); continue; }
    if (wasCharging) { adv(skill.read); wasCharging = false; continue; }
    const cards = b.slots.map((s, i) => ({ s, i, c: s.card })).filter(x => x.c);
    const want = keepS && cards.find(x => !x.s.kept && x.c!.lv === 4 && !b.canPlay(x.c!));
    if (want) { b.toggleKeep(want.i); adv(skill.keep); continue; }
    const ok = cards.filter(x => b.canPlay(x.c!));
    const atk = (lv: number) => ok.find(x => x.c!.type === 'attack' && x.c!.lv === lv);
    const sReady = ok.some(x => x.c!.lv === 4);
    // レベルXがかかっているときは、いちばん強いアタックに使う
    const best = b.buffs.levelx > 0 ? ok.filter(x => x.c!.type === 'attack').sort((p, q) => q.c!.power! - p.c!.power!)[0] : undefined;
    const pick = best ||
      (sReady && ok.find(x => x.c!.type === 'spell')) ||
      atk(4) || atk(b.chain) || atk(b.chain + 1) ||
      ok.find(x => x.c!.type === 'spell') ||
      atk(b.chain - 1) || atk(1);
    if (pick) { adv(skill.play); b.press(pick.i); continue; }
    adv(0.05);   // 出せるカードがない: 自動入れ替えを待つ
  }
  return b;
}

function run(skill: Skill, keepS: boolean, enemy: EnemyDef, itemIds: string[], N = 1500) {
  let win = 0, hp = 0, s = 0; const times: number[] = [];
  for (let i = 0; i < N; i++) {
    const b = battle(skill, keepS, enemy, itemIds);
    if (b.result === 'won') { win++; times.push(b.time); hp += b.hp; }
    s += b.stats.sCount;
  }
  times.sort((p, q) => p - q);
  const q = (r: number) => (times.length ? times[Math.min(times.length - 1, Math.floor(times.length * r))] : NaN);
  return { win: 100 * win / N, med: q(0.5), fast: q(0.2), hp: win ? hp / win : NaN, s: s / N };
}

const picks = process.argv.slice(2);
const LOADOUTS: [string, string[]][] = [['なし', []], ['回復・閃光・チェイン', ['potion', 'flash', 'awake']], ['回復×3', ['potion', 'potion', 'potion']], ['回復・強化・チェイン', ['potion', 'rage', 'awake']], ['回復・閃光・時の砂', ['potion', 'flash', 'sand']], ['閃光×3', ['flash', 'flash', 'flash']]];
for (const enemy of data.enemies as EnemyDef[]) {
  if (picks.length && !picks.includes(enemy.id)) continue;
  const rows: Record<string, Record<string, string>> = {};
  const f = (r: ReturnType<typeof run>) => ({ '勝率%': r.win.toFixed(0), 'タイム中央値': r.med.toFixed(0), '速い2割': r.fast.toFixed(0), '残りHP': r.hp.toFixed(0), 'S発動': r.s.toFixed(1) });
  for (const [name, skill] of Object.entries(SKILLS)) {
    rows[`${name}/回復・閃光・チェイン`] = f(run(skill, false, enemy, LOADOUTS[1][1]));
    rows[`${name}/同上＋Sキープ`] = f(run(skill, true, enemy, LOADOUTS[1][1]));
  }
  for (const [label, ids] of LOADOUTS) rows[`普通＋Sキープ/${label}`] = f(run(SKILLS['普通'], true, enemy, ids));
  // ランクの目安: S=上級の速い2割 / A=上級と普通の中間 / B=普通の中央値の1.15倍
  const up = run(SKILLS['上級'], true, enemy, LOADOUTS[1][1]), mid = run(SKILLS['普通'], true, enemy, LOADOUTS[1][1]);
  const S = Math.round(up.fast), B = Math.round(mid.med * 1.15), A = Math.round((up.med + mid.med) / 2);
  console.log(`\n## ${enemy.name}（HP ${enemy.hp}）  ランクの目安 S≤${S} A≤${A} B≤${B}　いまの設定 ${JSON.stringify(enemy.rankSec ?? null)}`);
  console.table(rows);
}
