// デッキ回転シミュレーション（Step 1）
// 使い方: node sim/simulate.mjs
// カードの特殊効果（バフ・デバフ）は無視し、レベル順ルールと時間だけを再現する。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '../data/cards.json'), 'utf8'));

// プレイヤーの腕前（秒）: play=1枚出すのにかかる時間, read=新しい手札を読む時間, skip=スキップを決める時間
const SKILLS = {
  '普通': { play: 0.5, read: 0.3, skip: 0.3 },
  '上級': { play: 0.3, read: 0.15, skip: 0.2 },
};

function starterDeck() {
  const deck = [];
  for (const c of data.cards) {
    const dmg = c.type === 'attack' ? c.atk * c.hits * (c.hit / 100) : 0;
    for (let i = 0; i < c.copies; i++) deck.push({ lv: c.lv, dmg });
  }
  return deck;
}

// レベル枚数だけ指定したデッキ（ダメージは見ない）
function levelDeck([a, b, c, d]) {
  const deck = [];
  [a, b, c, d].forEach((n, i) => { for (let k = 0; k < n; k++) deck.push({ lv: i + 1, dmg: 0 }); });
  return deck;
}

function drawHand(pool, n) {
  const hand = [];
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * pool.length);
    hand.push(pool.splice(j, 1)[0]);
  }
  return hand;
}

// policy: 'hold' = チェインが2以上ならスキップで次のレベルを探す / 'reset' = 出せなければすぐLv1に戻る
function battle(deck, { duration, timer, charge, fullCharge, skill, policy, decay = 'none', holdMin = 2 }) {
  let pool = deck.slice();
  let prev = [];            // 直前の手札（次の手札が揃ったら山札に戻る）
  let t = 0, chain = 0, lastPlay = -Infinity;
  let lastSkip = false, first = true;
  const s = { lv4seen: 0, lv4: 0, firstLv4: null, hands: 0, deadlock: 0, skips: 0, breaks: 0, played: 0, full: 0, dmg: 0 };

  const expire = (at) => {
    if (chain > 0 && at - lastPlay > timer) { chain = 0; s.breaks++; }
  };

  while (t < duration) {
    const hand = drawHand(pool, data.rules.handSize);
    pool.push(...prev);
    prev = hand.slice();
    s.hands++;
    t += skill.read;

    expire(t);
    // ドロー時のチェイン減少: always=毎回 / skipOnly=スキップしたときだけ
    if (!first && chain > 0 && (decay === 'always' || (decay === 'skipOnly' && lastSkip))) chain--;
    first = false;
    s.lv4seen += hand.filter(c => c.lv === 4).length;
    const playableNow = hand.some(c => c.lv === chain || c.lv === chain + 1 || c.lv === 1);
    if (!playableNow) s.deadlock++;

    let consumed = 0;
    while (t < duration) {
      const at = t + skill.play;
      expire(at);
      // 同レベルを先に出し切ってから1つ上へ
      let idx = hand.findIndex(c => c.lv === chain);
      if (idx < 0) idx = hand.findIndex(c => c.lv === chain + 1);
      if (idx < 0) {
        const lv1 = hand.findIndex(c => c.lv === 1);
        if (lv1 >= 0) {
          const skipCost = skill.skip + charge + skill.read + skill.play;
          const canHold = policy === 'hold' && chain >= holdMin && (t + skipCost - lastPlay) <= timer;
          if (!canHold) idx = lv1;
        }
      }
      if (idx < 0) break; // スキップ
      const card = hand.splice(idx, 1)[0];
      t = at;
      chain = card.lv === 4 ? 0 : card.lv;
      lastPlay = t;
      s.played++; s.dmg += card.dmg; consumed++;
      if (card.lv === 4) { s.lv4++; if (s.firstLv4 === null) s.firstLv4 = t; }
      if (hand.length === 0) break;
    }

    if (hand.length === 0) { s.full++; t += fullCharge; lastSkip = false; }
    else { s.skips++; t += skill.skip + charge; lastSkip = true; }
    void consumed;
  }
  return s;
}

function run(deck, opts, n = 20000) {
  const acc = { lv4seen: 0, lv4: 0, any: 0, first: [], hands: 0, deadlock: 0, skips: 0, breaks: 0, played: 0, full: 0, dmg: 0 };
  for (let i = 0; i < n; i++) {
    const s = battle(deck, opts);
    acc.lv4seen += s.lv4seen; acc.lv4 += s.lv4; if (s.lv4 > 0) acc.any++;
    if (s.firstLv4 !== null) acc.first.push(s.firstLv4);
    for (const k of ['hands', 'deadlock', 'skips', 'breaks', 'played', 'full', 'dmg']) acc[k] += s[k];
  }
  acc.first.sort((a, b) => a - b);
  return {
    'Lv4来た/戦': (acc.lv4seen / n).toFixed(2),
    'Lv4回数/戦': (acc.lv4 / n).toFixed(2),
    '発動率%': acc.lv4seen ? (100 * acc.lv4 / acc.lv4seen).toFixed(0) : '-',
    'Lv4が出た戦闘%': (100 * acc.any / n).toFixed(0),
    '初Lv4中央値(秒)': acc.first.length ? acc.first[Math.floor(acc.first.length / 2)].toFixed(0) : '-',
    '使用枚数/戦': (acc.played / n).toFixed(1),
    'スキップ/戦': (acc.skips / n).toFixed(1),
    '手詰まり手札%': (100 * acc.deadlock / acc.hands).toFixed(1),
    '使い切り手札%': (100 * acc.full / acc.hands).toFixed(1),
    'チェイン切れ/戦': (acc.breaks / n).toFixed(2),
    '与ダメ/戦': (acc.dmg / n).toFixed(0),
  };
}

