import Phaser from 'phaser';
import data from '../../data/cards.json';
import { Battle, LEVEL_LABELS, type Card, type CardDef, type EnemyDef, type ItemDef, type Rules } from '../game/battle';
import { Input, type Btn } from '../game/input';
import { Sound } from '../game/audio';
import { W, H, ZOOM } from '../game/display';
import { Layer } from '../game/ui';
import { iconKey, loadArt, monsterKey } from '../game/art';
import { clearSave, loadSave, rankOf, rankValue, storeSave, type Rank, type SaveConfig, type SaveData } from '../game/save';
import { buildDeck, gearOf, type ArmorDef, type WeaponDef } from '../game/loadout';

const RULES = data.rules as unknown as Rules & { defaultItems: string[]; defaultSpells: string[]; maxSpells: number; resumeCountSec: number };
type SpellDef = CardDef & { mark: string; long: string };
const DEFS = data.cards as CardDef[];
const ATTACKS = DEFS.filter(c => c.type === 'attack');
const SPELLS = DEFS.filter(c => c.type === 'spell') as SpellDef[];
const WEAPONS = data.weapons as WeaponDef[];
const ARMORS = data.armors as ArmorDef[];
const ITEMS = data.items as (ItemDef & { short: string })[];
const ENEMIES = data.enemies as EnemyDef[];
const itemOf = (id: string | null) => ITEMS.find(d => d.id === id) ?? null;
const SAVE_CONFIG: SaveConfig = {
  items: ITEMS.map(d => d.id), defaultItems: RULES.defaultItems,
  spells: SPELLS.map(d => d.id), defaultSpells: RULES.defaultSpells, maxSpells: RULES.maxSpells,
  weapons: WEAPONS.map(d => d.id), armors: ARMORS.map(d => d.id), startWeapon: WEAPONS[0].id, startArmor: ARMORS[0].id,
};
const SHOP = [...WEAPONS.filter(w => w.price).map(w => ({ kind: 'weapon' as const, def: w })), ...ARMORS.filter(a => a.price).map(a => ({ kind: 'armor' as const, def: a }))];
const MARK: Record<string, string> = Object.fromEntries(SPELLS.map(c => [c.effect!, c.mark]));

const C = {
  bg: '#0d1017', panel: '#171c26', deep: '#10141c', line: '#2c3442', text: '#e6e9ef', dim: '#8a93a3', faint: '#59606e',
  attack: '#d9534a', spell: '#4a8fd9', item: '#4fae6a', itemBg: '#1c3527', keep: '#f2c230', miss: '#ff5a5a', warn: '#ff8a8a',
  gauge: '#e0b040', sel: '#243047', ng: '#3a4250', white: '#ffffff', ink: '#10141c',
};
const CHAIN_COL = ['#3a4250', '#5fb0e8', '#6fd08a', '#f2a23a', '#ff5a4a'];
const RANK_COL: Record<string, string> = { S: '#ff5a4a', A: '#f2a23a', B: '#6fd08a', C: '#5fb0e8' };
const ENEMY_COL: Record<string, string> = { slime: '#5fb0e8', golem: '#6fd08a', dragon: '#ff5a4a', maou: '#b9a3ea', kami: '#ffd24a' };

const CX = 480, CY = 326, CW = 100, CH = 104, RING = 46;
const POS = [{ x: CX, y: CY - 104 }, { x: CX + 134, y: CY }, { x: CX, y: CY + 104 }, { x: CX - 134, y: CY }];
const GLY = ['△', '○', '✕', '□'];
const CARD_BTN: Btn[] = ['tri', 'circle', 'cross', 'square'];
const KEEP_BTN: Btn[] = ['up', 'right', 'down', 'left'];
const MON = { x: 808, y: 330, size: 258 };
const RESULT_WAIT = 0.8;

type Base = 'list' | 'ready' | 'fight' | 'result';
type Overlay = 'menu' | 'equip' | 'deck' | 'shop' | 'help' | 'reset' | 'pause' | 'resume';
const MENU: { label: string; off?: boolean; act?: Overlay | 'close' }[] = [
  { label: '装備', act: 'equip' }, { label: 'カード編集', act: 'deck' }, { label: 'ショップ', act: 'shop' }, { label: '設定', off: true },
  { label: '操作説明', act: 'help' }, { label: 'セーブリセット', act: 'reset' }, { label: '閉じる', act: 'close' },
];
const PAUSE = ['戦闘再開', 'やり直す', '戦闘終了'];
const EQUIP_ROWS = ['武器', '防具', 'アクセサリ', 'アイテム 1', 'アイテム 2', 'アイテム 3'];

export class GameScene extends Phaser.Scene {
  private input2!: Input;
  private snd = new Sound();
  private L: Layer[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private save!: SaveData;
  private battle!: Battle;

  private base: Base = 'list';
  private overlays: Overlay[] = [];
  private cur = { list: 0, menu: 0, pause: 0, result: 0, reset: 0, slot: 0, opt: 0, deck: 0, shop: 0, sell: 0 };
  private shopTab: 0 | 1 = 0;       // 0=買う 1=売る
  private gained: { name: string; price: number } | null = null;   // 直前の戦闘で手に入れた換金アイテム
  private equipFocus: 'slots' | 'options' = 'slots';
  private enemy: EnemyDef = ENEMIES[0];
  private invincible = false;       // テスト用。画面を移っても維持する
  private resultWait = 0;
  private resumeLeft = 0;
  private outcome: { rank: Rank | null; newBest: boolean } = { rank: null, newBest: false };
  private enemyShake = 0; private ringPulse = 0; private hurt = 0; private lastTick = 0; private clock = 0;

  constructor() { super('game'); }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.input2 = new Input();
    this.L = [new Layer(this, 0), new Layer(this, 100), new Layer(this, 200)];
    this.fx = this.add.graphics().setDepth(60);
    loadArt(this, ZOOM);
    this.save = loadSave(SAVE_CONFIG);
    this.input.on('pointerdown', () => this.snd.unlock());
    window.addEventListener('keydown', () => this.snd.unlock());
    const w = window as unknown as Record<string, unknown>;
    w.__scene = this; w.__sound = this.snd;
    this.newBattle();
  }

  // ---------------- 状態 ----------------
  private get top(): Base | Overlay { return this.overlays[this.overlays.length - 1] ?? this.base; }
  /** 一覧でこれより前の敵をすべて倒していれば出現 */
  private unlocked(e: EnemyDef) { return e.unlock !== 'prev' || ENEMIES.slice(0, ENEMIES.indexOf(e)).every(o => this.save.records[o.id]); }
  private get weapon() { return WEAPONS.find(w => w.id === this.save.weapon) ?? WEAPONS[0]; }
  private get armor() { return ARMORS.find(a => a.id === this.save.armor) ?? ARMORS[0]; }
  private sellList() { return ENEMIES.map(e => e.drop).filter((d): d is NonNullable<EnemyDef['drop']> => !!d && (this.save.loot[d.id] ?? 0) > 0); }

  private newBattle() {
    this.battle = new Battle(buildDeck(DEFS, this.save.spells), RULES, Math.random, this.save.items.map(itemOf), this.enemy, gearOf(this.weapon, this.armor));
    this.battle.invincible = this.invincible;
    this.battle.events.length = 0;
    this.lastTick = 0; this.hurt = 0;
    (window as unknown as Record<string, unknown>).__battle = this.battle;
  }
  private toList() { this.base = 'list'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; }
  private toReady(e: EnemyDef) { this.enemy = e; this.base = 'ready'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; this.newBattle(); }
  private pop() {
    this.overlays.pop();
    if (this.overlays.length === 0 && this.base === 'ready') this.newBattle();   // 装備を変えたかもしれないので作り直す
  }

