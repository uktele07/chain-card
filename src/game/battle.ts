// 戦闘ルール本体。描画や入力には依存しない（テストとシミュレーションから直接使える）。

export type CardType = 'attack' | 'spell';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  lv?: number;        // アタックのみ: 1=C 2=B 3=A 4=S
  power?: number;
  effect?: string;    // スペルのみ: levelx / double / drain / rankup
  desc?: string;
  copies: number;
}
export interface Card extends CardDef { uid: number }

/** アイテム: デッキには入らず、L2・R2にセットして1戦に1回ずつ使う */
export interface ItemDef {
  id: string;
  name: string;
  effect: string;     // heal / flash / sand / awake / rage
  value?: number;
  chargeScale?: number;   // sand: 入れ替え時間に掛ける倍率
  durationSec?: number;
  stunSec?: number;
  desc?: string;
}
export interface ItemSlot { def: ItemDef; used: boolean }

/** 敵: actions を上から順に繰り返す。chargeSec かけてゲージを溜め、満タンで damage を与える */
export interface EnemyAction { name: string; chargeSec: number; damage: number; big?: boolean }
export interface EnemyDef {
  id: string; name: string; rank?: string; hp: number; actions: EnemyAction[];
  rankSec?: { S: number; A: number; B: number };   // 撃破タイムがこの秒数以内ならそのランク
  unlock?: 'prev';                                  // 一覧でこれより前の敵をすべて倒すと出現
  drop?: { id: string; name: string; price: number };   // 討伐で手に入る換金アイテム
}

/** 装備による補正（武器と防具をまとめたもの） */
export interface Gear {
  power?: number[];        // 武器: レベルごとの威力 [C, B, A, S]
  attackWaitSec?: number;  // 武器: アタックを出した後、次のカードを出せるまでの待ち
  chargeMod?: number;      // 入れ替え時間に足す秒数（マイナスなら速くなる）
  def?: number;            // 防具: 受けるダメージを減らす量（最低1は受ける）
}
export interface EnemyState { def: EnemyDef; hp: number; actionIndex: number; gauge: number; stunLeft: number }

export interface Rules {
  handSize: number;
  chainTimerSec: number;
  allowStepDown: boolean;       // 1つ下のレベルも出せる（チェインはそのレベルに戻る）
  sResetsChain: boolean;        // Sを出すとチェインがなくなる（次はCから）
  chargeSec: number;            // スキップしたときの入れ替え時間
  fullConsumeChargeSec: number; // 4枚すべて使い切ったとき
  keepConsumeChargeSec: number; // キープを残して使い切ったとき
  autoSkipDelaySec: number;     // 出せるカードがないとき、自動で入れ替えが始まるまでの時間
  autoChargeSec: number;        // 自動で入れ替えるときの入れ替え時間（上と合わせて合計の待ちになる）
  misinputStunSec: number;
  playLockSec: number;
  keepCountsAsConsumed: boolean;
  playerMaxHp: number;
}

export interface Slot { card: Card | null; kept: boolean }

