// ダンジョンの調整案を比べるための試算（データは書き換えない）。使い方: npx vite-node sim/variants.ts
// 盤面のマスの並び（座標は使わない）と、敵の強さを変えて、dungeonsim と同じ自動プレイヤーで通す
import cards from '../data/cards.json';
import dungeons from '../data/dungeons.json';
import type { EnemyDef } from '../src/game/battle';
import { DungeonRun, type DungeonDef } from '../src/game/dungeon';
import { battle, SKILLS, type Setup } from './battlesim';

const ROLL_SEC = 7, EVENT_SEC = 4, BATTLE_EXTRA_SEC = 10;
const base = (dungeons.dungeons as unknown as DungeonDef[])[0];
type Seg = { id: string; next: string[]; cells: [number, number, string][] };
/** マスの並びの文字列から道を作る（S 入口 n なし m 敵 h 回復 u 最大HP i アイテム e 火柱 r ランダム M 中ボス B ボス） */
const seg = (id: string, kinds: string, next: string[]): Seg => ({ id, next, cells: [...kinds].map((k, i) => [i, 0, k] as [number, number, string]) });

/** 敵の強さ: hp と damage に掛ける倍率（ダンジョンの敵だけ） */
function enemies(zHp = 1, zDmg = 1, bHp = 1, bDmg = 1, ceil = false) {
  return (cards.enemies as EnemyDef[]).filter(e => (e as EnemyDef & { dungeon?: string }).dungeon).map(e => {
    const boss = e.id === base.midBoss || e.id === base.boss, h = boss ? bHp : zHp, d = boss ? bDmg : zDmg;
    return { ...e, hp: Math.round(e.hp * h), actions: e.actions.map(a => ({ ...a, damage: Math.max(1, (ceil ? Math.ceil : Math.round)(a.damage * d - 1e-9)) })) };
  });
}
type Variant = { name: string; segs: Seg[]; foes: EnemyDef[]; event?: number };
const cur = base.segments as unknown as Seg[];

// 案A: いまの盤面（比べるため）
// 案B: 長く（本道を約1.7倍、約100マス）。分かれ道の中身は今のまま
// 案C: 案B に、遠回りの損を付ける。長い道は 11マスで、回復 1・火柱 3・敵なし（安全だが遅く、じわじわ削られる）。
//      短い道は 4マスで、敵 2・アイテム 1・最大HPアップ 1（危ないが得）
// 案D: 案C に、敵を強く（雑魚 HP ×1.3・ダメージ ×1.3、中ボス・ボス HP ×1.25・ダメージ ×1.2）
const longMain = [
  seg('s0', 'Snmnhmrnmienmnrmen', ['a1', 'b1']),
  seg('s2', 'nmenmhrmnihmnemrnmhnmen'.slice(0, 20) + 'Mhnmenmrnen', ['a2', 'b2']),
  seg('s4', 'nmnemhrmnimhnmenrmnhmn', ['a3', 'b3']),
  seg('s6', 'nmenmrnihnmeB', []),
];
const curBranches = [seg('a1', 'mmi', ['s2']), seg('b1', 'nhnrhnu', ['s2']), seg('a2', 'mmi', ['s4']), seg('b2', 'nhrnunh', ['s4']), seg('a3', 'mrm', ['s6']), seg('b3', 'hnunhni', ['s6'])];
const newBranches = [
  seg('a1', 'mumi', ['s2']), seg('b1', 'nenhnenrnen', ['s2']),
  seg('a2', 'mimu', ['s4']), seg('b2', 'nennhenrnen', ['s4']),
  seg('a3', 'mumi', ['s6']), seg('b3', 'nenrnhennen', ['s6']),
];
const VARIANTS: Variant[] = [
  { name: 'A いま', segs: cur, foes: enemies() },
  { name: 'B 長く', segs: [...longMain, ...curBranches], foes: enemies() },
  { name: 'C 長く＋遠回りに損', segs: [...longMain, ...newBranches], foes: enemies() },
  { name: 'D Cに＋敵を強く', segs: [...longMain, ...newBranches], foes: enemies(1.3, 1.3, 1.25, 1.2) },
  // 案F（持ち主の指示、2026-11-19）: D を直す。雑魚は HP そのまま・ダメージ ×1.3（切り上げ）、中ボス・ボスは HP ×1.2・ダメージ ×1.3（切り上げ）、火柱 3→7
  { name: 'F Dを直す', segs: [...longMain, ...newBranches], foes: enemies(1, 1.3, 1.2, 1.3, true), event: 7 },
  { name: 'G いまの盤面でFの数値', segs: cur, foes: enemies(1, 1.3, 1.2, 1.3, true), event: 7 },
  { name: 'E Cに＋敵を少し強く', segs: [...longMain, ...newBranches], foes: enemies(1.15, 1.2, 1.15, 1.1) },
];

function play(v: Variant, skill: (typeof SKILLS)[keyof typeof SKILLS], setup: Setup, policy: 'hp' | 'short' | 'long') {
  const def = { ...base, segments: v.segs, event: { ...base.event, damage: v.event ?? base.event.damage } } as unknown as DungeonDef;
  const foe = (id: string) => v.foes.find(e => e.id === id)!;
  const run = new DungeonRun(def, 100, [true, true, true]);
  let sec = 0, deaths = 0;
  while (!run.state.cleared && deaths < 20) {
    run.roll(); sec += ROLL_SEC;
    for (let g = 0; g < 30; g++) {
      const opt = run.options(), pick = opt.length > 1 ? opt[policy === 'short' ? 0 : policy === 'long' ? 1 : run.state.hp < run.maxHp * 0.6 ? 1 : 0] : undefined;
      if (run.step(pick) === 'landed') break;
    }
    const eff = run.land();
    if (eff.kind !== 'monster') { sec += eff.kind === 'none' ? 0 : EVENT_SEC; continue; }
    const b = battle(skill, foe(eff.enemy), { ...setup, carry: { hp: run.state.hp, maxHp: run.maxHp, used: run.state.used } });
    sec += b.time + BATTLE_EXTRA_SEC;
    if (b.result === 'won') run.battleWon(b.hp, b.items.map(it => !!it?.used)); else { run.battleLost(); deaths++; }
  }
  return { sec, deaths };
}
const N = 200;
for (const v of VARIANTS.filter(v => !process.env.ONLY || v.name.startsWith(process.env.ONLY))) {
  const n = v.segs.reduce((s, g) => s + g.cells.length, 0);
  const rows: Record<string, Record<string, string>> = {};
  for (const [sk, label] of [['普通', '普通/剣・革'], ['上級', '上級/剣・革'], ['上級', '上級/斧・銀']] as const) {
    const setup: Setup = label.includes('斧') ? { weapon: 'axe', armor: 'light' } : {};
    for (const pol of ['short', 'long'] as const) {
      let ok = 0, sec = 0, dt = 0;
      for (let i = 0; i < N; i++) { const r = play(v, SKILLS[sk], setup, pol); if (r.deaths === 0) ok++; sec += r.sec; dt += r.deaths; }
      rows[`${label} ${pol === 'short' ? '短い道' : '長い道'}`] = { '一度も負けずに踏破%': (100 * ok / N).toFixed(0), '負けた回数': (dt / N).toFixed(1), '所要時間(分)': (sec / N / 60).toFixed(1) };
    }
  }
  console.log(`\n## ${v.name}（${n}マス）`); console.table(rows);
}
