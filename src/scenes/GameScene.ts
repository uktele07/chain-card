import Phaser from 'phaser';
import { Battle, type EnemyDef } from '../game/battle';
import { Input, type Btn } from '../game/input';
import { Sound } from '../game/audio';
import { ZOOM } from '../game/display';
import { Layer } from '../game/ui';
import { loadArt } from '../game/art';
import { clearSave, loadSave, rankOf, rankValue, storeSave, type Rank, type SaveData } from '../game/save';
import { buildDeck, gearOf } from '../game/loadout';
import { RULES, DEFS, SPELLS, WEAPONS, ARMORS, ITEMS, ENEMIES, itemOf, SAVE_CONFIG, SHOP } from '../game/content';
import { C, CX, CY, RING, CARD_BTN, KEEP_BTN, MON, RESULT_WAIT, MENU, PAUSE, EQUIP_ROWS, type Base, type Overlay, type Deal } from '../screens/common';
import { drawList } from '../screens/list';
import { drawBattle } from '../screens/battle';
import { drawResult } from '../screens/result';
import { drawMenu, drawPause, drawResume, drawReset, drawConfirm } from '../screens/menus';
import { drawEquip } from '../screens/equip';
import { drawDeck } from '../screens/deck';
import { drawShop } from '../screens/shop';
import { drawHelp } from '../screens/help';

/**
 * ゲーム全体の状態と入力を持つ。描画は src/screens/ の各画面に任せ、ここからは呼ぶだけ。
 * 画面側が状態を読めるよう、メンバーは公開している（書き換えるのはこのクラスの中だけ）。
 */
export class GameScene extends Phaser.Scene {
  input2!: Input;
  snd = new Sound();
  L: Layer[] = [];
  fx!: Phaser.GameObjects.Graphics;
  save!: SaveData;
  battle!: Battle;

  base: Base = 'list';
  overlays: Overlay[] = [];
  cur = { list: 0, menu: 0, pause: 0, result: 0, reset: 0, slot: 0, opt: 0, deck: 0, shop: 0, sell: 0 };
  shopTab: 0 | 1 = 0;       // 0=買う 1=売る
  deal: Deal | null = null;
  dealCursor = 0;           // 0=実行 1=やめる
  gained: { name: string; price: number } | null = null;   // 直前の戦闘で手に入れた換金アイテム
  equipFocus: 'slots' | 'options' = 'slots';
  enemy: EnemyDef = ENEMIES[0];
  invincible = false;       // テスト用。画面を移っても維持する
  resultWait = 0;
  resumeLeft = 0;
  outcome: { rank: Rank | null; newBest: boolean } = { rank: null, newBest: false };
  enemyShake = 0; ringPulse = 0; hurt = 0; lastTick = 0; clock = 0;

  constructor() { super('game'); }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.input2 = new Input();
    this.L = [new Layer(this, 0), new Layer(this, 100), new Layer(this, 200), new Layer(this, 300)];
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
  get top(): Base | Overlay { return this.overlays[this.overlays.length - 1] ?? this.base; }
  /** 一覧でこれより前の敵をすべて倒していれば出現 */
  unlocked(e: EnemyDef) { return e.unlock !== 'prev' || ENEMIES.slice(0, ENEMIES.indexOf(e)).every(o => this.save.records[o.id]); }
  get weapon() { return WEAPONS.find(w => w.id === this.save.weapon) ?? WEAPONS[0]; }
  get armor() { return ARMORS.find(a => a.id === this.save.armor) ?? ARMORS[0]; }
  sellList() { return ENEMIES.map(e => e.drop).filter((d): d is NonNullable<EnemyDef['drop']> => !!d && (this.save.loot[d.id] ?? 0) > 0); }

  newBattle() {
    this.battle = new Battle(buildDeck(DEFS, this.save.spells), RULES, Math.random, this.save.items.map(itemOf), this.enemy, gearOf(this.weapon, this.armor));
    this.battle.invincible = this.invincible;
    this.battle.events.length = 0;
    this.lastTick = 0; this.hurt = 0;
    (window as unknown as Record<string, unknown>).__battle = this.battle;
  }
  toList() { this.base = 'list'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; }
  toReady(e: EnemyDef) { this.enemy = e; this.base = 'ready'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; this.newBattle(); }
  pop() {
    this.overlays.pop();
    if (this.overlays.length === 0 && this.base === 'ready') this.newBattle();   // 装備を変えたかもしれないので作り直す
  }

