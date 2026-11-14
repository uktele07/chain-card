import Phaser from 'phaser';
import data from '../../data/cards.json';
import { Battle, LEVEL_LABELS, type Card, type CardDef, type EnemyDef, type ItemDef, type Rules } from '../game/battle';
import { Input } from '../game/input';
import { Sound } from '../game/audio';
import { W, H, ZOOM } from '../game/display';

const RULES = data.rules as unknown as Rules;
const DEFS = data.cards as CardDef[];
const ITEMS = data.items as ItemDef[];
const ENEMY = (data.enemies as EnemyDef[]).find(e => e.id === data.rules.defaultEnemy)!;

const FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "IPAGothic", sans-serif';
const COL = {
  panel: 0x171c26, line: 0x2c3442, text: '#e6e9ef', dim: '#8a93a3',
  attack: 0xd9534a, spell: 0x4a8fd9, item: 0x4fae6a, enemyHp: 0xd9534a, gauge: 0xe0b040,
  keep: 0xf2c230, ok: 0xffffff, ng: 0x3a4250, miss: 0xff5a5a,
};
// チェインの段ごとの色（C→B→A→S で熱くなる）
const CHAIN_COL = [0x3a4250, 0x5fb0e8, 0x6fd08a, 0xf2a23a, 0xff5a4a];
const CHAIN_HEX = ['#8a93a3', '#5fb0e8', '#6fd08a', '#f2a23a', '#ff6a5a'];
const TYPE_COLOR: Record<string, number> = { attack: COL.attack, spell: COL.spell };
const CARD_W = 118, CARD_H = 124;
const CX = 480, CY = 350;
const SLOT_POS = [{ x: CX, y: CY - 122 }, { x: CX + 158, y: CY }, { x: CX, y: CY + 122 }, { x: CX - 158, y: CY }];
const SLOT_GLYPH = ['△', '○', '✕', '□'];
const RING = 52;
const ITEM_BOX = [{ x: 40, y: 372, label: 'L2', key: 'Q' }, { x: 745, y: 372, label: 'R2', key: 'E' }];
const ITEM_W = 175, ITEM_H = 62;
const EN = { x: CX - 200, y: 12, w: 400, h: 134 };

