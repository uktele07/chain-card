// ダンジョン（すごろく）のルール本体。描画や入力には依存しない。

export type SquareKind = 'start' | 'none' | 'monster' | 'heal' | 'maxhp' | 'item' | 'event' | 'random' | 'mid' | 'boss' | 'key' | 'door';
// k: 最深部の鍵（止まると手に入る。1本だけ）、D: 最深部の扉（鍵がないと通れない。開けると開いたまま）
const KIND: Record<string, SquareKind> = { S: 'start', n: 'none', m: 'monster', h: 'heal', u: 'maxhp', i: 'item', e: 'event', r: 'random', M: 'mid', B: 'boss', k: 'key', D: 'door' };

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
  | { kind: 'event'; damage: number; random?: boolean }
  | { kind: 'key'; random?: boolean }                    // 鍵を手に入れた
  | { kind: 'door'; random?: boolean };                  // 扉を開けた

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
  key?: boolean;           // 最深部の鍵を持っている（負けると失い、鍵はもとのマスに戻る）
  doorOpen?: boolean;      // 最深部の扉を開けた（開いたまま。負けたらここからやり直す）
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
  get doorIndex() { return this.board.findIndex(s => s.kind === 'door'); }
  /** 止まらずには通れないマス（中ボス、まだ開けていない扉、ボス） */
  isGate(i: number) { const k = this.board[i].kind, s = this.state; return k === 'boss' || (k === 'mid' && !s.midDone) || (k === 'door' && !s.doorOpen); }
  /** マス i から進めるマス。扉は鍵を持っているか、開いているときだけ */
  exits(i: number): number[] {
    const s = this.state;
    return this.board[i].next.filter(n => this.board[n].kind !== 'door' || s.key || s.doorOpen);
  }
  /** 次の関所までに数えるマスの種類（輪の中で鍵がないときは、鍵のマスまで） */
  private goal(i: number) {
    const k = this.board[i].kind, s = this.state;
    if (!s.midDone) return k === 'mid';
    if (this.doorIndex >= 0 && !s.doorOpen) return s.key ? k === 'door' : k === 'key';
    return k === 'boss';
  }
  /** 次の目標の名前（盤面の上の案内） */
  get goalName() { const s = this.state; return !s.midDone ? '中ボス' : this.doorIndex >= 0 && !s.doorOpen ? (s.key ? '扉' : '鍵') : 'ボス'; }
  /** 次の目標（中ボス → 鍵 → 扉 → ボス）までの最短のマス数 */
  distanceToGate(): number {
    const seen = new Map<number, number>([[this.state.pos, 0]]), q = [this.state.pos];
    while (q.length) {
      const i = q.shift()!, d = seen.get(i)!;
      for (const n of this.exits(i)) {
        if (seen.has(n)) continue;
        if (this.goal(n)) return d + 1;
        seen.set(n, d + 1); q.push(n);
      }
    }
    return 0;
  }

  /** サイコロを振る。fixed を渡すとその目にする（テストモード） */
  roll(fixed?: number): number {
    const n = fixed && fixed >= 1 && fixed <= 6 ? Math.floor(fixed) : 1 + Math.floor(this.rng() * 6);
    this.state.steps = n;
    return n;
  }
  /** いま選べる行き先（分かれ道なら2つ以上） */
  options(): number[] { return this.exits(this.state.pos); }
  /**
   * 1マス進む。分かれ道では choice（行き先のマスの番号）が要る。
   * 戻り値: moved=まだ歩数が残っている / choose=行き先を選ぶ必要がある / landed=止まった
   */
  step(choice?: number): 'moved' | 'choose' | 'landed' {
    const s = this.state, next = this.exits(s.pos);
    if (s.steps <= 0 || next.length === 0) { s.steps = 0; return 'landed'; }
    if (next.length > 1 && (choice === undefined || !next.includes(choice))) return 'choose';
    s.pos = next.length > 1 ? choice! : next[0];
    s.steps--;
    if (this.isGate(s.pos)) s.steps = 0;     // 関所は必ず止まる
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
      case 'key': if (s.key || s.doorOpen) return { kind: 'none' }; s.key = true; return { kind: 'key' };
      case 'door': if (s.doorOpen || !s.key) return { kind: 'none' }; s.doorOpen = true; s.key = false; return { kind: 'door' };
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
  /** 戦闘に負けた。入口からやり直す（中ボス討伐後は中ボスのマス、扉を開けたあとは扉のマスから）。鍵は失う */
  battleLost() {
    const s = this.state;
    s.pos = s.doorOpen ? this.doorIndex : s.midDone ? this.midIndex : 0;
    s.key = false;
    s.hp = this.baseMaxHp; s.maxBonus = 0;
    s.used = this.slots.map(() => false);
    s.steps = 0; s.pending = null;
  }
}
