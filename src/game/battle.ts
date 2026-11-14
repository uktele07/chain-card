// 戦闘ルール本体。描画や入力には依存しない（テストとシミュレーションから直接使える）。

export type CardType = 'attack' | 'spell';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  lv?: number;        // アタックのみ: 1=C 2=B 3=A 4=S
  power?: number;
  effect?: string;    // スペルのみ: levelx / power
  desc?: string;
  copies: number;
}
export interface Card extends CardDef { uid: number }

/** アイテム: デッキには入らず、L2・R2にセットして1戦に1回ずつ使う */
export interface ItemDef {
  id: string;
  name: string;
  effect: string;     // heal / flash / sand
  value?: number;
  durationSec?: number;
  stunSec?: number;
  desc?: string;
}
export interface ItemSlot { def: ItemDef; used: boolean }

/** 敵: actions を上から順に繰り返す。chargeSec かけてゲージを溜め、満タンで damage を与える */
export interface EnemyAction { name: string; chargeSec: number; damage: number; big?: boolean }
export interface EnemyDef { id: string; name: string; hp: number; actions: EnemyAction[] }
export interface EnemyState { def: EnemyDef; hp: number; actionIndex: number; gauge: number; stunLeft: number }

export interface Rules {
  handSize: number;
  chainTimerSec: number;
  allowStepDown: boolean;       // 1つ下のレベルも出せる（チェインはそのレベルに戻る）
  chargeSec: number;
  fullConsumeChargeSec: number;
  autoSkipDelaySec: number;     // 出せるカードがないとき、自動で入れ替えるまでの時間
  misinputStunSec: number;
  playLockSec: number;
  keepCountsAsConsumed: boolean;
  playerMaxHp: number;
}

export interface Slot { card: Card | null; kept: boolean }

export type BattleEvent =
  | { kind: 'hit'; slot: number; damage: number; lv: number; powered: boolean }
  | { kind: 'spell'; slot: number; effect: string }
  | { kind: 'item'; slot: number; effect: string }
  | { kind: 'keep'; slot: number; on: boolean }
  | { kind: 'miss'; slot: number }
  | { kind: 'skip'; auto: boolean }
  | { kind: 'refill' }
  | { kind: 'chainBreak' }
  | { kind: 'enemyCharge'; name: string; big: boolean }
  | { kind: 'enemyAttack'; name: string; damage: number; big: boolean }
  | { kind: 'win' }
  | { kind: 'lose' };

export const LEVEL_LABELS = ['-', 'C', 'B', 'A', 'S'];
export const MAX_CHAIN = 4;

export class Battle {
  readonly rules: Rules;
  private rng: () => number;
  pool: Card[] = [];       // 山札
  pending: Card[] = [];    // 使用済み・スキップ済み。次の補充が終わったら山札に戻る
  slots: Slot[] = [];
  items: ItemSlot[] = [];
  enemy: EnemyState | null = null;
  result: 'playing' | 'won' | 'lost' = 'playing';
  chain = 0;               // 0=なし 1=C 2=B 3=A 4=S
  chainTimer = 0;          // 残り秒
  charging = false;
  chargeLeft = 0;
  chargeTotal = 0;
  lock = 0;                // 入力を受け付けない残り秒
  missLock = false;        // 直近のロックが誤入力によるものか
  invincible = false;      // テスト用: 敵の攻撃でHPが減らない
  autoSkipWait = 0;        // 出せるカードがない状態が続いている秒数
  buffs = { power: 0, levelx: 0 };
  sandLeft = 0;
  hp: number;
  time = 0;
  stats = { damage: 0, plays: 0, skips: 0, autoSkips: 0, misses: 0, sCount: 0, fullConsumes: 0, maxHit: 0, chainBreaks: 0, taken: 0 };
  events: BattleEvent[] = [];

