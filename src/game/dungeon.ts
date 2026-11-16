// ダンジョン（すごろく）のルール本体。描画や入力には依存しない。

export type SquareKind = 'start' | 'none' | 'monster' | 'heal' | 'maxhp' | 'item' | 'event' | 'random' | 'mid' | 'boss';
const KIND: Record<string, SquareKind> = { S: 'start', n: 'none', m: 'monster', h: 'heal', u: 'maxhp', i: 'item', e: 'event', r: 'random', M: 'mid', B: 'boss' };

export interface DungeonDef {
  id: string; name: string; mark: string; color: string; locked?: boolean; minutes?: number;
  zako: string[]; midBoss: string; boss: string;
  heal: number; maxHpUp: number;
  event: { name: string; damage: number };
  reward: { accessory: string; gold: number };
  cell: number; size: [number, number];
  lava: [number, number, number, number][];                 // 溶岩の池 [x, y, w, h]（マス単位）
  segments: { id: string; next: string[]; cells: [number, number, string][] }[];
}
export interface Square { id: number; x: number; y: number; kind: SquareKind; next: number[]; seg: string }

/** 区間の並びから、マスのつながりを作る */
export function buildBoard(def: DungeonDef): Square[] {
  const out: Square[] = [], first: Record<string, number> = {}, last: Record<string, number> = {};
  for (const seg of def.segments) {
    seg.cells.forEach(([x, y, k], i) => {
      const id = out.length;
      if (i === 0) first[seg.id] = id; else out[id - 1].next.push(id);
      out.push({ id, x, y, kind: KIND[k] ?? 'none', next: [], seg: seg.id });
      last[seg.id] = id;
    });
  }
  for (const seg of def.segments) for (const n of seg.next) out[last[seg.id]].next.push(first[n]);
  return out;
}

export type Effect =
  | { kind: 'none'; random?: boolean }
  | { kind: 'monster'; enemy: string; rank: 'zako' | 'mid' | 'boss'; random?: boolean }
  | { kind: 'heal'; amount: number; random?: boolean }
  | { kind: 'maxhp'; amount: number; random?: boolean }
  | { kind: 'item'; index: number; random?: boolean }     // index: 復活した枠。-1 は復活する物がなかった
  | { kind: 'event'; damage: number; random?: boolean };

/** 保存する探索の状態 */
export interface RunState {
  dungeon: string;
  pos: number;
  hp: number;
  maxBonus: number;        // 最大HPアップの合計（外に出ると消える）
  used: boolean[];         // アイテムの使用状況（探索全体で各1回）
  midDone: boolean;        // 中ボスを討伐済み
  steps: number;           // サイコロの残り歩数
  pending: string | null;  // これから戦う敵（戦闘の途中で閉じたら、ここからやり直す）
  cleared: boolean;
}

export class DungeonRun {
  readonly board: Square[];
  state: RunState;

  constructor(readonly def: DungeonDef, private baseMaxHp: number, private slots: boolean[], private rng: () => number = Math.random, state?: RunState) {
    this.board = buildBoard(def);
    this.state = state && state.dungeon === def.id && this.board[state.pos]
      ? { ...state, used: slots.map((_, i) => !!state.used[i]) }
      : { dungeon: def.id, pos: 0, hp: baseMaxHp, maxBonus: 0, used: slots.map(() => false), midDone: false, steps: 0, pending: null, cleared: false };
  }

  get maxHp() { return this.baseMaxHp + this.state.maxBonus; }
  get square() { return this.board[this.state.pos]; }
  get midIndex() { return this.board.findIndex(s => s.kind === 'mid'); }
  get bossIndex() { return this.board.findIndex(s => s.kind === 'boss'); }
  /** 次の関所（中ボスかボス）までの最短のマス数 */
  distanceToGate(): number {
    const seen = new Map<number, number>([[this.state.pos, 0]]), q = [this.state.pos];
    while (q.length) {
      const i = q.shift()!, d = seen.get(i)!;
      for (const n of this.board[i].next) {
        if (seen.has(n)) continue;
        const k = this.board[n].kind;
        if (k === 'boss' || (k === 'mid' && !this.state.midDone)) return d + 1;
        seen.set(n, d + 1); q.push(n);
      }
    }
    return 0;
  }

