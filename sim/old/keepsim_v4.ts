// 本番と同じルール（src/game/battle.ts）を使ったシミュレーション。キープの効果を測る。
// 使い方: npx vite-node sim/keepsim.ts
import data from '../data/cards.json';
import { Battle, type CardDef, type Rules } from '../src/game/battle';

const rules = data.rules as unknown as Rules;
const defs = data.cards as CardDef[];
const SKILLS = { '普通': { play: 0.5, read: 0.3, keep: 0.25 }, '上級': { play: 0.3, read: 0.15, keep: 0.15 } };
type Mode = 'none' | 'S' | 'S+spell';

function battle(skill: { play: number; read: number; keep: number }, mode: Mode, duration = 45) {
  const b = new Battle(defs, rules);
  const adv = (sec: number) => { for (let t = 0; t < sec - 1e-9; t += 0.02) b.update(0.02); };
  let wasCharging = false;
  while (b.time < duration) {
    if (b.charging) { wasCharging = true; adv(0.02); continue; }
    if (wasCharging) { adv(skill.read); wasCharging = false; }
    const cards = b.slots.map((s, i) => ({ s, i, c: s.card })).filter(x => x.c);
    const sInHand = cards.some(x => x.c!.lv === 4);
    const sReady = cards.some(x => x.c!.lv === 4 && b.canPlay(x.c!));
    // キープ: 出せないS。S+spellでは、Sに乗せたいスペルも抱える
    const want = cards.find(x => !x.s.kept && (
      (mode !== 'none' && x.c!.lv === 4 && !b.canPlay(x.c!)) ||
      (mode === 'S+spell' && x.c!.type === 'spell' && !sReady)));
    if (want) { b.toggleKeep(want.i); adv(skill.keep); continue; }
    const playable = cards.filter(x => b.canPlay(x.c!));
    let pick =
      (sReady && playable.find(x => x.c!.type === 'spell')) ||            // Sの直前にスペル
      playable.find(x => x.c!.type === 'attack' && x.c!.lv === b.chain) ||
      playable.find(x => x.c!.type === 'attack' && x.c!.lv === b.chain + 1) ||
      (mode !== 'S+spell' && playable.find(x => x.c!.type === 'spell')) ||
      playable.find(x => x.c!.type === 'attack' && !x.s.kept);
    void sInHand;
    if (pick) { adv(skill.play); b.press(pick.i); continue; }
    if (!b.skip()) {
      // 全部キープで動けない: いちばん不要なキープを外す
      const k = cards.find(x => x.s.kept && x.c!.type === 'spell') ?? cards.find(x => x.s.kept);
      if (k) { b.toggleKeep(k.i); const p = b.canPlay(k.c!) ? k : null; if (p) { adv(skill.play); b.press(p.i); } else b.skip(); }
    }
    adv(0.3);
  }
  return b.stats;
}

const rows: Record<string, Record<string, string>> = {};
const N = 3000;
for (const [name, skill] of Object.entries(SKILLS))
  for (const [label, mode] of [['キープなし', 'none'], ['Sをキープ', 'S'], ['Sとスペルをキープ', 'S+spell']] as [string, Mode][]) {
    const a = { damage: 0, sCount: 0, skips: 0, plays: 0, max20: 0, any: 0 };
    for (let i = 0; i < N; i++) {
      const s = battle(skill, mode);
      a.damage += s.damage; a.sCount += s.sCount; a.skips += s.skips; a.plays += s.plays;
      if (s.maxHit >= 20) a.max20++; if (s.sCount) a.any++;
    }
    rows[`${name}/${label}`] = { '与ダメ': (a.damage / N).toFixed(0), 'S発動': (a.sCount / N).toFixed(2), 'S出た戦闘%': (100 * a.any / N).toFixed(0), '20ダメージが出た戦闘%': (100 * a.max20 / N).toFixed(0), '使用枚数': (a.plays / N).toFixed(1), 'スキップ': (a.skips / N).toFixed(1) };
  }
console.table(rows);
