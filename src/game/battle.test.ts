import { describe, expect, it } from 'vitest';
import data from '../../data/cards.json';
import { Battle, type Card, type CardDef, type EnemyDef, type ItemDef, type Rules } from './battle';

const realRules = data.rules as unknown as Rules;
// 既存のテストは自動入れ替えを止めた状態で確かめる（自動入れ替えは専用のテストで見る）
const rules: Rules = { ...realRules, autoSkipDelaySec: 1e9 };
const golem = (data.enemies as EnemyDef[])[0];
const defs = data.cards as CardDef[];
const def = (id: string) => defs.find(d => d.id === id)!;
const item = (id: string) => (data.items as ItemDef[]).find(d => d.id === id)!;

function seeded(seed = 1) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
/** 手札を指定のカードに差し替える（元の手札は山札に戻す） */
function setHand(b: Battle, ids: string[]) {
  for (const s of b.slots) { if (s.card) b.pool.push(s.card); s.card = null; s.kept = false; }
  ids.forEach((id, i) => {
    const k = b.pool.findIndex(c => c.id === id);
    b.slots[i].card = b.pool.splice(k, 1)[0];
  });
}
const total = (b: Battle) => b.pool.length + b.pending.length + b.slots.filter(s => s.card).length;
const wait = (b: Battle, sec: number) => { for (let t = 0; t < sec; t += 0.01) b.update(0.01); };

describe('レベル順', () => {
  it('C→B→A→Sの順でしか出せない。同レベルとCはいつでも出せる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk2', 'atk1', 'atk3', 'atkS']);
    expect(b.press(0)).toBe('miss');           // チェインなしでBは出せない
    wait(b, 0.4);
    expect(b.press(1)).toBe('played'); wait(b, 0.2);   // C
    expect(b.press(3)).toBe('miss'); wait(b, 0.4);     // CからSは出せない
    expect(b.press(0)).toBe('played'); wait(b, 0.2);   // B
    expect(b.press(2)).toBe('played'); wait(b, 0.2);   // A
    expect(b.press(3)).toBe('played');                 // S
    expect(b.chain).toBe(4);
    expect(b.stats.damage).toBe(1 + 2 + 3 + 10);
    expect(b.stats.fullConsumes).toBe(1);
  });

  it('Sの後もSは続けて出せる。それ以外はCから', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atkS', 'atkS', 'atk2', 'atk1']);
    b.chain = 3; b.chainTimer = 3;
    expect(b.press(0)).toBe('played'); wait(b, 0.2);
    expect(b.press(1)).toBe('played'); wait(b, 0.2);
    expect(b.press(2)).toBe('miss'); wait(b, 0.4);   // SからBへは戻れない
    expect(b.press(3)).toBe('played');
    expect(b.chain).toBe(1);
  });

  it('チェインタイマーが切れるとチェインがなくなる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk1', 'atk2', 'atk1', 'atk1']);
    b.press(0);
    wait(b, 3.9);
    expect(b.chain).toBe(1);
    wait(b, 0.2);
    expect(b.chain).toBe(0);
    expect(b.press(1)).toBe('miss');
  });
});

describe('スペル', () => {
  it('パワーは次のアタック1枚だけ2倍にする', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['power', 'atk1', 'atk1', 'atk2']);
    b.press(0); wait(b, 0.2);
    expect(b.chain).toBe(0);                    // スペルはチェインを変えない
    b.press(1); wait(b, 0.2);
    b.press(2);
    expect(b.stats.damage).toBe(2 + 1);
  });

  it('レベルXは次のアタックのレベルを無視し、チェインはそのレベルになる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['levelx', 'atkS', 'atkS', 'atk2']);
    b.press(0); wait(b, 0.2);
    expect(b.press(1)).toBe('played'); wait(b, 0.2);
    expect(b.chain).toBe(4);
    expect(b.press(3)).toBe('miss');            // 効果は1枚で切れる
  });

  it('パワーとレベルXは重ねがけできる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['levelx', 'power', 'atkS', 'atk1']);
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2); b.press(2);
    expect(b.stats.damage).toBe(20);
  });
});

