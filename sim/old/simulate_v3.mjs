// デッキ回転シミュレーション v3（アタック24 + スペル3 + アイテム3）
// 使い方: node sim/simulate.mjs
// ルール: アタックは同レベルか1つ上、またはLv1（S=Lv4扱い、Sの後もSは続けて出せる）。
//         スペルとアイテムはいつでも出せる。スペルは次のアタック1枚に乗る（重ねがけ可・手札をまたぐ）。
//         スキップでチェイン-1。使ったカードも山札に戻る（アイテムも繰り返し来る）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '../data/cards.json'), 'utf8'));
const R = data.rules;
const SKILLS = { '普通': { play: 0.5, read: 0.3, skip: 0.3 }, '上級': { play: 0.3, read: 0.15, skip: 0.2 } };

function buildDeck(counts) {
  const deck = [];
  for (const c of data.cards) for (let i = 0; i < (counts?.[c.id] ?? c.copies); i++) deck.push(c);
  return deck;
}
function drawHand(pool, n) {
  const hand = [];
  for (let i = 0; i < n; i++) hand.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return hand;
}
function greedy(rest, chain) {
  const order = [];
  for (;;) {
    let i = rest.findIndex(c => c.lv === chain);
    if (i < 0) i = rest.findIndex(c => c.lv === chain + 1);
    if (i < 0) i = rest.findIndex(c => c.lv === 1);
    if (i < 0) break;
    const c = rest.splice(i, 1)[0]; order.push(c); chain = c.lv;
  }
  return [order, chain];
}

// fish: true = レベルXを出したら、Sが来るまでアタックを出さずにスキップで探す
function battle(deck, { duration, skill, fish = false, oneShotItems = false }) {
  let pool = deck.slice(), prev = [];
  let t = 0, chain = 0, lastPlay = -Infinity, lastSkip = false, first = true, sandUntil = -1;
  let buff = { power: 0, area: 0, levelx: 0 };
  const s = { sSeen: 0, sCast: 0, hands: 0, skips: 0, played: 0, full: 0, dmg: 0, sDmg: 0, heal: 0, flash: 0, sand: 0, sandCards: 0, pwOn: 0, pwN: 0, pwS: 0, xN: 0, xS: 0, arOn: 0, arN: 0 };

  while (t < duration) {
    const hand = drawHand(pool, Math.min(R.handSize, pool.length));
    pool.push(...prev); prev = hand.slice();
    s.hands++; t += skill.read;
    if (chain > 0 && t + skill.play - lastPlay > R.chainTimerSec) chain = 0;
    if (!first && chain > 0 && lastSkip) chain--;
    first = false;
    s.sSeen += hand.filter(c => c.lv === 4).length;

    const items = hand.filter(c => c.type === 'item');
    const spells = hand.filter(c => c.type === 'spell');
    const atk = hand.filter(c => c.type === 'attack');
    const hasX = buff.levelx > 0 || spells.some(c => c.effect === 'levelx');
    let seq;
    if (fish && hasX && !atk.some(c => c.lv === 4)) {
      seq = [...items, ...spells];                       // Sが来るまでアタックを出さない
    } else if (hasX) {
      // レベルXの対象は一番強いアタック。それを最初に飛ばして出すか、通常の流れで出せるならそのまま
      const [plan] = greedy(atk.slice(), chain);
      const target = atk.reduce((b, c) => (!b || c.power > b.power ? c : b), null);
      if (target && !plan.includes(target)) {
        const others = atk.filter(c => c !== target);
        const [before, ch] = greedy(others.slice(), chain);
        void ch;
        const [after] = greedy(others.filter(c => !before.includes(c)), target.lv);
        seq = [...items, ...before, ...spells, target, ...after];
      } else if (target) {
        const i = plan.indexOf(target);
        seq = [...items, ...plan.slice(0, i), ...spells, ...plan.slice(i)];
      } else seq = [...items, ...spells];
    } else {
      const [plan] = greedy(atk.slice(), chain);
      if (plan.length) {
        const i = plan.reduce((bi, c, k) => (c.power > plan[bi].power ? k : bi), 0);
        seq = [...items, ...plan.slice(0, i), ...spells, ...plan.slice(i)];
      } else seq = [...items, ...spells];
    }

    let used = 0;
    for (const c of seq) {
      if (t >= duration) break;
      t += skill.play; lastPlay = t; s.played++; used++;
      if (t < sandUntil) s.sandCards++;
      if (c.type === 'item') {
        if (c.effect === 'heal') s.heal += c.value;
        if (c.effect === 'flash') s.flash++;
        if (c.effect === 'sand') { s.sand++; sandUntil = t + c.durationSec; }
        if (oneShotItems) { const k = prev.indexOf(c); if (k >= 0) prev.splice(k, 1); }
        continue;
      }
      if (c.type === 'spell') { buff[c.effect]++; continue; }
      chain = c.lv;
      const dmg = c.power * 2 ** buff.power;
      s.dmg += dmg;
      if (c.lv === 4) { s.sCast++; s.sDmg += dmg; }
      if (buff.power) { s.pwOn += c.power; s.pwN++; if (c.lv === 4) s.pwS++; }
      if (buff.levelx) { s.xN++; if (c.lv === 4) s.xS++; }
      if (buff.area) { s.arOn += dmg; s.arN++; }
      buff = { power: 0, area: 0, levelx: 0 };
    }
    const sand = t < sandUntil;
    if (used === hand.length) { s.full++; t += sand ? 0 : R.fullConsumeChargeSec; lastSkip = false; }
    else { s.skips++; t += skill.skip + (sand ? 0 : R.chargeSec); lastSkip = true; }
  }
  return s;
}