  private finish(won: boolean) {
    const b = this.battle;
    this.base = 'result'; this.overlays = [];
    this.resultWait = RESULT_WAIT;
    this.cur.result = won ? 1 : 0;      // 勝ち→一覧に戻る / 負け→もう一度
    this.outcome = { rank: null, newBest: false };
    this.gained = null;
    this.snd.stopBgm();
    if (!won) { this.snd.lose(); return; }
    this.snd.win();
    if (b.usedInvincible) return;        // 無敵を使った戦闘は、ランクも記録も付けない
    const rank = rankOf(b.time, this.enemy.rankSec);
    const old = this.save.records[this.enemy.id];
    const newBest = !old || b.time < old.bestTime;
    this.save.records[this.enemy.id] = {
      bestTime: newBest ? b.time : old.bestTime,
      bestRank: !old || rankValue(rank) > rankValue(old.bestRank) ? rank : old.bestRank,
    };
    const drop = this.enemy.drop;
    if (drop) { this.save.loot[drop.id] = (this.save.loot[drop.id] ?? 0) + 1; this.gained = drop; }
    storeSave(this.save);
    this.outcome = { rank, newBest };
  }

  // ---------------- 入力 ----------------
  private move(key: keyof GameScene['cur'], d: number, n: number, skip: (i: number) => boolean = () => false) {
    let i = this.cur[key];
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!skip(i)) break; }
    if (i !== this.cur[key]) { this.cur[key] = i; this.snd.uiMove(); }
  }

  private handle(b: Btn) {
    this.snd.unlock();
    if (b === 'mute') { this.snd.toggleMute(); return; }
    if (b === 'touchpad') { this.invincible = !this.invincible; this.battle.invincible = this.invincible; this.snd.keep(this.invincible); return; }
    const ok = b === 'circle' || b === 'ok', back = b === 'cross' || b === 'back';
    const bt = this.battle;

    switch (this.top) {
      case 'list':
        if (b === 'up') this.move('list', -1, ENEMIES.length);
        else if (b === 'down') this.move('list', 1, ENEMIES.length);
        else if (ok) {
          const e = ENEMIES[this.cur.list];
          if (!this.unlocked(e)) this.snd.miss(); else { this.snd.uiOk(); this.toReady(e); }
        } else if (b === 'options') { this.cur.menu = 0; this.overlays.push('menu'); this.snd.uiOk(); }
        break;

      case 'ready':
        if (ok) { this.base = 'fight'; this.snd.startBgm(); this.snd.refill(); }   // 開始するだけ。○のカードは出さない
        else if (back) { this.snd.uiBack(); this.toList(); }
        else if (b === 'l2') { if (bt.cycleItem()) this.snd.uiMove(); }
        else if (b === 'options') { this.cur.menu = 0; this.overlays.push('menu'); this.snd.uiOk(); }
        break;

      case 'fight': {
        const c = CARD_BTN.indexOf(b), k = KEEP_BTN.indexOf(b);
        if (c >= 0) bt.press(c);
        else if (k >= 0) bt.toggleKeep(k);
        else if (b === 'skip') bt.skip();
        else if (b === 'l2') { if (bt.cycleItem()) this.snd.uiMove(); }
        else if (b === 'r2') bt.useSelected();
        else if (b === 'options') { this.cur.pause = 0; this.overlays.push('pause'); this.snd.stopBgm(); this.snd.uiOk(); }
        break;
      }

      case 'pause':
        if (b === 'up') this.move('pause', -1, PAUSE.length);
        else if (b === 'down') this.move('pause', 1, PAUSE.length);
        else if (back || b === 'options' || (ok && this.cur.pause === 0)) { this.overlays = ['resume']; this.resumeLeft = RULES.resumeCountSec; this.snd.count(); }
        else if (ok && this.cur.pause === 1) { this.snd.uiOk(); this.toReady(this.enemy); }
        else if (ok && this.cur.pause === 2) { this.snd.uiBack(); this.toList(); }
        break;

      case 'resume': break;   // カウント中は操作を受け付けない

      case 'result':
        if (this.resultWait > 0) break;
        if (b === 'left' || b === 'right') this.move('result', b === 'left' ? -1 : 1, 2);
        else if (ok) { this.snd.uiOk(); if (this.cur.result === 0) this.toReady(this.enemy); else this.toList(); }
        break;

      case 'menu':
        if (b === 'up') this.move('menu', -1, MENU.length, i => !!MENU[i].off);
        else if (b === 'down') this.move('menu', 1, MENU.length, i => !!MENU[i].off);
        else if (back || b === 'options') { this.snd.uiBack(); this.pop(); }
        else if (ok) {
          const act = MENU[this.cur.menu].act;
          if (act === 'close') { this.snd.uiBack(); this.pop(); }
          else if (act) {
            this.snd.uiOk();
            if (act === 'equip') { this.cur.slot = 0; this.equipFocus = 'slots'; }
            if (act === 'deck') this.cur.deck = 0;
            if (act === 'shop') { this.cur.shop = 0; this.cur.sell = 0; this.shopTab = 0; }
            if (act === 'reset') this.cur.reset = 0;
            this.overlays.push(act);
          }
        }
        break;

      case 'equip':
        if (this.equipFocus === 'slots') {
          if (b === 'up') this.move('slot', -1, EQUIP_ROWS.length, i => i === 2);
          else if (b === 'down') this.move('slot', 1, EQUIP_ROWS.length, i => i === 2);
          else if (ok) { this.equipFocus = 'options'; this.cur.opt = Math.max(0, this.equipOptions().findIndex(o => o.on)); this.snd.uiOk(); }
          else if (back) { this.snd.uiBack(); this.pop(); }
        } else {
          const opts = this.equipOptions();
          if (b === 'up') this.move('opt', -1, opts.length);
          else if (b === 'down') this.move('opt', 1, opts.length);
          else if (ok) { opts[this.cur.opt].pick(); storeSave(this.save); this.equipFocus = 'slots'; this.snd.uiOk(); }
          else if (back) { this.equipFocus = 'slots'; this.snd.uiBack(); }
        }
        break;

      case 'deck':
        if (b === 'up') this.move('deck', -1, SPELLS.length);
        else if (b === 'down') this.move('deck', 1, SPELLS.length);
        else if (back || b === 'options') { this.snd.uiBack(); this.pop(); }
        else if (ok) {
          const id = SPELLS[this.cur.deck].id, sp = this.save.spells;
          if (sp.includes(id)) { this.save.spells = sp.filter(x => x !== id); this.snd.uiBack(); }
          else if (sp.length >= RULES.maxSpells) this.snd.miss();          // 2枚まで
          else { this.save.spells = SPELLS.map(c => c.id).filter(x => x === id || sp.includes(x)); this.snd.uiOk(); }
          storeSave(this.save);
        }
        break;

      case 'shop': {
        const sell = this.sellList();
        if (b === 'skip' || b === 'left' || b === 'right') { this.shopTab = this.shopTab ? 0 : 1; this.snd.uiMove(); }   // L1 / R1: 買う ⇔ 売る
        else if (back || b === 'options') { this.snd.uiBack(); this.pop(); }
        else if (this.shopTab === 0) {
          if (b === 'up') this.move('shop', -1, SHOP.length);
          else if (b === 'down') this.move('shop', 1, SHOP.length);
          else if (ok) {
            const g = SHOP[this.cur.shop], own = g.kind === 'weapon' ? this.save.weapons : this.save.armors;
            if (own.includes(g.def.id) || this.save.gold < (g.def.price ?? 0)) this.snd.miss();
            else { this.save.gold -= g.def.price ?? 0; own.push(g.def.id); this.snd.item('heal'); storeSave(this.save); }
          }
        } else {
          if (b === 'up' && sell.length) this.move('sell', -1, sell.length);
          else if (b === 'down' && sell.length) this.move('sell', 1, sell.length);
          else if (ok) {
            const d = sell[this.cur.sell];
            if (!d) this.snd.miss();
            else { this.save.gold += d.price * this.save.loot[d.id]; delete this.save.loot[d.id]; this.snd.uiOk(); this.cur.sell = Math.max(0, Math.min(this.cur.sell, sell.length - 2)); storeSave(this.save); }
          }
        }
        break;
      }

      case 'help':
        if (ok || back || b === 'options') { this.snd.uiBack(); this.pop(); }
        break;

      case 'reset':
        if (b === 'left' || b === 'right') this.move('reset', b === 'left' ? -1 : 1, 2);
        else if (back || (ok && this.cur.reset === 0)) { this.snd.uiBack(); this.pop(); }
        else if (ok) {
          clearSave();
          this.save = loadSave(SAVE_CONFIG);
          this.cur.list = 0; this.enemy = ENEMIES[0];
          this.snd.uiOk(); this.toList(); this.newBattle();
        }
        break;
    }
  }

  /** 装備画面で、選んでいる枠にセットできるものの一覧 */
  private equipOptions(): { id: string | null; name: string; on: boolean; note: string; desc: string; power?: number[]; pick: () => void }[] {
    const s = this.save, row = this.cur.slot;
    if (row === 0) return WEAPONS.filter(w => s.weapons.includes(w.id)).map(w => ({ id: null, name: w.name, on: s.weapon === w.id, note: s.weapon === w.id ? '装備中' : '', desc: w.desc, power: w.power, pick: () => { s.weapon = w.id; } }));
    if (row === 1) return ARMORS.filter(a => s.armors.includes(a.id)).map(a => ({ id: null, name: a.name, on: s.armor === a.id, note: s.armor === a.id ? '装備中' : '', desc: `被ダメージ −${a.def}${a.def > 0 ? '（最低1）' : ''}。${a.desc}`, pick: () => { s.armor = a.id; } }));
    const k = row - 3;
    return [null, ...ITEMS].map(o => {
      const at = o ? s.items.indexOf(o.id) : -1;
      return {
        id: o ? o.id : 'none', name: o ? o.name : 'はずす', on: (o ? o.id : null) === s.items[k],
        note: at === k ? 'セット中' : at >= 0 ? `アイテム ${at + 1} と入れ替え` : '',
        desc: o ? o.desc ?? '' : '枠を空にする。',
        // 同じアイテムは1つだけ: ほかの枠にあるものを選んだら、枠を入れ替える
        pick: () => { if (at >= 0 && at !== k) s.items[at] = s.items[k]; s.items[k] = o ? o.id : null; },
      };
    });
  }

  // ---------------- 毎フレーム ----------------
  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.clock += dt;
    for (const b of this.input2.poll()) this.handle(b);

    const bt = this.battle;
    if (this.top === 'fight') bt.update(dt);
    if (this.top === 'resume') {
      this.resumeLeft -= dt;
      if (this.resumeLeft <= 0) { this.overlays = []; this.snd.startBgm(); }
    }
    this.resultWait = Math.max(0, this.resultWait - dt);

    for (const e of bt.events) {
      if (e.kind === 'hit') {
        // ダブルの2発目は少し遅らせて、音・数字・揺れを2回に分ける
        this.time.delayedCall(e.index * 130, () => {
          this.enemyShake = e.lv === 4 ? 0.35 : 0.12;
          this.ringPulse = e.lv === 4 ? 0.4 : 0.18;
          if (e.lv === 4) this.cameras.main.shake(180, 0.006);
          this.snd.hit(e.lv, e.hits > 1);
          this.popup(String(e.damage), e.lv === 4 || e.hits > 1 ? '#ffd24a' : C.text, e.lv === 4 ? 42 : Math.min(40, 26 + e.damage * 2), MON.y - 60 - e.index * 26, MON.x + Phaser.Math.Between(-60, 60));
          if (e.bonus > 0) this.popup(`使い切り +${e.bonus}`, '#7fe0a0', 18, MON.y - 110, MON.x);
        });
      } else if (e.kind === 'miss') this.snd.miss();
      else if (e.kind === 'spell') this.snd.spell();
      else if (e.kind === 'skip') this.snd.skip();
      else if (e.kind === 'refill') this.snd.refill();
      else if (e.kind === 'keep') this.snd.keep(e.on);
      else if (e.kind === 'item') {
        this.snd.item(e.effect);
        const it = bt.items[e.slot];
        this.popup(e.effect === 'heal' ? '+20 HP' : it ? it.def.name : '', '#7fe0a0', 20, 180 + e.slot * 62, 150);
      } else if (e.kind === 'heal') { if (e.amount > 0) this.popup(`+${e.amount} HP`, '#7fe0a0', 20, 486, CX - 120); }
      else if (e.kind === 'chainBreak') { this.snd.chainBreak(); this.popup('チェイン切れ', C.warn, 15, CY - RING - 8, CX); }
      else if (e.kind === 'enemyCharge') { this.lastTick = 0; if (e.big && this.base === 'fight') this.snd.warn(); }
      else if (e.kind === 'enemyAttack') {
        this.hurt = e.big ? 0.6 : 0.35;
        this.cameras.main.shake(e.big ? 260 : 120, e.big ? 0.012 : 0.005);
        this.snd.enemyHit(e.big);
        this.popup(e.damage > 0 ? `-${e.damage}` : '無敵', e.damage > 0 ? '#ff6a6a' : '#ffd24a', e.big ? 32 : 22, 486, CX + 120);
      } else if (e.kind === 'win') this.finish(true);
      else if (e.kind === 'lose') this.finish(false);
    }
    bt.events.length = 0;

    // 強い攻撃の直前: 残り1.5秒・1.0秒・0.5秒でカウントダウン音
    const en = bt.enemy!, ea = bt.enemyAction!;
    if (this.top === 'fight' && ea.big && en.stunLeft <= 0) {
      const left = ea.chargeSec - en.gauge;
      const step = left <= 0.5 ? 1 : left <= 1.0 ? 2 : left <= 1.5 ? 3 : 0;
      if (step && step !== this.lastTick) { this.lastTick = step; this.snd.warnTick(step); }
    }
    this.snd.intensity = this.top === 'fight' ? bt.chain : 0;
    this.snd.update();
    this.enemyShake = Math.max(0, this.enemyShake - dt);
    this.ringPulse = Math.max(0, this.ringPulse - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.draw();
  }

  private popup(s: string, color: string, size: number, y: number, x: number) {
    if (!s || this.base !== 'fight') return;
    const t = this.add.text(x, y, s, { fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans JP","IPAGothic",sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(50).setResolution(ZOOM);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------------- 描画 ----------------
  private draw() {
    for (const l of this.L) l.begin();
    this.fx.clear();
    const [a, b, c] = this.L;
    if (this.base === 'list') this.drawList(a);
    else this.drawBattle(a);
    if (this.base === 'result') this.drawResult(b);
    this.overlays.forEach((o, i) => {
      const l = this.L[Math.min(2, i + 1)];
      if (o === 'menu') this.drawMenu(l);
      else if (o === 'equip') this.drawEquip(l);
      else if (o === 'deck') this.drawDeck(l);
      else if (o === 'shop') this.drawShop(l);
      else if (o === 'help') this.drawHelp(l);
      else if (o === 'reset') this.drawReset(l);
      else if (o === 'pause') this.drawPause(l);
      else if (o === 'resume') this.drawResume(l);
    });
    void c;
    for (const l of this.L) l.end();
  }

  private get pad() { return this.input2.padConnected; }
  private guide(l: Layer, padText: string, keyText: string) {
    l.rect(0, 508, W, 32, { fill: '#0a0c12' });
    l.text(920, 524, this.pad ? padText : keyText, 13, C.dim, 'end');
    const ps = this.input2.padStatus;
    const msg = ps === 'blocked' ? 'このページではゲームパッドを使えない。' : ps === 'nonstandard' ? 'ゲームパッドのボタン配置が標準と違う可能性あり。' : !this.snd.ready ? '音が出ないときは、画面を1回クリック。' : this.snd.muted ? '消音中（M キーで戻す）' : '';
    if (msg) l.text(40, 524, msg, 12, '#ffb04a', 'start');
  }
  private dim(l: Layer, alpha = 0.72) { l.rect(0, 0, W, H, { fill: '#05070b', alpha }); }
  private rankBadge(l: Layer, x: number, y: number, r: Rank, size: number) {
    l.circle(x, y, size / 2, { stroke: RANK_COL[r], sw: size / 10 });
    l.text(x, y, r, Math.round(size * 0.6), RANK_COL[r], 'middle', true);
  }
  private cursor(l: Layer, x: number, y: number) { l.text(x, y, '▶', 12, C.white); }
  /** 武器の威力を、レベルごとの札で並べる（C 1  B 2  A 3  S 10 を文字で詰めて書くと読みにくいため） */
  private powerChips(l: Layer, x: number, y: number, power: number[], alpha = 1) {
    power.forEach((v, i) => {
      const cx = x + i * 58;
      l.rect(cx, y - 10, 20, 20, { fill: C.attack, rx: 5, alpha });
      l.text(cx + 10, y, LEVEL_LABELS[i + 1], 12, C.text, 'middle', true, alpha);
      l.text(cx + 27, y, v, 15, C.text, 'start', true, alpha);
    });
  }
  /**
   * まとめて1つの枠に入った一覧を描く。行は細い線で区切り、選択中の行だけ帯で示す。
   * 各行の中心のy座標を返すので、呼び出し側はそこに中身を描く（文字は x+40 から）。
   */
  private rows(l: Layer, x: number, y: number, w: number, rowH: number, n: number, sel: number, o: { heads?: Record<number, string>; active?: boolean; dim?: boolean; extra?: number } = {}): number[] {
    const headH = 28, heads = o.heads ?? {}, active = o.active ?? true;
    l.rect(x, y, w, n * rowH + Object.keys(heads).length * headH + 12 + (o.extra ?? 0), { fill: C.panel, stroke: C.line, rx: 12, alpha: o.dim ? 0.55 : 1 });
    const ys: number[] = [];
    let yy = y + 6;
    for (let i = 0; i < n; i++) {
      if (heads[i] !== undefined) { l.text(x + 20, yy + headH / 2 + 2, heads[i], 11, C.dim, 'start', true); yy += headH; }
      else if (i > 0 && i !== sel && i - 1 !== sel) l.line(x + 20, yy, x + w - 20, yy, C.line, 1);
      if (i === sel) {
        l.rect(x + 6, yy + 2, w - 12, rowH - 4, { fill: C.sel, stroke: active ? C.white : C.line, rx: 8 });
        if (active) this.cursor(l, x + 22, yy + rowH / 2);
      }
      ys.push(yy + rowH / 2);
      yy += rowH;
    }
    return ys;
  }

  // --- 敵の一覧 ---
  private drawList(l: Layer) {
    l.text(40, 40, '敵を選ぶ', 24, C.text, 'start', true);
    l.text(920, 40, `所持金  ${this.save.gold} G`, 16, C.keep, 'end', true);
    const ys = this.rows(l, 40, 72, 400, 62, ENEMIES.length, this.cur.list);
    ENEMIES.forEach((e, i) => {
      const y = ys[i], on = i === this.cur.list, open = this.unlocked(e), rec = this.save.records[e.id];
      l.rect(78, y - 20, 40, 40, { fill: open ? ENEMY_COL[e.id] ?? C.dim : C.ng, rx: 8, alpha: 0.9 });
      l.text(98, y, open ? e.rank ?? '' : '？', 18, open ? C.ink : C.dim, 'middle', true);
      if (!open) {
        l.text(134, y - 10, '？？？', 17, C.dim, 'start', true);
        l.text(134, y + 12, '出現条件: 上の敵をすべて討伐', 11, C.dim, 'start');
        return;
      }
      l.text(134, y - 10, e.name, 17, C.text, 'start', on);
      l.text(134, y + 12, `HP ${e.hp}`, 11, C.dim, 'start');
      if (rec) {
        this.rankBadge(l, 406, y, rec.bestRank, 32);
        l.text(378, y - 10, '自己ベスト', 10, C.dim, 'end');
        l.text(378, y + 11, `${rec.bestTime.toFixed(1)}秒`, 15, C.text, 'end', true);
      } else l.text(418, y, '未討伐', 14, C.faint, 'end', true);
    });
    l.text(40, 414, 'アイテム', 12, C.dim, 'start');
    this.save.items.forEach((id, i) => {
      const it = itemOf(id), x = 40 + i * 136;
      l.rect(x, 428, 128, 40, { fill: it ? C.itemBg : C.panel, stroke: it ? C.item : C.ng, sw: 1.5, rx: 8 });
      l.image(iconKey(id), x + 22, 448, 26);
      l.text(x + 42, 448, it ? it.name : 'なし', 13, it ? C.text : C.faint, 'start');
    });

    // 右: 選択中の敵
    const e = ENEMIES[this.cur.list], open = this.unlocked(e), beaten = !!this.save.records[e.id];
    l.rect(470, 72, 450, 420, { fill: C.panel, stroke: C.line, rx: 12 });
    l.image(monsterKey(open ? e.id : 'unknown'), 800, 160, 186);
    if (!open) {
      l.text(494, 106, '？？？', 24, C.dim, 'start', true);
      l.text(494, 290, '上の敵をすべて討伐すると現れる。', 14, C.dim, 'start');
    } else {
      l.text(494, 106, e.name, 24, C.text, 'start', true);
      l.text(494, 136, `HP ${e.hp}`, 15, C.dim, 'start', true);
      l.text(494, 250, '攻撃パターン（上から順に繰り返し）', 12, C.dim, 'start');
      const pitch = Math.min(36, 196 / e.actions.length);
      e.actions.forEach((a, i) => {
        const y = 266 + i * pitch, h = pitch - 6;
        l.rect(494, y, 402, h, { fill: a.big ? '#3a1d20' : C.deep, stroke: a.big ? C.miss : undefined, sw: 1.5, rx: 6 });
        l.text(510, y + h / 2, (a.big ? '！ ' : '') + a.name, 14, a.big ? C.warn : C.text, 'start', !!a.big);
        if (beaten) {
          l.text(760, y + h / 2, `${a.chargeSec}秒`, 13, C.dim, 'end');
          l.text(880, y + h / 2, `${a.damage} ダメージ`, 13, a.big ? C.warn : C.text, 'end');
        } else l.text(880, y + h / 2, '？？？', 13, C.faint, 'end');
      });
      const sec = e.actions.reduce((s, a) => s + a.chargeSec, 0), dmg = e.actions.reduce((s, a) => s + a.damage, 0);
      if (beaten) l.text(494, 474, `1巡 約${Math.round(sec)}秒・計 ${dmg} ダメージ`, 12, C.dim, 'start');
      if (e.drop) l.text(896, 474, beaten ? `戦利品  ${e.drop.name}（${e.drop.price} G）` : '戦利品  ？？？', 12, C.dim, 'end');
    }
    this.guide(l, '↑↓ 選ぶ　　○ 決定　　OPTIONS メニュー', '↑↓ 選ぶ　　Enter 決定　　Esc メニュー');
  }

  // --- 開始前・戦闘（結果・ポーズの背景も兼ねる） ---
  private drawBattle(l: Layer) {
    const b = this.battle, e = b.enemy!, act = b.enemyAction!;
    const ready = this.base === 'ready', fight = this.base === 'fight' && this.overlays.length === 0;
    const hidden = !ready && !fight;            // ポーズ・再開待ち・結果: 手札と敵のゲージを隠す
    const big = fight && !!act.big && e.stunLeft <= 0;

    // 敵: 名前・HP・行動ゲージ
    const x = CX - 200, w = 400, sx = this.enemyShake > 0 ? Phaser.Math.Between(-5, 5) : 0;
    l.rect(x, 12, w, 134, { fill: C.panel, stroke: big ? C.miss : C.line, sw: big ? 4 : 2, rx: 10 });
    l.text(x + 18, 34, `${e.def.name}（${e.def.rank ?? ''}）`, 16, C.text, 'start', true);
    l.text(x + w - 18, 34, `${e.hp} / ${e.def.hp}`, 15, C.text, 'end', true);
    l.rect(x + 18, 50, w - 36, 16, { fill: C.bg });
    l.rect(x + 18, 50, (w - 36) * e.hp / e.def.hp, 16, { fill: C.attack });
    if (!hidden) {
      const stun = e.stunLeft > 0;
      l.text(x + 18, 92, stun ? 'スタン中' : (act.big ? '！ ' : '') + act.name, 14, stun ? '#5fb0e8' : big ? '#ff6a6a' : C.dim, 'start', true);
      if (!stun) l.text(x + w - 18, 92, `${act.damage}ダメージ  あと${Math.max(0, act.chargeSec - e.gauge).toFixed(1)}秒`, 13, big ? '#ff6a6a' : C.dim, 'end');
      l.rect(x + 18, 108, w - 36, 20, { fill: C.bg });
      const blink = big && Math.floor(this.clock * 6) % 2 ? 0.75 : 1;
      l.rect(x + 18, 108, (w - 36) * Phaser.Math.Clamp(e.gauge / act.chargeSec, 0, 1), 20, { fill: stun ? '#5fb0e8' : big ? C.miss : C.gauge, alpha: blink });
    }

    // 敵の絵。強い攻撃の溜め中は赤く光る
    const dead = b.result === 'won';
    if (big) l.ellipse(MON.x, MON.y, 250 + Math.sin(this.clock * 10) * 14, 250 + Math.sin(this.clock * 10) * 14, '#ff2a2a', 0.22);
    l.image(monsterKey(e.def.id), MON.x + sx, MON.y, MON.size, dead ? 0.3 : hidden ? 0.6 : 1, big ? 0xffb0a0 : undefined);

    // 手札
    const locked = b.lock > 0 && b.missLock;
    for (let i = 0; i < 4; i++) {
      const slot = b.slots[i], c = slot.card, p = POS[i], lx = p.x - CW / 2, ty = p.y - CH / 2;
      if (ready) {
        l.rect(lx, ty, CW, CH, { fill: C.panel, stroke: C.line, sw: 3, rx: 9 });
        l.text(p.x, p.y - 4, '?', 38, C.faint, 'middle', true);
        l.text(lx + 13, ty + 13, GLY[i], 13, C.white);
        continue;
      }
      if (hidden || !c) {
        l.rect(lx, ty, CW, CH, { stroke: C.line, rx: 9, alpha: 0.7 });
        if (!hidden && b.charging && b.chargeTotal > 0) {
          const pr = 1 - b.chargeLeft / b.chargeTotal;
          l.rect(lx, ty + CH * (1 - pr), CW, Math.max(CH * pr, 1), { fill: C.line, rx: 9, alpha: 0.6 });
        }
        l.text(lx + 13, ty + 13, GLY[i], 13, C.dim);
        continue;
      }
      const ok = b.canPlay(c) && !locked, al = ok ? 1 : 0.45;
      l.rect(lx, ty, CW, CH, { fill: c.type === 'spell' ? C.spell : C.attack, rx: 9, alpha: ok ? 0.95 : 0.22 });
      l.rect(lx, ty, CW, CH, { stroke: slot.kept ? C.keep : ok ? C.white : C.ng, sw: slot.kept ? 5 : 3, rx: 9 });
      l.text(p.x, p.y - 14, this.cardBig(c), 38, C.text, 'middle', true, al);
      l.text(p.x, p.y + 18, c.type === 'attack' ? `威力 ${b.powerOf(c.lv!)}` : c.name, 12, C.text, 'middle', false, al);
      if (c.type === 'spell') l.text(p.x, p.y + 38, c.desc ?? '', 9, '#f2f4f8', 'middle', false, al);
      l.text(lx + 13, ty + 13, GLY[i], 13, C.white, 'middle', false, al);
      if (slot.kept) l.text(lx + CW - 22, ty + 13, 'KEEP', 10, C.keep, 'middle', true);
    }

    // 中央の輪
    if (ready) {
      l.circle(CX, CY, RING, { fill: C.keep, alpha: 0.16 });
      l.circle(CX, CY, RING, { stroke: C.keep, sw: 4 });
      l.text(CX, CY - 12, 'START', 17, C.keep, 'middle', true);
      l.text(CX, CY + 16, this.pad ? '○' : 'Enter', this.pad ? 24 : 15, C.keep, 'middle', true);
    } else {
      const col = locked ? C.miss : CHAIN_COL[b.chain], chain = hidden ? 0 : b.chain;
      l.circle(CX, CY, RING + this.ringPulse * 20, { fill: col, alpha: chain > 0 ? 0.2 : 0.08 });
      l.circle(CX, CY, RING, { stroke: C.line, sw: 3 });
      if (!hidden) {
        const ratio = b.chain > 0 ? b.chainTimer / RULES.chainTimerSec : 0;
        l.arc(CX, CY, RING, ratio, ratio < 0.34 ? C.miss : col, 6);
        const waiting = !locked && b.lock > 0.15;   // 斧などの待ち
        l.text(CX, CY - 27, locked ? 'ミス' : waiting ? '構え' : b.charging && b.chargeTotal > 0.2 ? '入れ替え中' : 'CHAIN', 10, locked ? C.miss : waiting ? C.keep : C.dim, 'middle', true);
        l.text(CX, CY - 1, locked ? '✕' : b.chain > 0 ? LEVEL_LABELS[b.chain] : '–', 36, locked ? C.miss : b.chain > 0 ? col : C.dim, 'middle', true).setScale(1 + this.ringPulse * 1.2);
        // 次のアタックにかかる効果（カードと同じ記号）
        const marks = (Object.keys(MARK) as (keyof typeof b.buffs)[]).filter(k => b.buffs[k] > 0).map(k => MARK[k]);
        marks.forEach((m, i) => {
          const mw = marks.length > 2 ? 20 : 26, gap = marks.length > 2 ? 2 : 4, x0 = CX - (marks.length * (mw + gap) - gap) / 2 + i * (mw + gap);
          l.rect(x0, CY + 17, mw, 18, { fill: C.spell, rx: 6 });
          l.text(x0 + mw / 2, CY + 26, m, 12, C.white, 'middle', true);
        });
      }
    }

    // 自分のHP（手札の下）
    const low = b.hp <= RULES.playerMaxHp * 0.3, hw = 320, hx = CX - hw / 2;
    l.text(hx, 500, b.invincible ? 'HP　無敵（テスト用）' : 'HP', 12, b.invincible ? C.keep : C.dim, 'start', true);
    l.text(hx + hw, 500, `${b.hp} / ${RULES.playerMaxHp}`, 15, low ? '#ff6a6a' : C.text, 'end', true);
    l.rect(hx, 512, hw, 14, { fill: C.panel, rx: 4 });
    l.rect(hx, 512, hw * b.hp / RULES.playerMaxHp, 14, { fill: low ? C.miss : C.item, rx: 4 });

    // アイテム（左）
    l.text(30, 178, 'アイテム', 12, C.dim, 'start', true);
    l.text(270, 178, this.pad ? 'L2 で切り替え' : 'Q で切り替え', 11, C.dim, 'end');
    b.items.forEach((it, i) => {
      const y = 192 + i * 62, live = !!it && !it.used, on = i === b.selected && live && !hidden;
      l.rect(30, y, 240, 54, { fill: live ? C.itemBg : C.panel, stroke: on ? C.white : live ? C.item : C.ng, sw: on ? 3 : 1.5, rx: 9, alpha: live ? 1 : 0.7 });
      if (!it) { l.text(150, y + 27, 'なし', 13, C.faint); return; }
      const al = live ? 1 : 0.4, def = it.def as ItemDef & { short?: string };
      l.image(iconKey(def.id), 50, y + 19, 20, al);
      l.text(66, y + 19, def.name, 15, C.text, 'start', true, al);
      l.text(44, y + 39, it.used ? '使用済み' : def.short ?? '', 11, C.dim, 'start', false, al);
      if (on) {
        this.cursor(l, 18, y + 27);
        if (!ready) { l.rect(214, y + 14, 44, 26, { fill: C.white, rx: 6 }); l.text(236, y + 27, this.pad ? 'R2' : 'E', 13, C.ink, 'middle', true); }
      }
    });
    // 時間で切れる効果（左下）
    const timers: [string, number, number, string][] = [];
    if (b.rageLeft > 0) timers.push(['強化薬', b.rageLeft, 10, '#ff8a6a']);
    if (b.sandLeft > 0) timers.push(['時の砂', b.sandLeft, 10, '#b9a3ea']);
    timers.forEach(([name, left, total, col], i) => {
      const y = 396 + i * 36;
      l.text(30, y, name, 13, col, 'start', true);
      l.text(270, y, `${left.toFixed(1)}秒`, 14, col, 'end', true);
      l.rect(30, y + 12, 240, 6, { fill: C.panel });
      l.rect(30, y + 12, 240 * left / total, 6, { fill: col });
    });

    if (ready) l.text(930, 520, this.pad ? '✕ 戻る　　OPTIONS メニュー' : 'Backspace 戻る　　Esc メニュー', 12, C.dim, 'end');

    // 被弾の赤いフラッシュと、強い攻撃の予告（画面の縁と手札の中央が赤く点滅）
    if (this.hurt > 0 && fight) this.fx.fillStyle(0xff2a2a, Math.min(0.35, this.hurt * 0.7)).fillRect(0, 0, W, H);
    if (big) {
      const left = act.chargeSec - e.gauge, near = left <= 1.5;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * (near ? 22 : 9));
      const th = (near ? 20 : 10) + pulse * (near ? 10 : 5), alpha = (near ? 0.5 : 0.28) + pulse * 0.3;
      this.fx.fillStyle(0xff2a2a, alpha);
      this.fx.fillRect(0, 0, W, th).fillRect(0, H - th, W, th).fillRect(0, th, th, H - th * 2).fillRect(W - th, th, th, H - th * 2);
      this.fx.lineStyle(near ? 5 : 3, 0xff2a2a, alpha).strokeCircle(CX, CY, RING + 12 + pulse * 5);
    }
  }
  private cardBig(c: Card) { return c.type === 'attack' ? LEVEL_LABELS[c.lv!] : MARK[c.effect!] ?? '?'; }

  // --- 結果 ---
  private drawResult(l: Layer) {
    const b = this.battle, won = b.result === 'won';
    this.dim(l, 0.5);
    l.rect(CX - 230, 150, 460, 336, { fill: C.panel, stroke: won ? C.line : C.miss, rx: 12 });
    l.text(CX, 190, won ? `${this.enemy.name} 討伐` : '敗北', 24, won ? C.text : C.warn, 'middle', true);
    if (won) {
      l.text(CX - 190, 252, '討伐タイム', 13, C.dim, 'start');
      l.text(CX + 120, 252, `${b.time.toFixed(1)} 秒`, 30, C.text, 'end', true);
      if (this.outcome.rank) this.rankBadge(l, CX + 164, 252, this.outcome.rank, 52);
      if (this.outcome.newBest) { l.rect(CX + 16, 280, 104, 22, { fill: C.keep, rx: 11 }); l.text(CX + 68, 291, '自己ベスト更新', 11, C.ink, 'middle', true); }
      else if (b.usedInvincible) l.text(CX + 120, 291, '無敵使用のため記録なし', 11, C.keep, 'end');
      l.line(CX - 190, 314, CX + 190, 314, C.line);
      l.text(CX - 190, 336, '残りHP', 13, C.dim, 'start');
      l.text(CX + 190, 336, b.hp, 16, C.text, 'end', true);
      l.text(CX - 190, 362, '最大ダメージ（1ターン）', 13, C.dim, 'start');
      l.text(CX + 190, 362, b.stats.maxTurn, 16, C.text, 'end', true);
      l.text(CX - 190, 388, '戦利品', 13, C.dim, 'start');
      l.text(CX + 190, 388, this.gained ? `${this.gained.name} ×1` : 'なし', 15, this.gained ? C.keep : C.faint, 'end', true);
    } else {
      l.text(CX - 190, 262, `${this.enemy.name} の残りHP`, 13, C.dim, 'start');
      l.text(CX + 190, 262, `${b.enemy!.hp} / ${this.enemy.hp}`, 22, C.text, 'end', true);
      l.line(CX - 190, 318, CX + 190, 318, C.line);
      l.text(CX - 190, 344, '経過時間', 13, C.dim, 'start');
      l.text(CX + 190, 344, `${b.time.toFixed(1)} 秒`, 16, C.text, 'end', true);
      l.text(CX - 190, 376, '最大ダメージ（1ターン）', 13, C.dim, 'start');
      l.text(CX + 190, 376, b.stats.maxTurn, 16, C.text, 'end', true);
    }
    const ready = this.resultWait <= 0;
    ['もう一度', '一覧に戻る'].forEach((label, i) => {
      const on = ready && i === this.cur.result, x = i === 0 ? CX - 206 : CX + 10;
      l.rect(x, 418, 196, 44, { fill: on ? C.sel : undefined, stroke: on ? C.white : C.line, rx: 8 });
      l.text(x + 98, 440, label, 16, C.text, 'middle', on, ready ? 1 : 0.4);
    });
    this.guide(l, '←→ 選ぶ　　○ 決定', '←→ 選ぶ　　Enter 決定');
  }

  // --- メニュー類 ---
  private panel(l: Layer, title: string, rows: { label: string; off?: boolean; note?: string }[], sel: number, y0: number, w = 340) {
    const pitch = rows.length > 6 ? 46 : 50, h = 74 + rows.length * pitch, x = CX - w / 2;
    l.rect(x, y0, w, h, { fill: C.panel, stroke: C.line, rx: 12 });
    l.text(CX, y0 + 34, title, 18, C.text, 'middle', true);
    rows.forEach((r, i) => {
      const y = y0 + 62 + i * pitch, on = i === sel;
      if (on) { l.rect(x + 20, y, w - 40, 40, { fill: C.sel, stroke: C.white, rx: 8 }); this.cursor(l, x + 38, y + 20); }
      l.text(x + 58, y + 20, r.label, 16, r.off ? C.faint : C.text, 'start', on);
      if (r.note) l.text(x + w - 34, y + 20, r.note, 11, C.faint, 'end');
    });
  }
  private drawMenu(l: Layer) {
    this.dim(l);
    this.panel(l, 'メニュー', MENU.map(m => ({ label: m.label, off: m.off, note: m.off ? '準備中' : undefined })), this.cur.menu, 44);
    this.guide(l, '↑↓ 選ぶ　　○ 決定　　✕ / OPTIONS 閉じる', '↑↓ 選ぶ　　Enter 決定　　Backspace / Esc 閉じる');
  }
  private drawPause(l: Layer) {
    this.dim(l, 0.6);
    this.panel(l, 'PAUSE', PAUSE.map((label, i) => ({ label, note: i === 2 ? '一覧に戻る' : undefined })), this.cur.pause, 150);
    this.guide(l, '↑↓ 選ぶ　　○ 決定　　✕ / OPTIONS 再開', '↑↓ 選ぶ　　Enter 決定　　Backspace / Esc 再開');
  }
  private drawResume(l: Layer) {
    this.dim(l, 0.35);
    l.circle(CX, CY, 70, { fill: C.bg, alpha: 0.9 });
    l.circle(CX, CY, 70, { stroke: C.keep, sw: 4 });
    l.text(CX, CY - 18, 'READY', 18, C.keep, 'middle', true);
    l.text(CX, CY + 18, Math.max(0, this.resumeLeft).toFixed(1), 26, C.keep, 'middle', true);
  }
  private drawReset(l: Layer) {
    this.dim(l, 0.55);
    l.rect(CX - 250, 170, 500, 216, { fill: C.panel, stroke: C.miss, rx: 12 });
    l.text(CX, 206, 'セーブデータを消しますか？', 19, C.text, 'middle', true);
    l.text(CX, 244, '装備、所持金、持ち物、記録がすべて消えます。', 13, C.dim);
    l.text(CX, 268, '元に戻せません。', 13, C.warn);
    ['いいえ', 'はい、消す'].forEach((label, i) => {
      const on = i === this.cur.reset, x = i === 0 ? CX - 216 : CX + 10;
      l.rect(x, 314, 206, 44, { fill: on ? C.sel : undefined, stroke: on ? C.white : i ? C.miss : C.line, rx: 8 });
      l.text(x + 103, 336, label, 16, i ? C.warn : C.text, 'middle', on);
    });
    this.guide(l, '←→ 選ぶ　　○ 決定　　✕ やめる', '←→ 選ぶ　　Enter 決定　　Backspace やめる');
  }
  private drawEquip(l: Layer) {
    l.rect(0, 0, W, H, { fill: C.bg });
    l.text(40, 40, '装備', 24, C.text, 'start', true);
    const slots = this.equipFocus === 'slots', s = this.save;
    const value = (i: number) => (i === 0 ? this.weapon.name : i === 1 ? this.armor.name : i === 2 ? '準備中' : itemOf(s.items[i - 3])?.name ?? 'なし');
    const ys = this.rows(l, 40, 72, 400, 50, EQUIP_ROWS.length, this.cur.slot, { heads: { 0: '装備', 3: 'アイテム（重複不可）' }, active: slots });
    EQUIP_ROWS.forEach((name, i) => {
      const y = ys[i], off = i === 2, v = value(i), empty = off || v === 'なし';
      l.text(80, y, name, 14, off ? C.faint : C.dim, 'start');
      l.text(418, y, v, 16, empty ? C.faint : C.text, 'end', i === this.cur.slot && !empty);
      if (i >= 3 && !empty) l.image(iconKey(s.items[i - 3]), 418 - v.length * 16 - 20, y, 26);
    });
    const opts = this.equipOptions(), shown = slots ? Math.max(0, opts.findIndex(o => o.on)) : this.cur.opt;
    const oy = this.rows(l, 470, 72, 450, 46, opts.length, shown, { heads: { 0: `${EQUIP_ROWS[this.cur.slot]} を選ぶ` }, active: !slots, dim: slots });
    opts.forEach((o, i) => {
      const y = oy[i], on = i === shown, al = slots ? 0.55 : 1;
      if (o.id) l.image(iconKey(o.id === 'none' ? null : o.id), 526, y, 28, al);
      l.text(o.id ? 550 : 510, y, o.name, 16, C.text, 'start', on, al);
      if (o.note) l.text(898, y, o.note, 11, C.dim, 'end');
    });
    const d = opts[shown];
    l.rect(470, 416, 450, 76, { fill: C.deep, stroke: C.line, rx: 10 });
    if (d?.id) l.image(iconKey(d.id === 'none' ? null : d.id), 506, 454, 44);
    l.text(d?.id ? 542 : 494, d?.power ? 436 : 440, d?.name ?? '', 15, C.text, 'start', true);
    if (d?.power) { this.powerChips(l, 690, 436, d.power); l.text(494, 470, d.desc, 12, C.dim, 'start'); }
    else l.text(d?.id ? 542 : 494, 468, d?.desc ?? '', 12, C.dim, 'start');
    this.guide(l, slots ? '↑↓ 選ぶ　　○ 変更　　✕ 戻る' : '↑↓ 選ぶ　　○ セット　　✕ やめる', slots ? '↑↓ 選ぶ　　Enter 変更　　Backspace 戻る' : '↑↓ 選ぶ　　Enter セット　　Backspace やめる');
  }

  private drawDeck(l: Layer) {
    l.rect(0, 0, W, H, { fill: C.bg });
    const sp = this.save.spells, p = this.weapon.power, nAtk = ATTACKS.reduce((n, c) => n + c.copies, 0);
    l.text(40, 40, 'カード編集', 24, C.text, 'start', true);
    l.text(920, 40, `デッキ ${nAtk + sp.length}枚　（アタック ${nAtk}　スペル ${sp.length}）`, 14, C.dim, 'end');
    // 左上: アタック（枚数は固定。威力は装備で決まる）
    const ay = this.rows(l, 40, 72, 400, 50, ATTACKS.length, -1, { heads: { 0: 'アタック（枚数は固定）' } });
    ATTACKS.forEach((c, i) => {
      const y = ay[i];
      l.rect(60, y - 16, 32, 32, { fill: C.attack, rx: 6 });
      l.text(76, y, LEVEL_LABELS[c.lv!], 18, C.text, 'middle', true);
      l.text(108, y, `威力 ${p[c.lv! - 1]}`, 15, C.text, 'start');
      l.text(418, y, `× ${c.copies}`, 17, C.text, 'end', true);
    });
    // 左下: 威力のもとになる装備
    const ey = this.rows(l, 40, 330, 400, 44, 2, -1, { heads: { 0: '装備' } });
    l.text(60, ey[0], '武器', 13, C.dim, 'start'); l.text(150, ey[0], this.weapon.name, 16, C.text, 'start', true);
    l.text(60, ey[1], 'アクセサリ', 13, C.dim, 'start'); l.text(150, ey[1], 'なし', 16, C.faint, 'start', true);
    // 右: スペル（2枚まで、重複不可）。枠の下部に説明
    const sy = this.rows(l, 470, 72, 450, 50, SPELLS.length, this.cur.deck, { heads: { 0: 'スペル（重複不可）' }, extra: 40 });
    const full = sp.length >= RULES.maxSpells;
    l.rect(828, 80, 72, 24, { fill: C.deep, stroke: full ? C.item : C.spell, sw: 1.5, rx: 12 });
    l.text(864, 92, `${sp.length} / ${RULES.maxSpells} 枚`, 12, C.text, 'middle', true);
    SPELLS.forEach((c, i) => {
      const y = sy[i], on = i === this.cur.deck, inDeck = sp.includes(c.id);
      l.rect(506, y - 16, 32, 32, { fill: C.spell, rx: 6, alpha: inDeck ? 1 : 0.35 });
      l.text(522, y, c.mark, 15, C.text, 'middle', true, inDeck ? 1 : 0.6);
      l.text(554, y, c.name, 16, inDeck ? C.text : C.dim, 'start', on || inDeck);
      l.rect(832, y - 12, 68, 24, { fill: inDeck ? C.item : undefined, stroke: inDeck ? undefined : C.ng, sw: 1.5, rx: 12 });
      l.text(866, y, inDeck ? '採用中' : '未採用', 11, inDeck ? C.ink : C.faint, 'middle', inDeck);
    });
    l.line(490, 310, 900, 310, C.line, 1);
    l.text(490, 330, 'スペルの効果は、次に出すアタックに乗る。重ね掛け可。', 12, C.dim, 'start');
    const d = SPELLS[this.cur.deck];
    l.rect(470, 368, 450, 76, { fill: C.deep, stroke: C.line, rx: 10 });
    l.text(494, 392, d.name, 15, C.text, 'start', true);
    l.text(494, 420, d.long, 12, C.dim, 'start');
    this.guide(l, '↑↓ 選ぶ　　○ 入れる / 外す　　✕ 戻る', '↑↓ 選ぶ　　Enter 入れる / 外す　　Backspace 戻る');
  }

  private drawShop(l: Layer) {
    l.rect(0, 0, W, H, { fill: C.bg });
    const s = this.save, sell = this.sellList(), buying = this.shopTab === 0;
    l.text(40, 40, 'ショップ', 24, C.text, 'start', true);
    ['買う', '売る'].forEach((t, i) => {
      const x = 180 + i * 96, on = i === this.shopTab;
      l.rect(x, 22, 88, 36, { fill: on ? C.sel : undefined, stroke: on ? C.white : C.line, sw: on ? 2 : 1.5, rx: 18 });
      l.text(x + 44, 40, t, 16, on ? C.text : C.dim, 'middle', on);
    });
    l.text(388, 40, this.pad ? 'L1 / R1 で切り替え' : '←→ で切り替え', 11, C.dim, 'start');
    l.text(920, 40, `所持金  ${s.gold} G`, 16, C.keep, 'end', true);
    l.rect(470, 80, 450, 250, { fill: C.panel, stroke: C.line, rx: 12 });

    if (buying) {
      const firstArmor = SHOP.findIndex(g => g.kind === 'armor');
      const ys = this.rows(l, 40, 80, 400, 44, SHOP.length, this.cur.shop, { heads: { 0: '武器', [firstArmor]: '防具' } });
      SHOP.forEach((g, i) => {
        const own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id), poor = !own && s.gold < (g.def.price ?? 0);
        l.text(80, ys[i], g.def.name, 16, own ? C.dim : C.text, 'start', i === this.cur.shop);
        l.text(418, ys[i], own ? '購入済み' : `${g.def.price} G`, 15, own ? C.faint : poor ? C.warn : C.keep, 'end', true);
      });
      const g = SHOP[this.cur.shop], price = g.def.price ?? 0, own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id);
      l.text(494, 114, g.def.name, 22, C.text, 'start', true);
      l.text(896, 114, own ? '購入済み' : `${price} G`, 18, own ? C.faint : C.keep, 'end', true);
      if (g.kind === 'weapon') {
        // 選んでいる武器と、いまの武器を上下にそろえて比べる
        l.text(494, 162, g.def.name, 13, C.text, 'start', true);
        this.powerChips(l, 660, 162, g.def.power);
        l.text(494, 196, `現在: ${this.weapon.name}`, 12, C.dim, 'start');
        this.powerChips(l, 660, 196, this.weapon.power, 0.6);
      } else {
        l.text(494, 162, g.def.name, 13, C.text, 'start', true);
        l.text(660, 162, `被ダメージ −${g.def.def}（最低1）`, 15, C.text, 'start', true);
        l.text(494, 196, `現在: ${this.armor.name}`, 12, C.dim, 'start');
        l.text(660, 196, `被ダメージ −${this.armor.def}`, 15, C.dim, 'start', true);
      }
      l.text(494, 240, g.def.desc, 13, C.dim, 'start');
      l.text(494, 296, own ? '「装備」で着けられる。' : s.gold < price ? `あと ${price - s.gold} G 足りない。` : `${this.pad ? '○' : 'Enter'} で購入。「装備」で着ける。`, 12, own ? C.dim : s.gold < price ? C.warn : C.keep, 'start');
    } else if (!sell.length) {
      l.rect(40, 80, 400, 100, { fill: C.panel, stroke: C.line, rx: 12 });
      l.text(60, 116, '売れる物がない。', 14, C.dim, 'start');
      l.text(60, 144, '敵を討伐すると手に入る。', 13, C.faint, 'start');
      l.text(494, 114, '売る', 22, C.dim, 'start', true);
      l.text(494, 160, '戦利品をお金に換えられる。', 13, C.dim, 'start');
    } else {
      const ys = this.rows(l, 40, 80, 400, 44, sell.length, this.cur.sell, { heads: { 0: '戦利品' } });
      sell.forEach((d, i) => {
        l.text(80, ys[i], d.name, 16, C.text, 'start', i === this.cur.sell);
        l.text(320, ys[i], `×${s.loot[d.id]}`, 13, C.dim, 'end');
        l.text(418, ys[i], `+${d.price * s.loot[d.id]} G`, 15, C.item, 'end', true);
      });
      const d = sell[Math.min(this.cur.sell, sell.length - 1)], from = ENEMIES.find(e => e.drop?.id === d.id);
      l.text(494, 114, d.name, 22, C.text, 'start', true);
      l.text(494, 160, `1個 ${d.price} G`, 15, C.text, 'start', true);
      l.text(494, 190, `所持 ${s.loot[d.id]}個`, 13, C.dim, 'start');
      if (from) l.text(494, 240, `${from.name} の戦利品。`, 13, C.dim, 'start');
      l.text(494, 296, `${this.pad ? '○' : 'Enter'} ですべて売る（+${d.price * s.loot[d.id]} G）。`, 12, C.keep, 'start');
    }
    this.guide(l,
      buying ? '↑↓ 選ぶ　　○ 買う　　L1 / R1 売る　　✕ 戻る' : '↑↓ 選ぶ　　○ 売る　　L1 / R1 買う　　✕ 戻る',
      buying ? '↑↓ 選ぶ　　Enter 買う　　←→ 売る　　Backspace 戻る' : '↑↓ 選ぶ　　Enter 売る　　←→ 買う　　Backspace 戻る');
  }

  private drawHelp(l: Layer) {
    l.rect(0, 0, W, H, { fill: C.bg });
    l.text(40, 40, '操作説明', 24, C.text, 'start', true);
    const rows: [string, string, string][] = [
      ['カードを出す', '△ ○ ✕ □', 'W D S A（上・右・下・左）'], ['キープ / 解除', '十字キー', '矢印キー'], ['入れ替え', 'R1・L1', 'スペース'],
      ['アイテムを切り替える', 'L2', 'Q'], ['アイテムを使う', 'R2', 'E'], ['メニュー / ポーズ', 'OPTIONS', 'Esc'],
      ['決定 / 戻る（メニュー）', '○ / ✕', 'Enter / Backspace'], ['消音', '–', 'M'], ['無敵（テスト用）', 'タッチパッド', 'T'],
    ];
    l.rect(40, 72, 880, 30, { fill: C.panel, rx: 6 });
    l.text(60, 87, '操作', 12, C.dim, 'start', true); l.text(360, 87, 'ゲームパッド', 12, C.dim, 'start', true); l.text(620, 87, 'キーボード', 12, C.dim, 'start', true);
    rows.forEach((r, i) => {
      const y = 120 + i * 28;
      l.text(60, y, r[0], 14, C.text, 'start'); l.text(360, y, r[1], 14, C.text, 'start', true); l.text(620, y, r[2], 14, C.text, 'start', true);
    });
    const rules = [
      'カードは C → B → A → S の順。同じレベル・1つ下・C はいつでも出せる。S を出すとチェインは消える。',
      'スペルの効果は、次に出すアタックに乗る。重ね掛け可。',
      '入れ替えるとチェインが1段下がる。使い切れば下がらない。4枚目がアタックなら +1 ダメージ。',
      '出せるカードがなくなると、自動で入れ替わる。',
      'アイテムは3つまで。それぞれ1戦に1回。',
    ];
    l.text(40, 380, 'ルール', 12, C.dim, 'start', true);
    rules.forEach((r, i) => l.text(40, 402 + i * 21, r, 12, C.text, 'start'));
    this.guide(l, '✕ 戻る', 'Backspace 戻る');
  }
}
