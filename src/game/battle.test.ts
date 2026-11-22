import { describe, expect, it } from 'vitest';
import data from '../../data/cards.json';
import { Battle, type Card, type CardDef, type EnemyDef, type Gear, type ItemDef, type Rules } from './battle';

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
const ALL = defs.reduce((n, d) => n + d.copies, 0);   // テストでは全種類のカードを山札に入れている
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
    expect(b.chain).toBe(0);                           // Sを出すとチェインはなくなる
    expect(b.stats.damage).toBe(1 + 2 + 3 + 10 + 1);   // 4枚目がアタックなので使い切りボーナス+1
    expect(b.stats.fullConsumes).toBe(1);
  });

  it('Sを出すとチェインがなくなり、次はCからになる（Sの連続も不可）', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atkS', 'atkS', 'atk3', 'atk1']);
    b.chain = 3; b.chainTimer = 3;
    expect(b.press(0)).toBe('played'); wait(b, 0.2);
    expect(b.chain).toBe(0);
    expect(b.press(1)).toBe('miss'); wait(b, 0.4);   // Sは続けて出せない
    expect(b.press(2)).toBe('miss'); wait(b, 0.4);   // Aにも戻れない
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
  it('ダブルは次のアタック1枚だけ2回当てる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['double', 'atk1', 'atk1', 'atk2']);
    b.press(0); wait(b, 0.2);
    expect(b.chain).toBe(0);                    // スペルはチェインを変えない
    b.events.length = 0;
    b.press(1);
    const hits = b.events.filter(e => e.kind === 'hit');
    expect(hits.length).toBe(2);                // ヒットは2回分（音と表示も2回になる）
    expect(hits.map(h => h.kind === 'hit' && h.damage)).toEqual([1, 1]);
    expect(b.chain).toBe(1);                    // チェインの動きは1枚分
    wait(b, 0.2);
    b.press(2);
    expect(b.stats.damage).toBe(2 + 1);
  });

  it('レベルXは次のアタックのレベルを無視し、チェインはそのレベルになる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['levelx', 'atkS', 'atkS', 'atk2']);
    b.press(0); wait(b, 0.2);
    expect(b.press(1)).toBe('played'); wait(b, 0.2);
    expect(b.chain).toBe(0);
    expect(b.press(2)).toBe('miss'); wait(b, 0.4);   // 効果は1枚で切れる
    expect(b.press(3)).toBe('miss');
  });

  it('ダブルとレベルXは重ねがけできる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['levelx', 'double', 'atkS', 'atk1']);
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
    expect(total(b)).toBe(ALL);
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
    expect(b.chargeTotal).toBeCloseTo(0.5);     // キープを残した使い切りは0.5秒
    expect(b.stats.damage).toBe(1 + 1 + 2);     // キープが残っているのでボーナスはない
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
    expect(total(b)).toBe(ALL);
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
    expect(total(b)).toBe(ALL);                 // デッキの枚数には影響しない
  });

  it('アイテムは誤入力の硬直中でも使える', () => {
    const b = new Battle(defs, rules, seeded(), [item('potion'), item('sand')]);
    setHand(b, ['atk2', 'atk1', 'atk1', 'atk1']);
    b.hp = 10;
    expect(b.press(0)).toBe('miss');
    expect(b.useItem(0)).toBe(true);
    expect(b.hp).toBe(30);
  });

  it('時の砂の効果中は入れ替えが10倍速で、スキップしてもチェインが下がらない', () => {
    const b = new Battle(defs, rules, seeded(), [item('sand'), item('flash')]);
    setHand(b, ['atk1', 'atk2', 'atkS', 'atkS']);
    b.useItem(0);
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2);
    expect(b.skip()).toBe(true);
    expect(b.chain).toBe(2);
    expect(b.chargeTotal).toBeCloseTo(0.1);
    wait(b, 0.12);
    expect(b.charging).toBe(false);
    expect(b.slots.every(s => s.card)).toBe(true);
    wait(b, 10);
    setHand(b, ['atk1', 'atk1', 'atk1', 'atk1']);
    b.chain = 2; b.chainTimer = 3;
    b.skip();
    expect(b.chain).toBe(1);
    expect(b.chargeTotal).toBeCloseTo(1);
  });

  it('補充待ちの間に時の砂を使うと、残りの待ち時間も10分の1になる', () => {
    const b = new Battle(defs, rules, seeded(), [item('sand')]);
    b.skip();
    expect(b.chargeLeft).toBeCloseTo(1);
    b.useItem(0);
    expect(b.chargeLeft).toBeCloseTo(0.1);
  });

  it('チェインの実はチェインをすぐAにする', () => {
    const b = new Battle(defs, rules, seeded(), [item('awake')]);
    setHand(b, ['atkS', 'atk1', 'atk1', 'atk1']);
    expect(b.canPlay(b.slots[0].card!)).toBe(false);
    b.useItem(0);
    expect(b.chain).toBe(3);
    expect(b.press(0)).toBe('played');
  });

  it('強化薬は10秒間アタックの威力を+1する。ダブルでは2回それぞれに乗る', () => {
    const b = new Battle(defs, rules, seeded(), [item('rage')]);
    setHand(b, ['double', 'atk1', 'atk1', 'atk1']);
    b.useItem(0);
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2);
    expect(b.stats.damage).toBe(4);            // (1+1) x 2
    b.press(2);
    expect(b.stats.damage).toBe(6);
    wait(b, 10);
    setHand(b, ['atk1', 'atk1', 'atk1', 'atk1']);
    b.press(0);
    expect(b.stats.damage).toBe(7);
  });

  it('アイテムは3つまで。L2で未使用のものを順に選び、R2で使うと次に移る', () => {
    const b = new Battle(defs, rules, seeded(), [item('potion'), null, item('rage')]);
    b.hp = 50;
    expect(b.selected).toBe(0);
    expect(b.cycleItem()).toBe(true);
    expect(b.selected).toBe(2);                // 空の枠は飛ばす
    b.cycleItem();
    expect(b.selected).toBe(0);
    expect(b.useSelected()).toBe(true);
    expect(b.hp).toBe(70);
    expect(b.selected).toBe(2);                // 使うと次の未使用へ
    expect(b.useSelected()).toBe(true);
    expect(b.useSelected()).toBe(false);       // もう残っていない
  });

  it('最大ダメージは、手札が配られてから次に配られるまでの合計で数える', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk1', 'atk2', 'atk3', 'atkS']);
    for (let i = 0; i < 4; i++) { b.press(i); wait(b, 0.2); }
    expect(b.stats.maxTurn).toBe(17);          // 16 + 使い切りボーナス1
    expect(b.chargeTotal).toBeCloseTo(0.5);
    wait(b, 0.6);
    setHand(b, ['atk1', 'atk1', 'atk1', 'atk1']);
    b.press(0);
    expect(b.turnDamage).toBe(1);
    expect(b.stats.maxTurn).toBe(17);
  });

});

