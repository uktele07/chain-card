// デッキ回転シミュレーション v2（シンプル版ルール）
// 使い方: node sim/simulate.mjs
// ルール: アタックは同レベルか1つ上、またはLv1。スペルはレベルなしでいつでも出せ、
//         効果は次のアタック1枚に乗る（重ねがけ可、手札をまたいで持続）。
//         スキップするとチェイン-1。Lv4の後もLv4は続けて出せる。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '../data/cards.json'), 'utf8'));
const R = data.rules;

const SKILLS = {
  '普通': { play: 0.5, read: 0.3, skip: 0.3 },
  '上級': { play: 0.3, read: 0.15, skip: 0.2 },
};

function buildDeck(counts) {
  const deck = [];
  for (const c of data.cards) {
    const n = counts?.[c.id] ?? c.copies;
    for (let i = 0; i < n; i++) deck.push(c);
  }
  return deck;
}

function drawHand(pool, n) {
  const hand = [];
  for (let i = 0; i < n; i++) hand.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return hand;
}

// この手札で出すアタックの順番（同レベル→1つ上→出せなければLv1）
function planAttacks(hand, chain) {
  const rest = hand.filter(c => c.type === 'attack');
  const order = [];
  for (;;) {
    let i = rest.findIndex(c => c.lv === chain);
    if (i < 0) i = rest.findIndex(c => c.lv === chain + 1);
    if (i < 0) i = rest.findIndex(c => c.lv === 1);
    if (i < 0) break;
    const c = rest.splice(i, 1)[0];
    order.push(c); chain = c.lv;
  }
  return order;
}

// spellPolicy: 'first' = 来たらすぐ出す / 'match' = その手札で一番強いアタックの直前に出す
function battle(deck, { duration, skill, spellPolicy }) {
  let pool = deck.slice(), prev = [];
  let t = 0, chain = 0, lastPlay = -Infinity, lastSkip = false, first = true;
  let buff = { double: 0, drain: 0, aoe: 0 };
  const s = { lv4seen: 0, lv4: 0, hands: 0, deadlock: 0, skips: 0, played: 0, full: 0, dmg: 0, heal: 0, dblOn: 0, dblN: 0, drainN: 0, aoeOn: 0, aoeN: 0, breaks: 0 };

  while (t < duration) {
    const hand = drawHand(pool, R.handSize);
    pool.push(...prev); prev = hand.slice();
    s.hands++; t += skill.read;
    if (chain > 0 && t + skill.play - lastPlay > R.chainTimerSec) { chain = 0; s.breaks++; }
    if (!first && chain > 0 && lastSkip) chain--;
    first = false;
    s.lv4seen += hand.filter(c => c.lv === 4).length;

    const attacks = planAttacks(hand, chain);
    const spells = hand.filter(c => c.type === 'spell');
    if (attacks.length + spells.length === 0) s.deadlock++;
    let seq;
    if (spellPolicy === 'first' || attacks.length === 0) seq = [...spells, ...attacks];
    else {
      const best = attacks.reduce((bi, c, i) => (c.power > attacks[bi].power ? i : bi), 0);
      seq = [...attacks.slice(0, best), ...spells, ...attacks.slice(best)];
    }

    let used = 0;
    for (const c of seq) {
      if (t >= duration) break;
      t += skill.play; lastPlay = t; s.played++; used++;
      if (c.type === 'spell') { if (c.effect in buff) buff[c.effect]++; continue; }
      chain = c.lv;
      const dmg = c.power * 2 ** buff.double;
      s.dmg += dmg;
      if (buff.double) { s.dblOn += c.power; s.dblN++; }
      if (buff.aoe) { s.aoeOn += dmg; s.aoeN++; }
      if (buff.drain) { s.heal += dmg; s.drainN++; }
      if (c.lv === 4) s.lv4++;
      buff = { double: 0, drain: 0, aoe: 0 };
    }
    if (used === hand.length) { s.full++; t += R.fullConsumeChargeSec; lastSkip = false; }
    else { s.skips++; t += skill.skip + R.chargeSec; lastSkip = true; }
  }
  return s;
}

function run(deck, opts, n = 20000) {
  const a = {};
  let any = 0;
  for (let i = 0; i < n; i++) {
    const s = battle(deck, opts);
    if (s.lv4 > 0) any++;
    for (const k in s) a[k] = (a[k] ?? 0) + s[k];
  }
  const f = (x, d = 1) => x.toFixed(d);
  return {
    'Lv4来た': f(a.lv4seen / n, 2), 'Lv4発動': f(a.lv4 / n, 2), '発動率%': f(100 * a.lv4 / a.lv4seen, 0), 'Lv4出た戦闘%': f(100 * any / n, 0),
    '使用枚数': f(a.played / n), 'スキップ': f(a.skips / n), '使い切り%': f(100 * a.full / a.hands, 0), '手詰まり%': f(100 * a.deadlock / a.hands),
    '与ダメ': f(a.dmg / n), '回復': f(a.heal / n), '2倍が乗った威力': f(a.dblOn / a.dblN, 2), '吸収1回の回復': f(a.heal / a.drainN, 2), '全体化1回の威力': f(a.aoeOn / a.aoeN, 2),
  };
}

const table = (title, rows) => { console.log('\n## ' + title); console.table(rows); };

for (const duration of [45, 150]) {
  const rows = {};
  for (const [name, skill] of Object.entries(SKILLS))
    for (const [label, spellPolicy] of [['スペル即使用', 'first'], ['スペルを合わせる', 'match']])
      rows[`${name}/${label}`] = run(buildDeck(), { duration, skill, spellPolicy });
  table(`新デッキ(アタック11/7/4/2 + スペル6) ${duration}秒戦`, rows);
}

{
  const rows = {};
  const base = { duration: 45, skill: SKILLS['普通'], spellPolicy: 'match' };
  rows['スペルなし(アタック24枚のみ)'] = run(buildDeck({ aoe: 0, drain: 0, tbd: 0, double: 0 }), base);
  rows['基準(スペル6)'] = run(buildDeck(), base);
  rows['Lv4を1枚(Lv1を12枚)'] = run(buildDeck({ atk1: 12, atk4: 1 }), base);
  rows['Lv4を3枚(Lv1を10枚)'] = run(buildDeck({ atk1: 10, atk4: 3 }), base);
  table('比較 普通・スペルを合わせる 45秒戦', rows);
}