function run(deck, opts, n = 20000) {
  const a = {}; let any = 0;
  for (let i = 0; i < n; i++) { const s = battle(deck, opts); if (s.sCast) any++; for (const k in s) a[k] = (a[k] ?? 0) + s[k]; }
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  return {
    'S来た': f(a.sSeen / n, 2), 'S発動': f(a.sCast / n, 2), 'S出た戦闘%': f(100 * any / n, 0),
    '与ダメ': f(a.dmg / n), 'うちS%': f(100 * a.sDmg / a.dmg, 0), '使用枚数': f(a.played / n), 'スキップ': f(a.skips / n),
    'パワー回数': f(a.pwN / n, 2), 'パワーが乗った威力': f(a.pwOn / a.pwN, 2), 'パワーがSに%': f(100 * a.pwS / a.pwN, 0),
    'レベルX回数': f(a.xN / n, 2), 'レベルXがSに%': f(100 * a.xS / a.xN, 0),
    '回復薬回数': f(a.heal / 20 / n, 2), '回復量': f(a.heal / n), '閃光弾回数': f(a.flash / n, 2), '星の砂回数': f(a.sand / n, 2),
  };
}
const table = (title, rows) => { console.log('\n## ' + title); console.table(rows); };

for (const duration of [45, 150]) {
  const rows = {};
  for (const [name, skill] of Object.entries(SKILLS)) {
    rows[`${name}/来たら使う`] = run(buildDeck(), { duration, skill });
    rows[`${name}/レベルXでSを待つ`] = run(buildDeck(), { duration, skill, fish: true });
  }
  table(`新デッキ ${duration}秒戦（アイテムは繰り返し来る）`, rows);
}
{
  const rows = {}, o = { duration: 45, skill: SKILLS['普通'] };
  rows['基準'] = run(buildDeck(), o);
  rows['星の砂なし(Lv1を12枚)'] = run(buildDeck({ sand: 0, atk1: 12 }), o);
  rows['レベルXなし(Lv1を12枚)'] = run(buildDeck({ levelx: 0, atk1: 12 }), o);
  rows['アイテムは1戦1回'] = run(buildDeck(), { ...o, oneShotItems: true });
  rows['アイテムは1戦1回・150秒'] = run(buildDeck(), { ...o, duration: 150, oneShotItems: true });
  table('比較 普通・来たら使う', rows);
}