  /** サイコロを振る */
  roll(): number {
    const n = 1 + Math.floor(this.rng() * 6);
    this.state.steps = n;
    return n;
  }
  /** いま選べる行き先（分かれ道なら2つ以上） */
  options(): number[] { return this.square.next; }
  /**
   * 1マス進む。分かれ道では choice（行き先のマスの番号）が要る。
   * 戻り値: moved=まだ歩数が残っている / choose=行き先を選ぶ必要がある / landed=止まった
   */
  step(choice?: number): 'moved' | 'choose' | 'landed' {
    const s = this.state, next = this.square.next;
    if (s.steps <= 0 || next.length === 0) { s.steps = 0; return 'landed'; }
    if (next.length > 1 && (choice === undefined || !next.includes(choice))) return 'choose';
    s.pos = next.length > 1 ? choice! : next[0];
    s.steps--;
    const k = this.square.kind;
    if (k === 'boss' || (k === 'mid' && !s.midDone)) s.steps = 0;     // 関所は必ず止まる
    return s.steps > 0 ? 'moved' : 'landed';
  }

  /** 止まったマスの効果を起こす */
  land(): Effect {
    const eff = this.resolve(this.square.kind);
    if (eff.kind === 'monster') this.state.pending = eff.enemy;
    return eff;
  }
  private resolve(kind: SquareKind, random = false): Effect {
    const s = this.state, d = this.def, r = random ? { random: true } : {};
    switch (kind) {
      case 'monster': return { kind: 'monster', enemy: d.zako[Math.floor(this.rng() * d.zako.length)], rank: 'zako', ...r };
      case 'mid': return s.midDone ? { kind: 'none' } : { kind: 'monster', enemy: d.midBoss, rank: 'mid' };
      case 'boss': return { kind: 'monster', enemy: d.boss, rank: 'boss' };
      case 'heal': { const before = s.hp; s.hp = Math.min(this.maxHp, s.hp + d.heal); return { kind: 'heal', amount: s.hp - before, ...r }; }
      case 'maxhp': { s.maxBonus += d.maxHpUp; s.hp = Math.min(this.maxHp, s.hp + d.maxHpUp); return { kind: 'maxhp', amount: d.maxHpUp, ...r }; }
      case 'item': {
        const cand = s.used.map((u, i) => (u && this.slots[i] ? i : -1)).filter(i => i >= 0);
        const index = cand.length ? cand[Math.floor(this.rng() * cand.length)] : -1;
        if (index >= 0) s.used[index] = false;
        return { kind: 'item', index, ...r };
      }
      case 'event': { const dmg = Math.min(d.event.damage, s.hp - 1); s.hp -= Math.max(0, dmg); return { kind: 'event', damage: Math.max(0, dmg), ...r }; }   // マスのダメージでは倒れない
      case 'random': {
        const pool: SquareKind[] = ['none', 'monster', 'heal', 'maxhp', 'item', 'event'];
        return this.resolve(pool[Math.floor(this.rng() * pool.length)], true);
      }
      default: return { kind: 'none', ...r };
    }
  }

  /** 戦闘に勝った。HPとアイテムの使用状況を引き継ぐ。ボスなら踏破 */
  battleWon(hp: number, used: boolean[]) {
    const s = this.state, k = this.square.kind;
    s.hp = Math.max(1, Math.min(this.maxHp, hp));
    s.used = this.slots.map((_, i) => !!used[i]);
    s.pending = null;
    if (k === 'mid') s.midDone = true;
    if (k === 'boss') s.cleared = true;
  }
  /** 戦闘に負けた。入口（中ボス討伐後は中間地点）からやり直す */
  battleLost() {
    const s = this.state;
    s.pos = s.midDone ? this.midIndex : 0;
    s.hp = this.baseMaxHp; s.maxBonus = 0;
    s.used = this.slots.map(() => false);
    s.steps = 0; s.pending = null;
  }
}