interface SlotView {
  big: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text;
  glyph: Phaser.GameObjects.Text; keep: Phaser.GameObjects.Text; flash: number;
}
interface ItemView { label: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text }

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private input2!: Input;
  private sound2 = new Sound();
  private g!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private views: SlotView[] = [];
  private itemViews: ItemView[] = [];
  private itemPick: string[] = [...(data.rules.defaultItems as string[])];
  private started = false;
  private txt: Record<string, Phaser.GameObjects.Text> = {};
  private enemyShake = 0;
  private ringPulse = 0;
  private hurt = 0;

  constructor() { super('battle'); }

  private t(x: number, y: number, s: string, size: number, color = COL.text, origin = 0.5, bold = false) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', align: 'center' })
      .setOrigin(origin, 0.5).setDepth(2).setResolution(ZOOM);
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.input2 = new Input();
    this.g = this.add.graphics().setDepth(1);
    this.fx = this.add.graphics().setDepth(8);

    // 敵
    this.txt.enemy = this.t(EN.x + 18, EN.y + 22, '', 16, COL.text, 0, true);
    this.txt.enemyHp = this.t(EN.x + EN.w - 18, EN.y + 22, '', 15, COL.text, 1, true);
    this.txt.action = this.t(EN.x + 18, EN.y + 80, '', 14, COL.dim, 0, true);
    this.txt.actionSub = this.t(EN.x + EN.w - 18, EN.y + 80, '', 13, COL.dim, 1);

    // 左: HP・強化・L2
    this.t(40, 190, 'HP', 14, COL.dim, 0);
    this.txt.hp = this.t(215, 190, '', 15, COL.text, 1, true);
    this.t(40, 248, '次のアタックにかかる効果', 12, COL.dim, 0);
    this.txt.buffs = this.t(40, 272, '', 15, COL.text, 0);
    this.txt.sand = this.t(40, 318, '', 15, '#c9a6ff', 0, true);
    this.txt.hint = this.add.text(40, 452, '', { fontFamily: FONT, fontSize: '14px', color: '#ffd24a', lineSpacing: 6 }).setOrigin(0, 0).setDepth(2).setResolution(ZOOM);
    this.txt.audio = this.t(40, 500, '', 12, '#ffb04a', 0);
    this.txt.pad = this.t(40, 520, '', 12, COL.dim, 0);

    // 右: 記録・R2
    this.txt.time = this.t(920, 196, '', 34, COL.text, 1, true);
    this.t(920, 226, '経過時間', 12, COL.dim, 1);
    this.txt.stats = this.add.text(920, 250, '', { fontFamily: FONT, fontSize: '14px', color: COL.dim, align: 'right', lineSpacing: 6 }).setOrigin(1, 0).setDepth(2).setResolution(ZOOM);
    this.txt.help = this.add.text(920, 530, '', { fontFamily: FONT, fontSize: '12px', color: COL.dim, align: 'right', lineSpacing: 4 }).setOrigin(1, 1).setDepth(2).setResolution(ZOOM);

    for (const b of ITEM_BOX) {
      this.itemViews.push({
        label: this.t(b.x + 26, b.y + ITEM_H / 2, b.label, 17, COL.text, 0.5, true),
        name: this.t(b.x + 56, b.y + 21, '', 15, COL.text, 0, true),
        desc: this.t(b.x + 56, b.y + 43, '', 11, COL.dim, 0),
      });
    }

    // 手札
    for (let i = 0; i < 4; i++) {
      const { x, y } = SLOT_POS[i];
      this.views.push({
        big: this.t(x, y - 20, '', 44, COL.text, 0.5, true),
        name: this.t(x, y + 22, '', 13, COL.text),
        desc: this.t(x, y + 43, '', 11, COL.dim),
        glyph: this.t(x - CARD_W / 2 + 14, y - CARD_H / 2 + 14, SLOT_GLYPH[i], 15, COL.dim),
        keep: this.t(x + CARD_W / 2 - 24, y - CARD_H / 2 + 14, 'KEEP', 11, '#f2c230', 0.5, true),
        flash: 0,
      });
    }
    // 中央: 現在のチェイン
    this.txt.chain = this.t(CX, CY - 4, '', 50, COL.text, 0.5, true).setDepth(3);
    this.txt.chainSub = this.t(CX, CY + 31, '', 11, COL.dim).setDepth(3);

    this.txt.overlay = this.add.text(CX, 268, '', { fontFamily: FONT, fontSize: '17px', color: COL.text, align: 'center', lineSpacing: 9, backgroundColor: '#0d1017f0', padding: { x: 28, y: 22 } })
      .setOrigin(0.5).setDepth(10).setResolution(ZOOM);

    // タッチ・クリック: カード上端の帯でキープ、それ以外で出す。中央の丸でスキップ
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sound2.unlock();
      const x = p.worldX, y = p.worldY;
      if (this.battle.result !== 'playing') { this.input2.push({ kind: 'restart' }); return; }
      if (Phaser.Math.Distance.Between(x, y, CX, CY) <= RING) { this.input2.push({ kind: 'skip' }); return; }
      ITEM_BOX.forEach((b, slot) => { if (x >= b.x && x <= b.x + ITEM_W && y >= b.y && y <= b.y + ITEM_H) this.input2.push({ kind: 'item', slot }); });
      SLOT_POS.forEach((s, slot) => {
        if (Math.abs(x - s.x) > CARD_W / 2 || Math.abs(y - s.y) > CARD_H / 2) return;
        this.input2.push({ kind: y < s.y - CARD_H / 2 + 30 ? 'keep' : 'card', slot });
      });
    });
    window.addEventListener('keydown', () => this.sound2.unlock());
    (window as unknown as Record<string, unknown>).__sound = this.sound2;

    this.reset();
  }

  private reset() {
    const items = this.itemPick.map(id => ITEMS.find(d => d.id === id)!);
    this.battle = new Battle(DEFS, RULES, Math.random, items, ENEMY);
    this.battle.events.length = 0;
    this.started = false;
    this.hurt = 0;
    this.sound2.stopBgm();
    this.sound2.intensity = 0;
    (window as unknown as Record<string, unknown>).__battle = this.battle;
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;

    for (const a of this.input2.poll()) {
      this.sound2.unlock();
      if (a.kind === 'mute') { this.sound2.toggleMute(); continue; }
      if (a.kind === 'restart') { this.reset(); continue; }
      if (this.battle.result !== 'playing') continue;
      if (a.kind === 'item' && !this.started) {          // 開始前はアイテムを選び直す
        const k = ITEMS.findIndex(d => d.id === this.itemPick[a.slot]);
        this.itemPick[a.slot] = ITEMS[(k + 1) % ITEMS.length].id;
        this.sound2.keep(true);
        this.reset();
        continue;
      }
      if (!this.started) { this.started = true; this.sound2.startBgm(); }
      if (a.kind === 'card') this.battle.press(a.slot);
      else if (a.kind === 'keep') this.battle.toggleKeep(a.slot);
      else if (a.kind === 'item') this.battle.useItem(a.slot);
      else if (a.kind === 'skip') this.battle.skip();
    }
    const b = this.battle;
    if (this.started) b.update(dt);

    for (const e of b.events) {
      if (e.kind === 'hit') {
        this.enemyShake = e.lv === 4 ? 0.35 : 0.12;
        this.ringPulse = e.lv === 4 ? 0.4 : 0.18;
        if (e.lv === 4) this.cameras.main.shake(180, 0.006);
        this.sound2.hit(e.lv, e.powered);
        this.popup(String(e.damage), e.lv === 4 || e.powered ? '#ffd24a' : COL.text, e.lv === 4 ? 44 : 26 + e.damage * 2, EN.y + EN.h - 6);
      } else if (e.kind === 'miss') { this.views[e.slot].flash = 0.3; this.sound2.miss(); }
      else if (e.kind === 'spell') this.sound2.spell();
      else if (e.kind === 'skip') this.sound2.skip();
      else if (e.kind === 'refill') this.sound2.refill();
      else if (e.kind === 'keep') this.sound2.keep(e.on);
      else if (e.kind === 'item') {
        this.sound2.item(e.effect);
        const box = ITEM_BOX[e.slot];
        this.popup({ heal: '+20 HP', flash: 'スタン！', sand: '星の砂' }[e.effect] ?? '', '#7fe0a0', 22, box.y - 8, box.x + ITEM_W / 2);
      } else if (e.kind === 'chainBreak') { this.sound2.chainBreak(); this.popup('チェイン切れ', '#ff8a8a', 16, CY - RING - 6, CX); }
      else if (e.kind === 'enemyCharge') { if (e.big) this.sound2.warn(); }
      else if (e.kind === 'enemyAttack') {
        this.hurt = e.big ? 0.6 : 0.35;
        this.cameras.main.shake(e.big ? 260 : 120, e.big ? 0.012 : 0.005);
        this.sound2.enemyHit(e.big);
        this.popup(`-${e.damage}`, '#ff6a6a', e.big ? 34 : 24, 222, 128);
      } else if (e.kind === 'win') { this.sound2.stopBgm(); this.sound2.win(); }
      else if (e.kind === 'lose') { this.sound2.stopBgm(); this.sound2.lose(); }
    }
    b.events.length = 0;
    this.sound2.intensity = this.started && b.result === 'playing' ? b.chain : 0;
    this.sound2.update();
    this.enemyShake = Math.max(0, this.enemyShake - dt);
    this.ringPulse = Math.max(0, this.ringPulse - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.draw(dt);
  }

  private popup(s: string, color: string, size: number, y = 140, x = CX + Phaser.Math.Between(-90, 90)) {
    if (!s) return;
    const t = this.t(x, y, s, size, color, 0.5, true).setDepth(5);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private cardBig(c: Card) {
    if (c.type === 'attack') return LEVEL_LABELS[c.lv!];
    return { levelx: 'X', power: '×2' }[c.effect!] ?? '?';
  }

  private draw(dt: number) {
    const b = this.battle, g = this.g, pad = this.input2.padConnected;
    const e = b.enemy!, act = b.enemyAction!;
    g.clear();

    // 敵: HPと行動ゲージ
    const sx = this.enemyShake > 0 ? Phaser.Math.Between(-5, 5) : 0;
    const big = !!act.big && e.stunLeft <= 0;
    g.fillStyle(COL.panel).fillRoundedRect(EN.x + sx, EN.y, EN.w, EN.h, 10);
    g.lineStyle(big ? 4 : 2, this.enemyShake > 0 ? 0xffd24a : big ? COL.miss : COL.line).strokeRoundedRect(EN.x + sx, EN.y, EN.w, EN.h, 10);
    const bx = EN.x + 18 + sx, bw = EN.w - 36;
    g.fillStyle(0x0d1017).fillRect(bx, EN.y + 38, bw, 16);
    g.fillStyle(COL.enemyHp).fillRect(bx, EN.y + 38, bw * (e.hp / e.def.hp), 16);
    const ratioE = Phaser.Math.Clamp(e.gauge / act.chargeSec, 0, 1);
    g.fillStyle(0x0d1017).fillRect(bx, EN.y + 96, bw, 20);
    g.fillStyle(e.stunLeft > 0 ? 0x5fb0e8 : big ? COL.miss : COL.gauge, big && Math.floor(b.time * 6) % 2 ? 0.75 : 1).fillRect(bx, EN.y + 96, bw * ratioE, 20);
    this.txt.enemy.setText(e.def.name).setX(EN.x + 18 + sx);
    this.txt.enemyHp.setText(`${e.hp} / ${e.def.hp}`).setX(EN.x + EN.w - 18 + sx);
    this.txt.action.setText(e.stunLeft > 0 ? 'スタン中' : big ? `！ 大技  ${act.name}` : act.name).setColor(e.stunLeft > 0 ? '#5fb0e8' : big ? '#ff6a6a' : COL.dim).setX(EN.x + 18 + sx);
    this.txt.actionSub.setText(e.stunLeft > 0 ? '' : `${act.damage}ダメージ  あと${Math.max(0, act.chargeSec - e.gauge).toFixed(1)}秒`).setColor(big ? '#ff6a6a' : COL.dim).setX(EN.x + EN.w - 18 + sx);

    // 自分のHP
    const low = b.hp <= RULES.playerMaxHp * 0.3;
    g.fillStyle(COL.panel).fillRect(40, 204, 175, 14);
    g.fillStyle(low ? COL.miss : COL.item).fillRect(40, 204, 175 * (b.hp / RULES.playerMaxHp), 14);
    this.txt.hp.setText(`${b.hp} / ${RULES.playerMaxHp}`).setColor(low ? '#ff6a6a' : COL.text);

    const buffs: string[] = [];
    if (b.buffs.power) buffs.push('威力2倍');
    if (b.buffs.levelx) buffs.push('レベル無視');
    this.txt.buffs.setText(buffs.length ? buffs.join(' / ') : 'なし').setColor(buffs.length ? '#8fc4ff' : COL.dim);
    this.txt.sand.setText(b.sandLeft > 0 ? `星の砂 ${b.sandLeft.toFixed(1)}秒` : '');

    // アイテム（L2・R2）
    b.items.forEach((it, i) => {
      const box = ITEM_BOX[i], v = this.itemViews[i], a = it.used ? 0.35 : 1;
      g.fillStyle(COL.item, it.used ? 0.08 : 0.22).fillRoundedRect(box.x, box.y, ITEM_W, ITEM_H, 8);
      g.lineStyle(2, it.used ? COL.ng : COL.item).strokeRoundedRect(box.x, box.y, ITEM_W, ITEM_H, 8);
      g.fillStyle(it.used ? COL.ng : COL.item, it.used ? 0.5 : 0.9).fillRoundedRect(box.x + 6, box.y + 6, 40, ITEM_H - 12, 6);
      v.label.setText(pad ? box.label : box.key).setAlpha(a);
      v.name.setText(it.def.name).setAlpha(a);
      v.desc.setText(it.used ? '使用済み' : this.started ? (it.def.desc ?? '') : '押すと変更').setAlpha(a);
    });

    // 記録
    this.txt.time.setText(b.time.toFixed(1));
    this.txt.stats.setText([`S発動  ${b.stats.sCount}`, `使用枚数  ${b.stats.plays}`, `入れ替え  ${b.stats.skips}`, `ミス  ${b.stats.misses}`]);
    this.txt.help.setText(pad
      ? ['△○✕□: カードを出す', '十字キー: キープ / 解除', 'R1・L1: 入れ替え', 'L2・R2: アイテム', 'OPTIONS: やり直し']
      : ['W D S A: カードを出す（上 右 下 左）', '矢印キー: キープ / 解除', 'スペース: 入れ替え', 'Q・E: アイテム', 'R: やり直し　M: 消音']);
    this.txt.audio.setText(this.sound2.muted ? '音: 消音中（Mキーで戻す）' : this.sound2.ready ? '' : '音: 画面を1回クリックするか、キーを押すと鳴ります');
    const ps = this.input2.padStatus;
    this.txt.pad.setText({
      ok: 'ゲームパッド: 接続中',
      none: 'ゲームパッド: 未検出（ボタンを1回押すと認識されます）',
      blocked: 'ゲームパッド: このページでは使えません（単体のHTMLファイルで開いてください）',
      nonstandard: 'ゲームパッド: 接続中（ボタン配置が標準と違う可能性あり）',
    }[ps]).setColor(ps === 'ok' ? '#7fe0a0' : ps === 'none' ? COL.dim : '#ffb04a');

    // 手札
    const locked = b.lock > 0 && b.missLock;
    for (let i = 0; i < 4; i++) {
      const v = this.views[i], slot = b.slots[i], c = slot.card, { x, y } = SLOT_POS[i];
      v.flash = Math.max(0, v.flash - dt);
      const left0 = x - CARD_W / 2, top = y - CARD_H / 2;
      if (!c) {
        g.lineStyle(2, COL.line, 0.7).strokeRoundedRect(left0, top, CARD_W, CARD_H, 10);
        if (b.charging && b.chargeTotal > 0) {
          const p = 1 - b.chargeLeft / b.chargeTotal;
          g.fillStyle(COL.line, 0.6).fillRoundedRect(left0, top + CARD_H * (1 - p), CARD_W, Math.max(CARD_H * p, 1), 10);
        }
        v.big.setText(''); v.name.setText(''); v.desc.setText(''); v.keep.setVisible(false);
        v.glyph.setColor(COL.dim).setAlpha(1);
        continue;
      }
      const ok = b.canPlay(c) && !locked;
      g.fillStyle(TYPE_COLOR[c.type], ok ? 0.95 : 0.22).fillRoundedRect(left0, top, CARD_W, CARD_H, 10);
      if (v.flash > 0) g.fillStyle(COL.miss, 0.6).fillRoundedRect(left0, top, CARD_W, CARD_H, 10);
      g.lineStyle(slot.kept ? 5 : 3, slot.kept ? COL.keep : ok ? COL.ok : COL.ng).strokeRoundedRect(left0, top, CARD_W, CARD_H, 10);
      const a = ok ? 1 : 0.45;
      v.big.setText(this.cardBig(c)).setAlpha(a);
      v.name.setText(c.type === 'attack' ? `威力 ${c.power}` : c.name).setAlpha(a);
      v.desc.setText(c.type === 'attack' ? '' : (c.desc ?? '')).setAlpha(a).setColor('#f2f4f8');
      v.glyph.setColor('#ffffff').setAlpha(a);
      v.keep.setVisible(slot.kept);
    }

    // 中央: 現在のチェインと残り時間の輪
    const col = locked ? COL.miss : CHAIN_COL[b.chain];
    const r = RING + (this.ringPulse > 0 ? this.ringPulse * 22 : 0);
    g.fillStyle(0x0d1017).fillCircle(CX, CY, RING);
    g.fillStyle(col, b.chain > 0 ? 0.2 : 0.08).fillCircle(CX, CY, r);
    g.lineStyle(3, COL.line).strokeCircle(CX, CY, RING);
    if (b.chain > 0) {
      const ratio = Phaser.Math.Clamp(b.chainTimer / RULES.chainTimerSec, 0, 1);
      g.lineStyle(7, ratio < 0.34 ? COL.miss : col);
      g.beginPath();
      g.arc(CX, CY, RING, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.strokePath();
    }
    this.txt.chain.setText(locked ? '✕' : b.chain > 0 ? LEVEL_LABELS[b.chain] : '–').setColor(locked ? '#ff5a5a' : CHAIN_HEX[b.chain])
      .setScale(1 + this.ringPulse * 1.2);
    this.txt.chainSub.setText(locked ? 'ミス' : b.charging && b.chargeTotal > 0 ? '補充中' : b.autoSkipWait > 0 ? '入れ替え' : b.buffs.levelx ? 'レベル無視' : 'CHAIN');

    // 被弾の赤いフラッシュ
    this.fx.clear();
    if (this.hurt > 0) this.fx.fillStyle(0xff2a2a, Math.min(0.35, this.hurt * 0.7)).fillRect(0, 0, W, H);

    // 開始前・終了後
    this.txt.hint.setText(this.started ? '' : ['カードを出すと開始', `${pad ? 'L2・R2' : 'Q・E'} でアイテムを変更`]);
    if (!this.started) this.txt.overlay.setVisible(false);
    else if (b.result !== 'playing') {
      const again = pad ? 'OPTIONS でもう一度' : 'R キーでもう一度';
      this.txt.overlay.setVisible(true).setText(b.result === 'won'
        ? ['勝利', '', `撃破タイム  ${b.time.toFixed(1)} 秒　　残りHP  ${b.hp}`, `S発動  ${b.stats.sCount} 回　　最大ダメージ  ${b.stats.maxHit}`, `入れ替え  ${b.stats.skips}　　ミス  ${b.stats.misses}`, '', again]
        : ['敗北', '', `敵の残りHP  ${e.hp} / ${e.def.hp}`, `経過時間  ${b.time.toFixed(1)} 秒　　S発動  ${b.stats.sCount} 回`, `入れ替え  ${b.stats.skips}　　ミス  ${b.stats.misses}`, '', again],
      ).setFontSize(18).setY(300);
    } else this.txt.overlay.setVisible(false);
  }
}