export type BattleEvent =
  | { kind: 'hit'; slot: number; damage: number; lv: number; index: number; hits: number }
  | { kind: 'spell'; slot: number; effect: string }
  | { kind: 'item'; slot: number; effect: string }
  | { kind: 'heal'; amount: number }
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
  private basePower: Record<number, number> = {};
  pool: Card[] = [];       // 山札
  pending: Card[] = [];    // 使用済み・スキップ済み。次の補充が終わったら山札に戻る
  slots: Slot[] = [];
  items: (ItemSlot | null)[] = [];
  selected = 0;            // L2で選んでいるアイテムの枠
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
  buffs = { double: 0, levelx: 0, drain: 0, rankup: 0 };
  gear: Gear = {};
  sandLeft = 0;
  sandScale = 1;           // 時の砂の効果中、入れ替え時間に掛ける倍率
  rageLeft = 0;            // 強化薬の残り秒
  rageBonus = 0;
  turnDamage = 0;          // 今の手札（配られてから次に配られるまで）で与えたダメージ
  usedInvincible = false;  // 無敵（テスト用）を使った戦闘は記録しない
  hp: number;
  time = 0;
  stats = { damage: 0, plays: 0, skips: 0, autoSkips: 0, misses: 0, sCount: 0, fullConsumes: 0, maxTurn: 0, chainBreaks: 0, taken: 0 };
  events: BattleEvent[] = [];

  constructor(defs: CardDef[], rules: Rules, rng: () => number = Math.random, items: (ItemDef | null)[] = [], enemy: EnemyDef | null = null, gear: Gear = {}) {
    this.rules = rules;
    this.gear = gear;
    this.rng = rng;
    this.hp = rules.playerMaxHp;
    this.items = items.map(def => (def ? { def, used: false } : null));
    this.selected = Math.max(0, this.items.findIndex(it => it));
    if (enemy) {
      this.enemy = { def: enemy, hp: enemy.hp, actionIndex: 0, gauge: 0, stunLeft: 0 };
      this.announceAction();
    }
    let uid = 0;
    for (const d of defs) {
      if (d.type === 'attack') this.basePower[d.lv!] = d.power!;
      for (let i = 0; i < d.copies; i++) this.pool.push({ ...d, uid: uid++ });
    }
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
    if (this.invincible) this.usedInvincible = true;
    if (this.sandLeft > 0) this.sandLeft = Math.max(0, this.sandLeft - dt);
    if (this.rageLeft > 0) this.rageLeft = Math.max(0, this.rageLeft - dt);
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
    const damage = this.invincible ? 0 : Math.max(1, a.damage - (this.gear.def ?? 0));
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

  /** そのレベルのアタックの威力（武器で決まる） */
  powerOf(lv: number): number {
    return this.gear.power?.[lv - 1] ?? this.basePower[lv] ?? 0;
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
      // ランクアップ: 1段上のレベルとして扱う（威力もチェインも）。出せるかどうかは元のレベルで決まる
      const lv = Math.min(MAX_CHAIN, card.lv! + (this.buffs.rankup > 0 ? 1 : 0));
      // ダブル: 同じアタックを2回当てる。強化薬は1回ごとに乗る
      const hits = this.buffs.double > 0 ? 2 : 1;
      const per = this.powerOf(lv) + (this.rageLeft > 0 ? this.rageBonus : 0);
      const damage = per * hits;
      this.stats.damage += damage;
      this.turnDamage += damage;
      this.stats.maxTurn = Math.max(this.stats.maxTurn, this.turnDamage);
      if (lv === MAX_CHAIN) this.stats.sCount++;
      for (let h = 0; h < hits; h++) this.events.push({ kind: 'hit', slot: i, damage: per, lv, index: h, hits });
      if (this.buffs.drain > 0) {   // ドレイン: 与えたダメージと同じだけ回復
        const before = this.hp;
        this.hp = Math.min(this.rules.playerMaxHp, this.hp + damage);
        this.events.push({ kind: 'heal', amount: this.hp - before });
      }
      this.buffs = { double: 0, levelx: 0, drain: 0, rankup: 0 };
      this.chain = lv === MAX_CHAIN && this.rules.sResetsChain ? 0 : lv;
      this.lock = Math.max(this.lock, this.gear.attackWaitSec ?? 0);   // 斧など: 次のカードまでの待ち
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
      this.sandScale = d.chargeScale ?? 0.1;
      if (this.charging) { this.chargeLeft *= this.sandScale; this.chargeTotal *= this.sandScale; }   // 待っている最中の補充も速くなる
    }
    if (d.effect === 'awake') { this.chain = d.value ?? 3; this.chainTimer = this.rules.chainTimerSec; }
    if (d.effect === 'rage') { this.rageLeft = d.durationSec ?? 0; this.rageBonus = d.value ?? 1; }
    this.events.push({ kind: 'item', slot: i, effect: d.effect });
    return true;
  }

  private nextUsable(from: number): number {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) { const j = (from + k) % n; const it = this.items[j]; if (it && !it.used) return j; }
    return -1;
  }
  /** L2: 使うアイテムを切り替える（未使用のものだけを順に回る） */
  cycleItem(): boolean {
    const j = this.nextUsable(this.selected);
    if (j < 0 || j === this.selected) return false;
    this.selected = j;
    return true;
  }
  /** R2: 選んでいるアイテムを使う。使ったら、次の未使用アイテムに選択が移る */
  useSelected(): boolean {
    if (!this.useItem(this.selected)) return false;
    const j = this.nextUsable(this.selected);
    if (j >= 0) this.selected = j;
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
    this.startCharge(auto ? this.rules.autoChargeSec : this.rules.chargeSec);
    return true;
  }

  private checkConsumed() {
    if (this.charging) return;
    const hasEmpty = this.slots.some(s => !s.card);
    if (!hasEmpty) return;
    const left = this.slots.filter(s => s.card && !(this.rules.keepCountsAsConsumed && s.kept)).length;
    if (left > 0) return;
    // 使い切り: 4枚とも出したときは速く、キープを残したときは通常の速さ。どちらもチェインは下がらない
    const all = this.slots.every(s => !s.card);
    this.stats.fullConsumes++;
    this.startCharge(all ? this.rules.fullConsumeChargeSec : this.rules.keepConsumeChargeSec);
  }

  private startCharge(sec: number) {
    this.charging = true;
    this.chargeTotal = Math.max(0, sec + (this.gear.chargeMod ?? 0)) * (this.sandLeft > 0 ? this.sandScale : 1);
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
    this.turnDamage = 0;
    if (!initial) this.events.push({ kind: 'refill' });
  }
}
