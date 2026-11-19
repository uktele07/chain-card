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
  it('入口から始まり、鍵を持てば、どの道を選んでもボスに着く', () => {
    expect(board[0].kind).toBe('start');
    const r = run(); r.state.key = true;
    for (const pick of [0, 1]) {
      let i = 0, p = -1, n = 0;
      // 輪の分かれ目では扉の側へ
      while (r.exitsFrom(i, p).length && n++ < 200) { const o = r.exitsFrom(i, p), d = o.find(x => board[x].kind === 'door'); p = i; i = d ?? o[Math.min(pick, o.length - 1)]; }
      expect(i).toBe(r.bossIndex);
    }
  });
  it('中ボスの先に輪があり、鍵は輪の中に1本、扉は輪の出口に1つ', () => {
    const r = run(), key = board.filter(s => s.kind === 'key'), door = board.filter(s => s.kind === 'door');
    expect(key.length).toBe(1); expect(door.length).toBe(1);
    // 輪は16マス。入口（中ボスの次）から右回りに一周して戻れる。鍵は入口から左右どちら回りでも 8マス
    const entry = r.midIndex + 1;
    expect(r.exitsFrom(entry, r.midIndex).length).toBe(2);      // 入口で左右を選ぶ
    let p = r.midIndex, i = entry, n = 0;
    const ring: number[] = [];
    do { ring.push(i); const o = r.exitsFrom(i, p).filter(x => board[x].kind !== 'door'); const nx = o.length > 1 ? Math.min(...o) : o[0]; p = i; i = nx; n++; } while (i !== entry && n < 100);
    expect(ring.length).toBe(16);
    expect(ring.indexOf(key[0].id)).toBe(8);
    expect(ring.every(x => x > r.midIndex)).toBe(true);
    // 扉の前のマスは輪の上辺。入口との間は2マス（左回りで3マス目）
    const junction = board.findIndex(s => s.next.includes(r.doorIndex));
    expect(16 - ring.indexOf(junction)).toBe(3);
    expect(board[r.doorIndex].y).toBeLessThan(board[junction].y);
  });
  it('輪の外の分かれ道が2つ、中ボスとボスが1つずつある', () => {
    expect(board.filter(s => s.next.length > 1 && !s.seg.startsWith('r')).length).toBe(2);
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
  it('テストモード: 目を指定すると、その目になる（乱数は使わない）', () => {
    const r = run(() => 0.99);
    for (const n of [1, 3, 6]) { expect(r.roll(n)).toBe(n); expect(r.state.steps).toBe(n); }
    expect(r.roll(0)).toBe(6);     // 範囲外は、ふつうに振る
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
  it('イベントは7ダメージ。これで倒れることはない', () => {
    const r = run();
    expect(at(r, 'event')).toMatchObject({ kind: 'event', damage: 7 });
    expect(r.state.hp).toBe(93);
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

describe('最深部の鍵と扉', () => {
  const junctionOf = (r: DungeonRun) => r.board.findIndex(s => s.next.includes(r.doorIndex));
  const keyIndex = (r: DungeonRun) => r.board.findIndex(s => s.kind === 'key');
  /** マス pos に、prev から来た状態で置く（輪の中では、来た向きで進む向きが決まる） */
  const place = (r: DungeonRun, pos: number, prev: number) => { r.state.pos = pos; r.state.prev = prev; };
  it('輪の入口で左右を選べる。1周して入口に戻っても、向きは選び直せない', () => {
    const r = run(); r.state.midDone = true;
    const entry = r.midIndex + 1;
    place(r, r.midIndex, -1); r.state.steps = 2;
    expect(r.step()).toBe('moved');
    expect(r.state.pos).toBe(entry);
    expect(r.step()).toBe('choose');
    expect(r.options().length).toBe(2);
    place(r, entry + 15, entry + 14); r.state.steps = 2;       // 右回りで入口の手前まで来た
    expect(r.step()).toBe('moved'); expect(r.state.pos).toBe(entry);
    expect(r.options()).toEqual([entry + 1]);                  // そのまま右回り
    place(r, entry + 1, entry + 2); r.state.steps = 2;         // 左回りで入口の手前まで来た
    walk(r, 2);
    expect(r.state.pos).toBe(entry + 15);                      // そのまま左回り
  });
  it('鍵がないと、輪の分かれ目で扉へは進めず、輪をもう一周する（選ぶ画面も出ない）', () => {
    const r = run(); r.state.midDone = true;
    const j = junctionOf(r);
    for (const from of [j - 1, j + 1]) {                      // どちら回りでも
      place(r, j, from); r.state.steps = 3;
      expect(r.options().length).toBe(1);
      expect(r.step()).toBe('moved');
      expect(r.board[r.state.pos].kind).not.toBe('door');
    }
  });
  it('鍵は止まったときだけ手に入る。通り過ぎるだけでは得られない', () => {
    const r = run(); r.state.midDone = true;
    place(r, keyIndex(r) - 1, keyIndex(r) - 2); walk(r, 2);
    expect(r.land()).toMatchObject({ kind: expect.not.stringMatching('key') });
    expect(r.state.key).toBeFalsy();
    place(r, keyIndex(r) - 1, keyIndex(r) - 2); walk(r, 1);
    expect(r.land()).toEqual({ kind: 'key' });
    expect(r.state.key).toBe(true);
    expect(r.land()).toEqual({ kind: 'none' });      // 1本だけ。持っている間はもう出ない
  });
  it('鍵を持っていれば、分かれ目で扉か輪かを選べる。扉では止まり、開けると開いたまま', () => {
    const r = run(); r.state.midDone = true; r.state.key = true;
    const j = junctionOf(r);
    place(r, j, j - 1); r.state.steps = 4;
    expect(r.step()).toBe('choose');
    expect(r.options()).toContain(r.doorIndex);
    expect(r.step(r.doorIndex)).toBe('landed');       // 歩数が残っていても止まる
    expect(r.land()).toEqual({ kind: 'door' });
    expect(r.state).toMatchObject({ doorOpen: true, key: false });
    r.state.pos = j; r.state.steps = 1;
    expect(r.step(r.doorIndex)).toBe('landed');
    r.state.steps = 2;
    expect(r.step()).toBe('moved');                    // 開いた扉は止まらずに通れる
  });
  it('鍵を持って負けると、鍵を失い、鍵はもとのマスに戻る', () => {
    const r = run(); r.state.midDone = true; r.state.key = true; r.state.pos = junctionOf(r);
    r.battleLost();
    expect(r.state).toMatchObject({ key: false, pos: r.midIndex });
    r.state.pos = keyIndex(r);
    expect(r.land()).toEqual({ kind: 'key' });
  });
  it('扉を開けたあとに負けると、扉のマスから。鍵のマスでは何も起きない', () => {
    const r = run(); r.state.midDone = true; r.state.doorOpen = true; r.state.pos = r.bossIndex;
    r.battleLost();
    expect(r.state.pos).toBe(r.doorIndex);
    expect(r.land()).toEqual({ kind: 'none' });
    r.state.pos = keyIndex(r);
    expect(r.land()).toEqual({ kind: 'none' });
  });
  it('次の目標: 中ボス → 鍵 → 扉 → ボス', () => {
    const r = run();
    expect(r.goalName).toBe('中ボス');
    r.state.midDone = true; expect(r.goalName).toBe('鍵');
    r.state.pos = keyIndex(r) - 2; expect(r.distanceToGate()).toBe(2);
    r.state.key = true; expect(r.goalName).toBe('扉');
    r.state.pos = junctionOf(r); expect(r.distanceToGate()).toBe(1);
    r.state.doorOpen = true; r.state.key = false; expect(r.goalName).toBe('ボス');
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
