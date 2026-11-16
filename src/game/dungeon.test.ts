import { describe, expect, it } from 'vitest';
import data from '../../data/dungeons.json';
import cards from '../../data/cards.json';
import { buildBoard, DungeonRun, type DungeonDef } from './dungeon';

const fire = (data.dungeons as unknown as DungeonDef[])[0];
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };     // 決まった順に値を返す乱数
const dice = (n: number) => (n - 0.5) / 6;                                          // その目が出る乱数
const run = (rng: () => number = Math.random, slots = [true, true, true]) => new DungeonRun(fire, 100, slots, rng);
/** n マス進める（分かれ道は pick 番目を選ぶ） */
function walk(r: DungeonRun, n: number, pick = 0) {
  r.state.steps = n;
  for (let guard = 0; guard < 50; guard++) {
    const res = r.step(r.options().length > 1 ? r.options()[pick] : undefined);
    if (res === 'landed') return;
  }
}

describe('盤面', () => {
  const board = buildBoard(fire);
  it('入口から始まり、どの道を選んでもボスに着く', () => {
    expect(board[0].kind).toBe('start');
    const boss = board.findIndex(s => s.kind === 'boss');
    for (const pick of [0, 1]) {
      let i = 0, n = 0;
      while (board[i].next.length && n++ < 200) i = board[i].next[Math.min(pick, board[i].next.length - 1)];
      expect(i).toBe(boss);
    }
  });
  it('分かれ道が3つ、中ボスとボスが1つずつある', () => {
    expect(board.filter(s => s.next.length > 1).length).toBe(3);
    expect(board.filter(s => s.kind === 'mid').length).toBe(1);
    expect(board.filter(s => s.kind === 'boss').length).toBe(1);
  });
  it('隣り合うマスは、縦か横に1マスだけ離れている（道は直線と直角）', () => {
    for (const s of board) for (const n of s.next) expect(Math.abs(board[n].x - s.x) + Math.abs(board[n].y - s.y)).toBe(1);
  });
  it('同じ場所に2つのマスはない', () => {
    expect(new Set(board.map(s => `${s.x},${s.y}`)).size).toBe(board.length);
  });
  it('ダンジョンの敵がデータにそろっている', () => {
    const ids = (cards.enemies as { id: string }[]).map(e => e.id);
    for (const id of [...fire.zako, fire.midBoss, fire.boss]) expect(ids).toContain(id);
  });
});

describe('進み方', () => {
  it('サイコロは1〜6。出た目だけ進んで止まる', () => {
    const r = run(seq(dice(4)));
    expect(r.roll()).toBe(4);
    expect(r.step()).toBe('moved'); expect(r.step()).toBe('moved'); expect(r.step()).toBe('moved'); expect(r.step()).toBe('landed');
    expect(r.state.pos).toBe(4);
  });
  it('分かれ道では行き先を選ぶまで進まない', () => {
    const r = run();
    const fork = r.board.findIndex(s => s.next.length > 1);
    r.state.pos = fork; r.state.steps = 2;
    expect(r.step()).toBe('choose');
    expect(r.state.pos).toBe(fork);
    expect(r.step(r.options()[1])).toBe('moved');
    expect(r.board[r.state.pos].seg).toBe('b1');
  });
  it('中ボスとボスのマスは、歩数が残っていても止まる', () => {
    const r = run();
    r.state.pos = r.midIndex - 2;
    walk(r, 6);
    expect(r.state.pos).toBe(r.midIndex);
    r.state.pos = r.bossIndex - 1;
    walk(r, 6);
    expect(r.state.pos).toBe(r.bossIndex);
  });
  it('討伐済みの中ボスのマスは通り過ぎる', () => {
    const r = run();
    r.state.midDone = true;
    r.state.pos = r.midIndex - 2;
    walk(r, 5);
    expect(r.state.pos).toBe(r.midIndex + 3);
  });
});