describe('1つ下のレベル', () => {
  it('AのときにBを出せて、チェインはBに戻る', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk2', 'atk3', 'atkS', 'atk1']);
    b.chain = 3; b.chainTimer = 4;
    expect(b.press(0)).toBe('played'); wait(b, 0.2);
    expect(b.chain).toBe(2);
    expect(b.press(2)).toBe('miss'); wait(b, 0.4);     // BからSは出せない
    expect(b.press(1)).toBe('played'); wait(b, 0.2);   // A
    expect(b.press(2)).toBe('played');                 // S
    expect(b.chain).toBe(0);
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
    wait(b, 0.4);
    expect(b.charging).toBe(true);
    wait(b, 0.2);                              // 手詰まりから合計1.0秒ほどで配り直される
    expect(b.charging).toBe(false);
  });

  it('出せるカードが1枚でもあれば入れ替わらない。キープしたカードは残る', () => {
    const b = new Battle(defs, realRules, seeded());
    setHand(b, ['atkS', 'atk3', 'atk3', 'double']);
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
    setHand(win, ['levelx', 'double', 'atkS', 'atk1']);
    win.press(0); wait(win, 0.2); win.press(1); wait(win, 0.2); win.press(2);
    expect(win.result).toBe('won');
    expect(win.press(3)).toBe('ignored');

    const lose = new Battle(defs, rules, seeded(), [], { ...enemy, actions: [{ name: 'x', chargeSec: 1, damage: 60 }] });
    wait(lose, 2.1);
    expect(lose.result).toBe('lost');
    expect(lose.hp).toBe(0);
  });

  it('無敵中は敵の攻撃でHPが減らない。解除すると減る', () => {
    const b = new Battle(defs, rules, seeded(), [], enemy);
    b.invincible = true;
    wait(b, 5.1);
    expect(b.hp).toBe(100);
    b.invincible = false;
    wait(b, 2.0);
    expect(b.hp).toBe(93);
  });

  it('標準の敵データが読める', () => {
    const b = new Battle(defs, realRules, seeded(), [], golem);
    expect(b.enemy!.hp).toBe(golem.hp);
    expect(b.enemyAction!.name).toBe(golem.actions[0].name);
  });

  it('無敵を使った戦闘は、使ったことが記録される', () => {
    const b = new Battle(defs, rules, seeded(), [], enemy);
    wait(b, 0.1);
    expect(b.usedInvincible).toBe(false);
    b.invincible = true; wait(b, 0.1); b.invincible = false; wait(b, 0.1);
    expect(b.usedInvincible).toBe(true);
  });
});