describe('スキップとキープ', () => {
  it('スキップするとチェインが1段下がり、1秒後に補充される', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk1', 'atk2', 'atkS', 'atkS']);
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2);
    expect(b.skip()).toBe(true);
    expect(b.chain).toBe(1);
    expect(b.slots.filter(s => s.card).length).toBe(0);
    wait(b, 0.9); expect(b.charging).toBe(true);
    wait(b, 0.2); expect(b.charging).toBe(false);
    expect(b.slots.every(s => s.card)).toBe(true);
    expect(total(b)).toBe(30);
  });

  it('キープしたカードはスキップしても同じ場所に残る', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atkS', 'atk1', 'atk2', 'atk3']);
    const s = b.slots[0].card as Card;
    b.toggleKeep(0);
    b.skip(); wait(b, 1.1);
    expect(b.slots[0].card).toBe(s);
    expect(b.slots[0].kept).toBe(true);
    b.toggleKeep(0);
    expect(b.slots[0].kept).toBe(false);
  });

  it('キープ以外を使い切ると、チェインを下げずに補充される', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atkS', 'atk1', 'atk1', 'atk2']);
    b.toggleKeep(0);
    b.press(1); wait(b, 0.2); b.press(2); wait(b, 0.2); b.press(3);
    expect(b.charging).toBe(true);
    expect(b.chain).toBe(2);
    wait(b, 0.6);
    expect(b.charging).toBe(false);
    expect(b.chain).toBe(2);
    expect(b.slots[0].card!.id).toBe('atkS');
  });

  it('キープしたカードは補充の待ち時間中も出せる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk1', 'atk2', 'atk2', 'atk3']);
    b.toggleKeep(0);
    b.skip(); wait(b, 0.3);
    expect(b.press(0)).toBe('played');
    wait(b, 1);
    expect(b.slots.every(s => s.card)).toBe(true);
    expect(total(b)).toBe(30);
  });
});

describe('アイテム', () => {
  it('L2・R2にセットしたアイテムは1戦に1回ずつ使える。同じものを2つでもよい', () => {
    const b = new Battle(defs, rules, seeded(), [item('potion'), item('potion')]);
    b.hp = 50;
    expect(b.useItem(0)).toBe(true);
    expect(b.hp).toBe(70);
    expect(b.useItem(0)).toBe(false);
    expect(b.useItem(1)).toBe(true);
    expect(b.hp).toBe(90);
    expect(total(b)).toBe(30);                 // デッキの枚数には影響しない
  });

  it('アイテムは誤入力の硬直中でも使える', () => {
    const b = new Battle(defs, rules, seeded(), [item('potion'), item('sand')]);
    setHand(b, ['atk2', 'atk1', 'atk1', 'atk1']);
    b.hp = 10;
    expect(b.press(0)).toBe('miss');
    expect(b.useItem(0)).toBe(true);
    expect(b.hp).toBe(30);
  });

  it('星の砂の効果中は入れ替えが0秒で、スキップしてもチェインが下がらない', () => {
    const b = new Battle(defs, rules, seeded(), [item('sand'), item('flash')]);
    setHand(b, ['atk1', 'atk2', 'atkS', 'atkS']);
    b.useItem(0);
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2);
    expect(b.skip()).toBe(true);
    expect(b.chain).toBe(2);
    expect(b.charging).toBe(false);
    expect(b.slots.every(s => s.card)).toBe(true);
    wait(b, 10);
    b.chain = 2; b.chainTimer = 3;
    b.skip();
    expect(b.chain).toBe(1);
    expect(b.charging).toBe(true);
  });

  it('補充待ちの間に星の砂を使うと、その場で補充される', () => {
    const b = new Battle(defs, rules, seeded(), [item('sand')]);
    b.skip();
    expect(b.charging).toBe(true);
    b.useItem(0);
    expect(b.charging).toBe(false);
    expect(b.slots.every(s => s.card)).toBe(true);
  });
});