  finish(won: boolean) {
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
  move(key: keyof GameScene['cur'], d: number, n: number, skip: (i: number) => boolean = () => false) {
    let i = this.cur[key];
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!skip(i)) break; }
    if (i !== this.cur[key]) { this.cur[key] = i; this.snd.uiMove(); }
  }

  handle(b: Btn) {
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
        const sell = this.sellList(), sellRows = sell.length ? sell.length + 1 : 0;   // 最後の行は「すべて売る」
        if (b === 'skip' || b === 'left' || b === 'right') { this.shopTab = this.shopTab ? 0 : 1; this.snd.uiMove(); }   // L1 / R1: 買う ⇔ 売る
        else if (back || b === 'options') { this.snd.uiBack(); this.pop(); }
        else if (this.shopTab === 0) {
          if (b === 'up') this.move('shop', -1, SHOP.length);
          else if (b === 'down') this.move('shop', 1, SHOP.length);
          else if (ok) {
            const g = SHOP[this.cur.shop], own = g.kind === 'weapon' ? this.save.weapons : this.save.armors;
            if (own.includes(g.def.id) || this.save.gold < (g.def.price ?? 0)) this.snd.miss();
            else this.openDeal({ kind: 'buy', index: this.cur.shop });
          }
        } else {
          if (b === 'up' && sellRows) this.move('sell', -1, sellRows);
          else if (b === 'down' && sellRows) this.move('sell', 1, sellRows);
          else if (ok) {
            if (!sellRows) this.snd.miss();
            else if (this.cur.sell >= sell.length) this.openDeal({ kind: 'sellAll' });
            else this.openDeal({ kind: 'sell', id: sell[this.cur.sell].id, qty: 1 });
          }
        }
        break;
      }

      case 'confirm': {
        const d = this.deal;
        if (!d) { this.pop(); break; }
        if (b === 'left' || b === 'right') { this.dealCursor = this.dealCursor ? 0 : 1; this.snd.uiMove(); }
        else if (d.kind === 'sell' && (b === 'up' || b === 'down')) {       // 上下で売る個数を変える
          const max = this.save.loot[d.id] ?? 1;
          d.qty = ((d.qty - 1 + (b === 'up' ? 1 : -1) + max) % max) + 1;
          this.snd.uiMove();
        } else if (back || (ok && this.dealCursor === 1)) { this.snd.uiBack(); this.deal = null; this.pop(); }
        else if (ok) {
          const sv = this.save;
          if (d.kind === 'buy') {
            const g = SHOP[d.index];
            sv.gold -= g.def.price ?? 0;
            (g.kind === 'weapon' ? sv.weapons : sv.armors).push(g.def.id);
            this.snd.item('heal');
          } else {
            for (const x of this.sellList()) {
              if (d.kind === 'sell' && x.id !== d.id) continue;
              const n = d.kind === 'sell' ? Math.min(d.qty, sv.loot[x.id]) : sv.loot[x.id];
              sv.gold += x.price * n;
              sv.loot[x.id] -= n;
              if (sv.loot[x.id] <= 0) delete sv.loot[x.id];
            }
            const left = this.sellList().length;
            this.cur.sell = Math.max(0, Math.min(this.cur.sell, left));     // 行が減ったらカーソルを収める
            this.snd.uiOk();
          }
          storeSave(sv);
          this.deal = null; this.pop();
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

  openDeal(d: Deal) { this.deal = d; this.dealCursor = 0; this.overlays.push('confirm'); this.snd.uiOk(); }

  /** 装備画面で、選んでいる枠にセットできるものの一覧 */
  equipOptions(): { id: string | null; name: string; on: boolean; note: string; desc: string; power?: number[]; def?: number; pick: () => void }[] {
    const s = this.save, row = this.cur.slot;
    if (row === 0) return WEAPONS.filter(w => s.weapons.includes(w.id)).map(w => ({ id: null, name: w.name, on: s.weapon === w.id, note: s.weapon === w.id ? '装備中' : '', desc: w.desc, power: w.power, pick: () => { s.weapon = w.id; } }));
    if (row === 1) return ARMORS.filter(a => s.armors.includes(a.id)).map(a => ({ id: null, name: a.name, on: s.armor === a.id, note: s.armor === a.id ? '装備中' : '', desc: a.desc, def: a.def, pick: () => { s.armor = a.id; } }));
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

  popup(s: string, color: string, size: number, y: number, x: number) {
    if (!s || this.base !== 'fight') return;
    const t = this.add.text(x, y, s, { fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans JP","IPAGothic",sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(50).setResolution(ZOOM);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------------- 描画 ----------------
  draw() {
    for (const l of this.L) l.begin();
    this.fx.clear();
    const [a, b] = this.L;
    if (this.base === 'list') drawList(this, a);
    else drawBattle(this, a);
    if (this.base === 'result') drawResult(this, b);
    this.overlays.forEach((o, i) => {
      const l = this.L[Math.min(3, i + 1)];
      if (o === 'menu') drawMenu(this, l);
      else if (o === 'equip') drawEquip(this, l);
      else if (o === 'deck') drawDeck(this, l);
      else if (o === 'shop') drawShop(this, l);
      else if (o === 'confirm') drawConfirm(this, l);
      else if (o === 'help') drawHelp(this, l);
      else if (o === 'reset') drawReset(this, l);
      else if (o === 'pause') drawPause(this, l);
      else if (o === 'resume') drawResume(this, l);
    });
    for (const l of this.L) l.end();
  }

  get pad() { return this.input2.padConnected; }

}