describe('使い切りボーナス', () => {
  it('4枚目がスペルならボーナスはない。ダブルでも足すのは1回だけ', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['atk1', 'atk1', 'atk1', 'double']);
    for (let i = 0; i < 4; i++) { b.press(i); wait(b, 0.2); }
    expect(b.stats.damage).toBe(3);
    const c = new Battle(defs, rules, seeded());
    setHand(c, ['atk1', 'atk1', 'double', 'atk1']);
    for (let i = 0; i < 4; i++) { c.press(i); wait(c, 0.2); }
    expect(c.stats.damage).toBe(1 + 1 + 2 + 1);
  });
});

describe('追加のスペル', () => {
  it('ドレインは、次のアタックで与えたダメージと同じだけ回復する（ダブルなら2回分）', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['drain', 'double', 'atk1', 'atk2']);
    b.hp = 50;
    b.press(0); wait(b, 0.2); b.press(1); wait(b, 0.2); b.press(2); wait(b, 0.2);
    expect(b.hp).toBe(52);
    b.press(3);
    expect(b.hp).toBe(52);                     // 効果は1枚で切れる
  });

  it('ランクアップは、次のアタックを1段上として扱う。出せるかどうかは元のレベルで決まる', () => {
    const b = new Battle(defs, rules, seeded());
    setHand(b, ['rankup', 'atk3', 'atk1', 'atk1']);
    b.press(0); wait(b, 0.2);
    expect(b.press(1)).toBe('miss'); wait(b, 0.4);     // チェインなしでAは出せないまま
    expect(b.press(2)).toBe('played'); wait(b, 0.2);   // C が B 扱いになる
    expect(b.stats.damage).toBe(2);
    expect(b.chain).toBe(2);
    const c = new Battle(defs, rules, seeded());
    setHand(c, ['rankup', 'atk3', 'atkS', 'atk1']);
    c.chain = 2; c.chainTimer = 4;
    c.press(0); wait(c, 0.2);
    expect(c.press(1)).toBe('played');                 // A が S 扱い: 威力10、チェインはリセット
    expect(c.stats.damage).toBe(10);
    expect(c.chain).toBe(0);
    expect(c.stats.sCount).toBe(1);
  });
});

describe('装備', () => {
  const gear = (g: Gear) => new Battle(defs, rules, seeded(), [], { id: 't', name: 't', hp: 999, actions: [{ name: 'a', chargeSec: 2, damage: 7 }, { name: 'b', chargeSec: 2, damage: 2 }] }, g);

  it('武器でレベルごとの威力が変わる', () => {
    const b = gear({ power: [2, 3, 4, 20] });
    setHand(b, ['atk1', 'atk2', 'atk3', 'atkS']);
    for (let i = 0; i < 4; i++) { b.press(i); wait(b, 0.2); }
    expect(b.stats.damage).toBe(29 + 1);
  });

  it('斧は、アタックを出すたびに0.5秒待つ。スペルの後は待たない', () => {
    const b = gear({ attackWaitSec: 0.5 });
    setHand(b, ['atk1', 'atk1', 'double', 'atk1']);
    b.press(0); wait(b, 0.3);
    expect(b.press(1)).toBe('ignored');
    wait(b, 0.25);
    expect(b.press(1)).toBe('played'); wait(b, 0.55);
    b.press(2); wait(b, 0.15);
    expect(b.press(3)).toBe('played');
  });

  it('入れ替え時間の増減は、スキップにも使い切りにもかかる（0秒より短くはならない）', () => {
    const bow = gear({ chargeMod: -0.5 });
    bow.skip();
    expect(bow.chargeTotal).toBeCloseTo(0.5);
    wait(bow, 0.6);
    setHand(bow, ['atk1', 'atk1', 'atk1', 'atk1']);
    for (let i = 0; i < 4; i++) { bow.press(i); wait(bow, 0.2); }
    expect(bow.charging).toBe(false);          // 0.5 - 0.5 → 0秒: すぐ配られる
    const iron = gear({ chargeMod: 0.5 });
    iron.skip();
    expect(iron.chargeTotal).toBeCloseTo(1.5);
  });

  it('防具は受けるダメージを減らす。最低でも1は受ける', () => {
    const b = gear({ def: 3 });
    wait(b, 2.05); expect(b.hp).toBe(96);
    wait(b, 2.0); expect(b.hp).toBe(95);
  });
});