describe('1つ下のレベル', () => {
  it('AのときにBを出せて、チェインはBに戻る。SからはAに戻れる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk2', 'atk3', 'atkS', 'atk3']);
    b.chain = 3; b.chainTimer = 4;
    expect(b.press(0)).toBe('played'); wait(b, 0.2);
    expect(b.chain).toBe(2);
    expect(b.press(2)).toBe('miss'); wait(b, 0.4);     // BからSは出せない
    expect(b.press(1)).toBe('played'); wait(b, 0.2);   // A
    expect(b.press(2)).toBe('played'); wait(b, 0.2);   // S
    expect(b.press(3)).toBe('played');                 // SからA
    expect(b.chain).toBe(3);
  });
});

describe('自動入れ替え', () => {
  it('出せるカードが1枚もないと、少し待って自動で入れ替わる（チェインは1段下がる）', () => {
    const b = new Battle(defs, realRules, seeded());
    setHand(b, ['atkS', 'atkS', 'atk3', 'atk3']);
    b.chain = 1; b.chainTimer = 4;
    wait(b, 0.2);
    expect(b.stats.autoSkips).toBe(0);
    wait(b, 0.3);
    expect(b.stats.autoSkips).toBe(1);
    expect(b.chain).toBe(0);
    expect(b.charging).toBe(true);
  });

  it('出せるカードが1枚でもあれば入れ替わらない。キープしたカードは残る', () => {
    const b = new Battle(defs, realRules, seeded());
    setHand(b, ['atkS', 'atk3', 'atk3', 'power']);
    wait(b, 1);
    expect(b.stats.autoSkips).toBe(0);                 // スペルは出せる
    b.press(3); wait(b, 0.2);
    b.toggleKeep(0);
    wait(b, 0.5);
    expect(b.stats.autoSkips).toBe(1);
    expect(b.slots[0].card!.id).toBe('atkS');
    expect(b.slots[0].kept).toBe(true);
  });
});

describe('敵', () => {
  const enemy: EnemyDef = { id: 't', name: 't', hp: 12, actions: [{ name: 'a', chargeSec: 2, damage: 7 }, { name: 'b', chargeSec: 3, damage: 20, big: true }] };

  it('ゲージが溜まると攻撃し、行動を順番に繰り返す', () => {
    const b = new Battle(defs, rules, seeded(), [], enemy);
    wait(b, 2.05); expect(b.hp).toBe(93);
    wait(b, 3.0); expect(b.hp).toBe(73);
    wait(b, 2.0); expect(b.hp).toBe(66);
  });

  it('閃光弾は敵を止め、行動ゲージを0に戻す', () => {
    const b = new Battle(defs, rules, seeded(), [item('flash')], enemy);
    wait(b, 1.9);
    b.useItem(0);
    expect(b.enemy!.gauge).toBe(0);
    wait(b, 2.9); expect(b.hp).toBe(100);              // 1秒スタン + 2秒の溜め直し
    wait(b, 0.2); expect(b.hp).toBe(93);
  });

  it('敵のHPを0にすると勝ち、自分のHPが0になると負け', () => {
    const win = new Battle(defs, rules, seeded(), [], enemy);
    setHand(win, ['levelx', 'power', 'atkS', 'atk1']);
    win.press(0); wait(win, 0.2); win.press(1); wait(win, 0.2); win.press(2);
    expect(win.result).toBe('won');
    expect(win.press(3)).toBe('ignored');

    const lose = new Battle(defs, rules, seeded(), [], { ...enemy, actions: [{ name: 'x', chargeSec: 1, damage: 60 }] });
    wait(lose, 2.1);
    expect(lose.result).toBe('lost');
    expect(lose.hp).toBe(0);
  });

  it('標準の敵データが読める', () => {
    const b = new Battle(defs, realRules, seeded(), [], golem);
    expect(b.enemy!.hp).toBe(golem.hp);
    expect(b.enemyAction!.name).toBe(golem.actions[0].name);
  });
});

it('デッキは30枚で、内訳が設計どおり', () => {
  expect(defs.reduce((n, d) => n + d.copies, 0)).toBe(30);
  expect(def('atk1').copies + def('atk2').copies + def('atk3').copies + def('atkS').copies).toBe(28);
  expect(defs.some(d => d.effect === 'area')).toBe(false);
});
