// 本番と同じルール（src/game/battle.ts）で、敵との戦闘を自動プレイして勝率を出す。
// 使い方: npm run sim
import data from '../data/cards.json';
import { Battle, type CardDef, type EnemyDef, type ItemDef, type Rules } from '../src/game/battle';

const rules = data.rules as unknown as Rules;
const defs = data.cards as CardDef[];
const items = (ids: string[]) => ids.map(id => (data.items as ItemDef[]).find(d => d.id === id)!);
const SKILLS = { '初心者': { play: 0.8, read: 0.5, keep: 0.4 }, '普通': { play: 0.5, read: 0.3, keep: 0.25 }, '上級': { play: 0.3, read: 0.15, keep: 0.15 } };
type Skill = { play: number; read: number; keep: number };

function battle(skill: Skill, keepS: boolean, enemy: EnemyDef, itemIds: string[], useItems = true) {
  const b = new Battle(defs, rules, Math.random, items(itemIds), enemy);
  const adv = (sec: number) => { for (let t = 0; t < sec - 1e-9 && b.result === 'playing'; t += 0.02) { b.update(0.02); tickItems(); } };
  const tickItems = () => {
    if (!useItems) return;
    b.items.forEach((it, i) => {
      if (it.used) return;
      const a = b.enemyAction!;
      if (it.def.effect === 'heal' && b.hp <= rules.playerMaxHp - 20 && b.hp <= 60) b.useItem(i);
      if (it.def.effect === 'flash' && a.big && b.enemy!.gauge >= a.chargeSec - 0.5) b.useItem(i);
      if (it.def.effect === 'sand' && b.time > 3) b.useItem(i);
    });
  };
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
      atk(b.chain) || atk(b.chain + 1) ||
      ok.find(x => x.c!.type === 'spell') ||
      atk(b.chain - 1) || atk(1);
    if (pick) { adv(skill.play); b.press(pick.i); continue; }
    adv(0.05);   // 出せるカードがない: 自動入れ替えを待つ
  }
  return b;
}

function run(label: string, skill: Skill, keepS: boolean, enemy: EnemyDef, itemIds: string[], useItems = true, N = 2000) {
  let win = 0, t = 0, hp = 0, s = 0, auto = 0, miss = 0;
  for (let i = 0; i < N; i++) {
    const b = battle(skill, keepS, enemy, itemIds, useItems);
    if (b.result === 'won') { win++; t += b.time; hp += b.hp; }
    s += b.stats.sCount; auto += b.stats.autoSkips; miss += b.stats.chainBreaks;
  }
  return { [label]: { '勝率%': (100 * win / N).toFixed(0), '撃破タイム(秒)': win ? (t / win).toFixed(0) : '-', '勝利時の残りHP': win ? (hp / win).toFixed(0) : '-', 'S発動': (s / N).toFixed(1), '自動入れ替え': (auto / N).toFixed(1), 'チェイン切れ': (miss / N).toFixed(1) } };
}

const enemies = data.enemies as EnemyDef[];
const picks = process.argv.slice(2);
for (const enemy of enemies) {
  if (picks.length && !picks.includes(enemy.id)) continue;
  const rows = {};
  const def = data.rules.defaultItems as string[];
  for (const [name, skill] of Object.entries(SKILLS)) {
    Object.assign(rows, run(`${name}/アイテムなし`, skill, false, enemy, def, false));
    Object.assign(rows, run(`${name}/回復薬+閃光弾`, skill, false, enemy, def));
    Object.assign(rows, run(`${name}/回復薬+閃光弾/Sキープ`, skill, true, enemy, def));
  }
  Object.assign(rows, run('普通/回復薬×2', SKILLS['普通'], false, enemy, ['potion', 'potion']));
  Object.assign(rows, run('普通/回復薬+星の砂', SKILLS['普通'], false, enemy, ['potion', 'sand']));
  console.log(`\n## ${enemy.name}（HP ${enemy.hp}）`);
  console.table(rows);
}