describe('マスの効果', () => {
  const at = (r: DungeonRun, kind: string) => { r.state.pos = r.board.findIndex(s => s.kind === kind); return r.land(); };
  it('回復は20。最大HPを超えない', () => {
    const r = run(); r.state.hp = 50;
    expect(at(r, 'heal')).toMatchObject({ kind: 'heal', amount: 20 });
    r.state.hp = 95;
    expect(at(r, 'heal')).toMatchObject({ amount: 5 });
  });
  it('最大HPアップは +10 で、その分も回復する', () => {
    const r = run(); r.state.hp = 80;
    at(r, 'maxhp');
    expect(r.maxHp).toBe(110);
    expect(r.state.hp).toBe(90);
  });
  it('アイテムのマスは、使用済みの物を1つ復活させる。セットしていない枠は対象外', () => {
    const r = run(seq(0), [true, false, true]);
    r.state.used = [true, true, false];
    expect(at(r, 'item')).toMatchObject({ kind: 'item', index: 0 });
    expect(r.state.used).toEqual([false, true, false]);
    expect(at(r, 'item')).toMatchObject({ index: -1 });
  });
  it('イベントは3ダメージ。これで倒れることはない', () => {
    const r = run();
    expect(at(r, 'event')).toMatchObject({ kind: 'event', damage: 3 });
    expect(r.state.hp).toBe(97);
    r.state.hp = 2;
    at(r, 'event');
    expect(r.state.hp).toBe(1);
  });
  it('モンスターのマスは、その神殿の雑魚からランダムに出る', () => {
    const r = run(seq(0.99));
    const e = at(r, 'monster');
    expect(e).toMatchObject({ kind: 'monster', rank: 'zako', enemy: fire.zako[fire.zako.length - 1] });
    expect(r.state.pending).toBe(fire.zako[fire.zako.length - 1]);
  });
  it('ランダムのマスは、ほかのマスのどれかが起きる', () => {
    const r = run(seq(2.5 / 6));          // 6種類のうち3番目（回復）
    r.state.hp = 50;
    expect(at(r, 'random')).toMatchObject({ kind: 'heal', random: true });
  });
});

describe('戦闘の結果', () => {
  it('勝つとHPとアイテムの使用状況を引き継ぐ。中ボスなら中間地点になる', () => {
    const r = run();
    r.state.pos = r.midIndex; r.land();
    r.battleWon(61, [true, false, false]);
    expect(r.state).toMatchObject({ hp: 61, used: [true, false, false], midDone: true, pending: null });
  });
  it('負けると入口から。HP・最大HP・アイテムは元に戻る', () => {
    const r = run();
    r.state.pos = 20; r.state.hp = 5; r.state.maxBonus = 20; r.state.used = [true, true, true];
    r.battleLost();
    expect(r.state).toMatchObject({ pos: 0, hp: 100, maxBonus: 0, used: [false, false, false] });
  });
  it('中ボスを討伐した後に負けると、中間地点から', () => {
    const r = run();
    r.state.midDone = true; r.state.pos = r.bossIndex;
    r.battleLost();
    expect(r.state.pos).toBe(r.midIndex);
    expect(r.land()).toEqual({ kind: 'none' });      // 中間地点では何も起きない
  });
  it('ボスに勝つと踏破', () => {
    const r = run();
    r.state.pos = r.bossIndex; r.land();
    r.battleWon(30, [false, false, false]);
    expect(r.state.cleared).toBe(true);
  });
  it('保存した状態から続きを再開できる', () => {
    const a = run();
    a.state.pos = 12; a.state.hp = 44; a.state.maxBonus = 10; a.state.used = [true, false, false];
    const b = new DungeonRun(fire, 100, [true, true, true], Math.random, JSON.parse(JSON.stringify(a.state)));
    expect(b.state).toEqual(a.state);
    expect(b.maxHp).toBe(110);
  });
});