describe('ダンジョン向けの引き継ぎと仕掛け', () => {
  it('HP・最大HP・アイテムの使用状況を引き継いで始められる', () => {
    const b = new Battle(defs, rules, seeded(), [item('potion'), item('flash'), item('rage')], null, {}, { hp: 95, maxHp: 110, used: [true, false, false] });
    expect(b.hp).toBe(95);
    expect(b.items[0]!.used).toBe(true);
    expect(b.selected).toBe(1);                 // 使える物が最初に選ばれている
    expect(b.useItem(0)).toBe(false);
    b.items[0]!.used = false; b.useItem(0);
    expect(b.hp).toBe(110);                     // 回復の上限は引き継いだ最大HP
  });

  it('やけど: 時間でHPが減る。敵がスタンしていても進み、これで倒れることもある', () => {
    const enemy: EnemyDef = { id: 'b', name: 'b', hp: 99, burn: { everySec: 2, damage: 1 }, actions: [{ name: 'x', chargeSec: 99, damage: 1 }] };
    const b = new Battle(defs, rules, seeded(), [item('flash')], enemy, {}, { hp: 3 });
    b.useItem(0);
    wait(b, 2.05); expect(b.hp).toBe(2);
    wait(b, 4.0);
    expect(b.result).toBe('lost');
  });

  it('技のやけど: 当たるとやけどになり、3秒ごとに −1。重ねない', () => {
    const enemy: EnemyDef = { id: 'b', name: 'b', hp: 99, actions: [{ name: 'x', chargeSec: 1, damage: 2 }, { name: '火炎', chargeSec: 1, damage: 5, burn: true }] };
    const b = new Battle(defs, rules, seeded(), [], enemy, {}, { hp: 50 });
    wait(b, 1.05);
    expect(b.burning).toBeNull();                    // やけどの付かない技
    wait(b, 1.0);
    expect(b.hp).toBe(43);
    expect(b.burning).toEqual({ everySec: 3, damage: 1 });
    const hp = b.hp;
    b.enemy!.def.actions[0].damage = 0.0001;         // 次の通常攻撃は最低1
    b.events.length = 0;
    wait(b, 3.0);                                    // 3秒: 通常攻撃 −1 ×2、火炎 −5（2回目もやけどは重ならない）、やけど −1 ×1
    expect(b.burning).toEqual({ everySec: 3, damage: 1 });
    expect(b.events.filter(e => e.kind === 'burn').length).toBe(1);
    expect(hp - b.hp).toBe(1 + 5 + 1 + 1);
  });

  it('技のやけど: 無敵のときは付かない', () => {
    const enemy: EnemyDef = { id: 'b', name: 'b', hp: 99, actions: [{ name: '火炎', chargeSec: 1, damage: 5, burn: true }] };
    const b = new Battle(defs, rules, seeded(), [], enemy, {}, { hp: 50 });
    b.invincible = true;
    wait(b, 1.05);
    expect(b.burning).toBeNull();
  });

  it('アクセサリで、使い切りボーナスが置き換わる', () => {
    const b = new Battle(defs, rules, seeded(), [], null, { consumeBonus: 3 });
    setHand(b, ['atk1', 'atk1', 'atk1', 'atk1']);
    for (let i = 0; i < 4; i++) { b.press(i); wait(b, 0.2); }
    expect(b.stats.damage).toBe(4 + 3);
  });
});

it('デッキはアタック28枚（固定）とスペル2枚で30枚になる', () => {
  expect(def('atk1').copies + def('atk2').copies + def('atk3').copies + def('atkS').copies).toBe(28);
  expect(defs.filter(d => d.type === 'spell').map(d => d.id)).toEqual(['double', 'levelx', 'drain', 'rankup']);
  expect(28 + (data.rules.maxSpells as number)).toBe(30);
});
