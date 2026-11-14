// シミュレーションの実行口。使い方: npm run sim  /  npm run sim -- kami
import data from '../data/cards.json';
import type { EnemyDef } from '../src/game/battle';
import { run, SKILLS, type Setup } from './battlesim';

const f = (r: ReturnType<typeof run>) => ({ '勝率%': r.win.toFixed(0), 'タイム中央値': r.med.toFixed(0), '残りHP': r.hp.toFixed(0) });
const picks = process.argv.slice(2).filter(a => (data.enemies as EnemyDef[]).some(e => e.id === a));
const GEARS: [string, Setup][] = [['剣・皮', {}], ['斧・皮', { weapon: 'axe' }], ['弓・皮', { weapon: 'bow' }], ['剣・鉄の鎧', { armor: 'iron' }], ['剣・ライト', { armor: 'light' }], ['斧・ライト', { weapon: 'axe', armor: 'light' }], ['斧・鉄の鎧', { weapon: 'axe', armor: 'iron' }], ['弓・鉄の鎧', { weapon: 'bow', armor: 'iron' }]];
for (const enemy of data.enemies as EnemyDef[]) {
  if (picks.length && !picks.includes(enemy.id)) continue;
  const rows: Record<string, Record<string, string>> = {};
  for (const [name, skill] of Object.entries(SKILLS)) for (const [label, setup] of GEARS) {
    if (name === '初心者' && !['剣・皮', '斧・皮', '斧・ライト'].includes(label)) continue;
    rows[`${name}/${label}`] = f(run(skill, enemy, setup));
  }
  for (const sp of [['double', 'levelx'], ['double', 'drain'], ['double', 'rankup'], ['drain', 'rankup'], ['levelx', 'rankup']]) rows[`普通/剣・皮/スペル ${sp.join('+')}`] = f(run(SKILLS['普通'], enemy, { spells: sp }));
  // ランクの目安（初期装備）: S=上級の速い2割 / A=上級と普通の中間 / B=普通の中央値の1.15倍
  const up = run(SKILLS['上級'], enemy), mid = run(SKILLS['普通'], enemy);
  console.log(`\n## ${enemy.name}（HP ${enemy.hp}）  初期装備でのランクの目安 S≤${Math.round(up.fast)} A≤${Math.round((up.med + mid.med) / 2)} B≤${Math.round(mid.med * 1.15)}　いまの設定 ${JSON.stringify(enemy.rankSec ?? null)}`);
  console.table(rows);
}
