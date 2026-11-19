// ダンジョンを最初から最後まで自動で通し、踏破できるか・どのくらいかかるかを出す。
// 使い方: npm run sim:dungeon
import cards from '../data/cards.json';
import dungeons from '../data/dungeons.json';
import type { EnemyDef } from '../src/game/battle';
import { DungeonRun, type DungeonDef } from '../src/game/dungeon';
import { battle, SKILLS, type Setup, type Skill } from './battlesim';

const enemyOf = (id: string) => (cards.enemies as EnemyDef[]).find(e => e.id === id)!;
const ROLL_SEC = 7, EVENT_SEC = 4, BATTLE_EXTRA_SEC = 10;   // サイコロ・マスの表示・戦闘前後にかかる時間の見積もり

function play(def: DungeonDef, skill: Skill, setup: Setup) {
  const run = new DungeonRun(def, 100, [true, true, true]);
  let sec = 0, deaths = 0, battles = 0, rolls = 0, bossHp = 0;
  while (!run.state.cleared && deaths < 20 && rolls < 2000) {
    run.roll(); rolls++; sec += ROLL_SEC;
    for (let guard = 0; guard < 20; guard++) {
      // 分かれ道: HPが6割を切っていたら長い道（回復がある）、そうでなければ短い道。鍵を持って輪の分かれ目に来たら扉へ
      const opt = run.options(), door = opt.find(n => run.board[n].kind === 'door');
      const pick = opt.length > 1 ? door ?? opt[run.state.hp < run.maxHp * 0.6 ? 1 : 0] : undefined;
      if (run.step(pick) === 'landed') break;
    }
    const eff = run.land();
    if (eff.kind !== 'monster') { sec += eff.kind === 'none' ? 0 : EVENT_SEC; continue; }
    if (eff.rank === 'boss') bossHp = run.state.hp;
    const b = battle(skill, enemyOf(eff.enemy), { ...setup, carry: { hp: run.state.hp, maxHp: run.maxHp, used: run.state.used } });
    battles++; sec += b.time + BATTLE_EXTRA_SEC;
    if (b.result === 'won') run.battleWon(b.hp, b.items.map(it => !!it?.used)); else { run.battleLost(); deaths++; }
  }
  return { sec, deaths, battles, rolls, bossHp, cleared: run.state.cleared };
}

const N = 200;
for (const def of (dungeons.dungeons as unknown as DungeonDef[]).filter(d => !d.locked)) {
  const rows: Record<string, Record<string, string>> = {};
  for (const [name, skill] of Object.entries(SKILLS)) for (const [label, setup] of [['剣・革', {}], ['斧・銀', { weapon: 'axe', armor: 'light' }]] as [string, Setup][]) {
    let noDeath = 0, sec = 0, deaths = 0, battles = 0, rolls = 0, bossHp = 0;
    for (let i = 0; i < N; i++) { const r = play(def, skill, setup); if (r.deaths === 0) noDeath++; sec += r.sec; deaths += r.deaths; battles += r.battles; rolls += r.rolls; bossHp += r.bossHp; }
    rows[`${name}/${label}`] = { '一度も負けずに踏破%': (100 * noDeath / N).toFixed(0), '負けた回数': (deaths / N).toFixed(1), '所要時間(分)': (sec / N / 60).toFixed(1), '戦闘回数': (battles / N).toFixed(1), 'サイコロ': (rolls / N).toFixed(1), 'ボス戦開始時のHP': (bossHp / N).toFixed(0) };
  }
  console.log(`\n## ${def.name}`);
  console.table(rows);
}
