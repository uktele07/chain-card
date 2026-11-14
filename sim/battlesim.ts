// 本番と同じルール（src/game/battle.ts）で、敵との戦闘を自動プレイして勝率と撃破タイムを出す。
// 実行口は sim/run.ts（npm run sim）。
import data from '../data/cards.json';
import { Battle, type CardDef, type EnemyDef, type Gear, type ItemDef, type Rules } from '../src/game/battle';
import { buildDeck, gearOf, type ArmorDef, type WeaponDef } from '../src/game/loadout';

const rules = data.rules as unknown as Rules;
const CARDS = data.cards as CardDef[];
const items = (ids: string[]) => ids.map(id => (data.items as ItemDef[]).find(d => d.id === id) ?? null);
export const SKILLS = { '初心者': { play: 0.8, read: 0.5, keep: 0.4 }, '普通': { play: 0.5, read: 0.3, keep: 0.25 }, '上級': { play: 0.3, read: 0.15, keep: 0.15 } };
export type Skill = { play: number; read: number; keep: number };
export interface Setup { items?: string[]; weapon?: string; armor?: string; spells?: string[]; keepS?: boolean; gear?: Gear }

const deckOf = (spells: string[]) => buildDeck(CARDS, spells, data.rules.maxSpells as number);
const gear = (weapon = 'sword', armor = 'leather'): Gear =>
  gearOf((data.weapons as WeaponDef[]).find(x => x.id === weapon), (data.armors as ArmorDef[]).find(x => x.id === armor));

export function battle(skill: Skill, enemy: EnemyDef, s: Setup = {}) {
  const keepS = s.keepS ?? true;
  const b = new Battle(deckOf(s.spells ?? (data.rules.defaultSpells as string[])), rules, Math.random, items(s.items ?? (data.rules.defaultItems as string[])), enemy, s.gear ?? gear(s.weapon, s.armor));
  const tickItems = () => {
    b.items.forEach((it, i) => {
      if (!it || it.used) return;
      const a = b.enemyAction!, e = it.def.effect;
      if (e === 'heal' && b.hp <= 60) b.useItem(i);
      if (e === 'flash' && a.big && b.enemy!.gauge >= a.chargeSec - 0.5) b.useItem(i);
      if ((e === 'sand' || e === 'rage') && b.time > 2) b.useItem(i);
      if (e === 'awake' && b.chain < 3 && b.slots.some(x => x.card?.lv === 4)) b.useItem(i);
    });
  };
  const adv = (sec: number) => { for (let t = 0; t < sec - 1e-9 && b.result === 'playing'; t += 0.02) { b.update(0.02); tickItems(); } };
  let wasCharging = false;
  while (b.result === 'playing' && b.time < 400) {
    if (b.charging && !b.slots.some(x => x.card && b.canPlay(x.card))) { wasCharging = true; adv(0.02); continue; }
    if (wasCharging) { adv(skill.read); wasCharging = false; continue; }
    if (b.lock > 0) { adv(0.02); continue; }      // 斧の待ちなど
    const cards = b.slots.map((x, i) => ({ s: x, i, c: x.card })).filter(x => x.c);
    const want = keepS && cards.find(x => !x.s.kept && x.c!.lv === 4 && !b.canPlay(x.c!));
    if (want) { b.toggleKeep(want.i); adv(skill.keep); continue; }
    const ok = cards.filter(x => b.canPlay(x.c!));
    const atk = (lv: number) => ok.find(x => x.c!.type === 'attack' && x.c!.lv === lv);
    const spell = (id?: string) => ok.find(x => x.c!.type === 'spell' && (!id || x.c!.id === id));
    const sReady = !!atk(4);
    // レベルXがかかっているときは、いちばん強いアタックに使う
    const best = b.buffs.levelx > 0 ? ok.filter(x => x.c!.type === 'attack').sort((p, q) => q.c!.lv! - p.c!.lv!)[0] : undefined;
    const pick = best ||
      (b.buffs.rankup > 0 && (atk(3) || atk(2))) ||
      (atk(3) && spell('rankup')) ||                    // ランクアップは A に使って S にする
      (sReady && spell()) ||
      atk(4) || atk(b.chain) || atk(b.chain + 1) ||
      (b.hp <= 70 ? spell('drain') : undefined) || spell('double') || spell('levelx') || (b.hp <= 90 ? spell() : undefined) ||
      atk(b.chain - 1) || atk(1) || spell();
    if (pick) { adv(skill.play); b.press(pick.i); continue; }
    adv(0.05);   // 出せるカードがない: 自動入れ替えを待つ
  }
  return b;
}

export function run(skill: Skill, enemy: EnemyDef, s: Setup = {}, N = 1000) {
  let win = 0, hp = 0; const times: number[] = [];
  for (let i = 0; i < N; i++) {
    const b = battle(skill, enemy, s);
    if (b.result === 'won') { win++; times.push(b.time); hp += b.hp; }
  }
  times.sort((p, q) => p - q);
  const q = (r: number) => (times.length ? times[Math.min(times.length - 1, Math.floor(times.length * r))] : NaN);
  return { win: 100 * win / N, med: q(0.5), fast: q(0.2), hp: win ? hp / win : NaN };
}