  constructor(defs: CardDef[], rules: Rules, rng: () => number = Math.random, items: ItemDef[] = [], enemy: EnemyDef | null = null) {
    this.rules = rules;
    this.rng = rng;
    this.hp = rules.playerMaxHp;
    this.items = items.map(def => ({ def, used: false }));
    if (enemy) {
      this.enemy = { def: enemy, hp: enemy.hp, actionIndex: 0, gauge: 0, stunLeft: 0 };
      this.announceAction();
    }
    let uid = 0;
    for (const d of defs) for (let i = 0; i < d.copies; i++) this.pool.push({ ...d, uid: uid++ });
    for (let i = 0; i < rules.handSize; i++) this.slots.push({ card: null, kept: false });
    this.refill(true);
  }

  get enemyAction(): EnemyAction | null {
    return this.enemy ? this.enemy.def.actions[this.enemy.actionIndex] : null;
  }
  private announceAction() {
    const a = this.enemyAction!;
    this.events.push({ kind: 'enemyCharge', name: a.name, big: !!a.big });
  }

  update(dt: number) {
    if (this.result !== 'playing') return;
    this.time += dt;
    if (this.lock > 0) { this.lock = Math.max(0, this.lock - dt); if (this.lock === 0) this.missLock = false; }
    if (this.sandLeft > 0) this.sandLeft = Math.max(0, this.sandLeft - dt);
    if (this.chain > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) { this.chain = 0; this.chainTimer = 0; this.stats.chainBreaks++; this.events.push({ kind: 'chainBreak' }); }
    }
    if (this.charging) {
      this.chargeLeft -= dt;
      if (this.chargeLeft <= 0) this.refill(false);
    }
    this.updateAutoSkip(dt);
    this.updateEnemy(dt);
  }

  private updateEnemy(dt: number) {
    const e = this.enemy;
    if (!e) return;
    if (e.stunLeft > 0) { e.stunLeft = Math.max(0, e.stunLeft - dt); return; }
    e.gauge += dt;
    const a = this.enemyAction!;
    if (e.gauge < a.chargeSec) return;
    const damage = this.invincible ? 0 : a.damage;
    this.hp = Math.max(0, this.hp - damage);
    this.stats.taken += damage;
    this.events.push({ kind: 'enemyAttack', name: a.name, damage, big: !!a.big });
    e.gauge = 0;
    e.actionIndex = (e.actionIndex + 1) % e.def.actions.length;
    if (this.hp <= 0) { this.result = 'lost'; this.events.push({ kind: 'lose' }); return; }
    this.announceAction();
  }

  /** 出せるカードが1枚もなければ、少し待ってから自動で入れ替える（スキップと同じ扱い） */
  private updateAutoSkip(dt: number) {
    const stuck = !this.charging && this.lock === 0
      && this.slots.some(s => s.card && !s.kept)
      && !this.slots.some(s => s.card && this.canPlay(s.card));
    if (!stuck) { this.autoSkipWait = 0; return; }
    this.autoSkipWait += dt;
    if (this.autoSkipWait >= this.rules.autoSkipDelaySec) { this.autoSkipWait = 0; this.doSkip(true); }
  }

  canPlay(card: Card): boolean {
    if (card.type !== 'attack') return true;
    if (this.buffs.levelx > 0) return true;
    const lv = card.lv!;
    if (lv === 1 || lv === this.chain || lv === this.chain + 1) return true;
    return this.rules.allowStepDown && lv === this.chain - 1;
  }

  /** カードのボタンを押す */
  press(i: number): 'played' | 'miss' | 'ignored' {
    const slot = this.slots[i];
    if (this.result !== 'playing' || this.lock > 0 || !slot?.card) return 'ignored';
    const card = slot.card;
    if (!this.canPlay(card)) {
      this.lock = this.rules.misinputStunSec; this.missLock = true;
      this.stats.misses++;
      this.events.push({ kind: 'miss', slot: i });
      return 'miss';
    }
    slot.card = null; slot.kept = false;
    this.stats.plays++;
    this.lock = this.rules.playLockSec;

    if (card.type === 'attack') {
      const powered = this.buffs.power > 0;
      const damage = card.power! * 2 ** this.buffs.power;
      this.stats.damage += damage;
      this.stats.maxHit = Math.max(this.stats.maxHit, damage);
      if (card.lv === MAX_CHAIN) this.stats.sCount++;
      this.events.push({ kind: 'hit', slot: i, damage, lv: card.lv!, powered });
      this.buffs = { power: 0, levelx: 0 };
      this.chain = card.lv!;
      if (this.enemy) {
        this.enemy.hp = Math.max(0, this.enemy.hp - damage);
        if (this.enemy.hp <= 0) { this.result = 'won'; this.events.push({ kind: 'win' }); }
      }
    } else {
      (this.buffs as Record<string, number>)[card.effect!]++;
      this.events.push({ kind: 'spell', slot: i, effect: card.effect! });
    }
    this.pending.push(card);
    if (this.chain > 0) this.chainTimer = this.rules.chainTimerSec;
    this.checkConsumed();
    return 'played';
  }

  /** L2・R2: セットしたアイテムを使う。1戦に1回。入力ロック中や補充中でも使える */
  useItem(i: number): boolean {
    const it = this.items[i];
    if (this.result !== 'playing' || !it || it.used) return false;
    it.used = true;
    const d = it.def;
    if (d.effect === 'heal') this.hp = Math.min(this.rules.playerMaxHp, this.hp + (d.value ?? 0));
    if (d.effect === 'flash' && this.enemy) { this.enemy.stunLeft = d.stunSec ?? 0; this.enemy.gauge = 0; }
    if (d.effect === 'sand') {
      this.sandLeft = d.durationSec ?? 0;
      if (this.charging) this.refill(false);   // 補充待ちもその場で終わる
    }
    this.events.push({ kind: 'item', slot: i, effect: d.effect });
    return true;
  }

  /** 十字キー: キープの切り替え */
  toggleKeep(i: number) {
    const slot = this.slots[i];
    if (this.result !== 'playing' || !slot?.card) return;
    slot.kept = !slot.kept;
    this.events.push({ kind: 'keep', slot: i, on: slot.kept });
    this.checkConsumed();
  }

  /** スキップ: キープ以外の手札を捨てて補充する。チェインが1段下がる（星の砂の効果中は下がらない） */
  skip(): boolean {
    if (this.result !== 'playing' || this.lock > 0) return false;
    return this.doSkip(false);
  }

  private doSkip(auto: boolean): boolean {
    if (this.charging) return false;
    const targets = this.slots.filter(s => s.card && !s.kept);
    if (targets.length === 0) return false;
    for (const s of targets) { this.pending.push(s.card!); s.card = null; }
    if (this.sandLeft <= 0 && this.chain > 0) this.chain--;
    this.stats.skips++;
    if (auto) this.stats.autoSkips++;
    this.events.push({ kind: 'skip', auto });
    this.startCharge(false);
    return true;
  }

  private checkConsumed() {
    if (this.charging) return;
    const hasEmpty = this.slots.some(s => !s.card);
    if (!hasEmpty) return;
    const left = this.slots.filter(s => s.card && !(this.rules.keepCountsAsConsumed && s.kept)).length;
    if (left === 0) { this.stats.fullConsumes++; this.startCharge(true); }
  }

  private startCharge(full: boolean) {
    this.charging = true;
    this.chargeTotal = this.sandLeft > 0 ? 0 : (full ? this.rules.fullConsumeChargeSec : this.rules.chargeSec);
    this.chargeLeft = this.chargeTotal;
    if (this.chargeTotal === 0) this.refill(false);
  }

  private refill(initial: boolean) {
    for (const s of this.slots) {
      if (s.card || this.pool.length === 0) continue;
      const k = Math.floor(this.rng() * this.pool.length);
      s.card = this.pool.splice(k, 1)[0];
      s.kept = false;
    }
    // 手札がそろってから、使用済みのカードを山札に戻す
    this.pool.push(...this.pending);
    this.pending = [];
    this.charging = false;
    this.chargeLeft = 0;
    if (!initial) this.events.push({ kind: 'refill' });
  }
}