const R = data.rules;
const base = { duration: 45, timer: R.chainTimerSec, charge: R.chargeSec, fullCharge: R.fullConsumeChargeSec, skill: SKILLS['普通'], policy: 'hold' };
const table = (title, rows) => { console.log('\n## ' + title); console.table(rows); };

// 1. 基準デッキ: 腕前 × 方針
{
  const rows = {};
  for (const [name, skill] of Object.entries(SKILLS))
    for (const policy of ['hold', 'reset'])
      rows[`${name}/${policy === 'hold' ? '粘る' : 'すぐ戻る'}`] = run(starterDeck(), { ...base, skill, policy });
  table('基準デッキ(12/10/6/2) 45秒戦', rows);
}

// 2. レベル配分の比較
{
  const rows = {};
  for (const comp of [[12, 10, 6, 2], [15, 9, 5, 1], [14, 8, 6, 2], [10, 10, 8, 2], [8, 10, 8, 4], [9, 9, 9, 3], [6, 8, 10, 6]])
    rows[comp.join('/')] = run(levelDeck(comp), base);
  table('レベル配分(Lv1/2/3/4) 普通・粘る 45秒戦', rows);
}

// 3. チェインタイマーの感度
{
  const rows = {};
  for (const timer of [2, 2.5, 3, 4, 5]) rows[`タイマー${timer}秒`] = run(starterDeck(), { ...base, timer });
  table('チェインタイマー 基準デッキ 普通・粘る 45秒戦', rows);
}

// 4. チャージ時間の感度
{
  const rows = {};
  for (const charge of [0.5, 0.75, 1, 1.5]) rows[`チャージ${charge}秒`] = run(starterDeck(), { ...base, charge });
  table('チャージ時間 基準デッキ 普通・粘る 45秒戦', rows);
}

// 5. ボス戦の長さ
table('基準デッキ 普通・粘る 150秒戦', { '150秒': run(starterDeck(), { ...base, duration: 150 }) });

// 6. Lv4を「1戦に1〜2回」へ寄せる調整案
{
  const rows = {};
  for (const comp of [[12, 10, 7, 1], [13, 10, 6, 1], [12, 10, 6, 2]])
    for (const timer of [2, 3])
      rows[`${comp.join('/')} タイマー${timer}秒`] = run(levelDeck(comp), { ...base, timer });
  table('調整案 普通・粘る 45秒戦', rows);
  const rows2 = {};
  for (const [name, skill] of Object.entries(SKILLS))
    for (const policy of ['hold', 'reset'])
      rows2[`${name}/${policy === 'hold' ? '粘る' : 'すぐ戻る'}`] = run(levelDeck([12, 10, 7, 1]), { ...base, skill, policy });
  table('12/10/7/1 タイマー3秒 腕前×方針 45秒戦', rows2);
}

// 7. ドロー時にチェインが1段階減る案
{
  const pick = r => ({ 'Lv4来た': r['Lv4来た/戦'], 'Lv4発動': r['Lv4回数/戦'], '発動率%': r['発動率%'], 'Lv4出た戦闘%': r['Lv4が出た戦闘%'], '使用枚数': r['使用枚数/戦'], 'スキップ': r['スキップ/戦'], '手詰まり%': r['手詰まり手札%'], '使い切り%': r['使い切り手札%'], '与ダメ': r['与ダメ/戦'] });
  for (const [name, skill] of Object.entries(SKILLS)) {
    const rows = {};
    for (const [label, decay] of [['減少なし', 'none'], ['毎ドロー-1', 'always'], ['スキップ時のみ-1', 'skipOnly']])
      for (const [pl, policy, holdMin] of [['粘る(2以上)', 'hold', 2], ['粘る(3のみ)', 'hold', 3], ['すぐ戻る', 'reset', 2]])
        rows[`${label}/${pl}`] = pick(run(starterDeck(), { ...base, skill, policy, decay, holdMin }));
    table(`チェイン減少案 基準デッキ(12/10/6/2) ${name} 45秒戦`, rows);
  }
}

// 8. 減少案 × Lv4枚数
{
  const rows = {};
  for (const comp of [[12, 10, 6, 2], [12, 10, 7, 1]])
    for (const [label, decay] of [['毎ドロー-1', 'always'], ['スキップ時のみ-1', 'skipOnly']]) {
      const r = run(levelDeck(comp), { ...base, decay, policy: 'reset' });
      rows[`${comp.join('/')} ${label}`] = { 'Lv4来た': r['Lv4来た/戦'], 'Lv4発動': r['Lv4回数/戦'], '発動率%': r['発動率%'], 'Lv4出た戦闘%': r['Lv4が出た戦闘%'] };
    }
  table('減少案×Lv4枚数 普通・すぐ戻る 45秒戦', rows);
}
