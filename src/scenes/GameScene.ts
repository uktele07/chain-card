import Phaser from 'phaser';
import { Battle, type EnemyDef } from '../game/battle';
import { Input, type Btn } from '../game/input';
import { Sound } from '../game/audio';
import { ZOOM } from '../game/display';
import { Layer } from '../game/ui';
import { BOARD_PAD, loadArt, loadBoardArt, loadTempleArt } from '../game/art';
import { DungeonRun, type DungeonDef, type Effect } from '../game/dungeon';
import { clearSave, loadSave, rankOf, rankValue, storeSave, type Rank, type SaveData } from '../game/save';
import { buildDeck, gearOf } from '../game/loadout';
import { RULES, DEFS, SPELLS, WEAPONS, ARMORS, ITEMS, ENEMIES, ALL_ENEMIES, ACCESSORIES, DUNGEONS, enemyById, itemOf, SAVE_CONFIG, SHOP } from '../game/content';
import { C, CARD_BTN, KEEP_BTN, RESULT_WAIT, MENU, PAUSE, PAUSE_DUNGEON, EQUIP_ROWS, type Base, type Overlay, type Deal } from '../screens/common';
import { drawList } from '../screens/list';
import { drawBattle } from '../screens/battle';
import { drawBattleScene, CHAIN_AT, ITEM_AT, HP_AT } from '../screens/battlescene';
import { ENEMY_AT } from '../game/battlebg';
import { drawListScene } from '../screens/listscene';
import { UIRoot, isHtml, UI_DEBUG, DEBUG_MARKS, type ViewName } from '../views/root';
import { drawResult } from '../screens/result';
import { drawMenu, drawPause, drawResume, drawReset, drawConfirm } from '../screens/menus';
import { drawEquip } from '../screens/equip';
import { drawDeck } from '../screens/deck';
import { drawShop } from '../screens/shop';
import { drawHelp } from '../screens/help';
import { drawBoard, drawDMenu, drawLegend } from '../screens/board';

export type BoardMode = 'idle' | 'rolling' | 'moving' | 'choose' | 'landed' | 'look' | 'cleared';

/**
 * ゲーム全体の状態と入力を持つ。描画は src/screens/ の各画面に任せ、ここからは呼ぶだけ。
 * 画面側が状態を読めるよう、メンバーは公開している（書き換えるのはこのクラスの中だけ）。
 */
export class GameScene extends Phaser.Scene {
  input2!: Input;
  snd = new Sound();
  L: Layer[] = [];
  fx!: Phaser.GameObjects.Graphics;
  /** 画面まわりの HTML の層（docs/ui-migration.md）。移し終えた画面は、Canvas ではなくここに描く */
  ui!: UIRoot;
  save!: SaveData;
  battle!: Battle;

  base: Base = 'list';
  overlays: Overlay[] = [];
  cur = { list: 0, menu: 0, pause: 0, result: 0, reset: 0, slot: 0, opt: 0, deck: 0, shop: 0, sell: 0, dlist: 0, dmenu: 0 };
  listTab: 0 | 1 = 0;       // 0=討伐 1=ダンジョン
  // --- ダンジョン ---
  run: DungeonRun | null = null;
  inRun = false;            // ダンジョンの中にいる（盤面か、その戦闘）
  bmode: BoardMode = 'idle';
  lookFrom: 'idle' | 'choose' = 'idle';
  cam = { x: 0, y: 0 };     // 盤面のうち、画面の左上に映す位置
  piece = { x: 0, y: 0 };   // 駒の位置（盤面の座標）
  target: { x: number; y: number } | null = null;
  landAfter = false;
  diceFace = 0; rolled = 0; landLeft = 0;
  pick = 0;                 // 分かれ道で選んでいる行き先
  effect: Effect | null = null;
  reward: { accessory?: string; gold?: number } | null = null;
  restartArmed = false;
  private setCache = new Map<string, Set<number>>();
  shopTab: 0 | 1 = 0;       // 0=買う 1=売る
  deal: Deal | null = null;
  dealCursor = 0;           // 0=実行 1=やめる
  gained: { name: string; price: number } | null = null;   // 直前の戦闘で手に入れた換金アイテム
  equipFocus: 'slots' | 'options' = 'slots';
  enemy: EnemyDef = ENEMIES[0];
  invincible = false;       // テスト用。画面を移っても維持する
  resultWait = 0;
  resumeLeft = 0;
  /** 直前の討伐の結果。prevBest はこの戦闘より前の最速タイム（初めてなら null）、wins はこの討伐を含めた回数 */
  outcome: { rank: Rank | null; newBest: boolean; prevBest: number | null; wins: number } = { rank: null, newBest: false, prevBest: null, wins: 0 };
  /** すごろくのテストモード（タッチパッド / T で切り替え）: サイコロの目を自分で選べる */
  diceTest = false;
  enemyShake = 0; ringPulse = 0; hurt = 0; lastTick = 0; clock = 0;

  constructor() { super('game'); }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.input2 = new Input();
    this.L = [new Layer(this, 0), new Layer(this, 100), new Layer(this, 200), new Layer(this, 300)];
    this.fx = this.add.graphics().setDepth(60);
    this.ui = new UIRoot(this.game.canvas.parentElement!);
    this.ui.attach(this.game.canvas);
    loadArt(this, ZOOM);
    loadTempleArt(this, ZOOM);
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
  get accessory() { return ACCESSORIES.find(a => a.id === this.save.accessory); }
  sellList() { return ALL_ENEMIES.map(e => e.drop).filter((d, i, a): d is NonNullable<EnemyDef['drop']> => !!d && (this.save.loot[d.id] ?? 0) > 0 && a.findIndex(o => o?.id === d.id) === i); }

  newBattle() {
    // ダンジョンの中では、HP・最大HP・アイテムの使用状況を引き継ぐ
    const carry = this.inRun && this.run ? { hp: this.run.state.hp, maxHp: this.run.maxHp, used: this.run.state.used } : {};
    this.battle = new Battle(buildDeck(DEFS, this.save.spells), RULES, Math.random, this.save.items.map(itemOf), this.enemy, gearOf(this.weapon, this.armor, this.accessory), carry);
    this.battle.invincible = this.invincible;
    this.battle.events.length = 0;
    this.lastTick = 0; this.hurt = 0;
    (window as unknown as Record<string, unknown>).__battle = this.battle;
  }
  toList() { this.base = 'list'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; }
  toReady(e: EnemyDef) { this.enemy = e; this.base = 'ready'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0; this.newBattle(); }
  pop() {
    const closed = this.overlays.pop();
    if (closed === 'equip' && this.base === 'board' && this.run) {     // 入口で装備を変えた: アイテムの枠を作り直す
      this.run = new DungeonRun(this.run.def, RULES.playerMaxHp, this.save.items.map(x => !!x), Math.random, { ...this.run.state });
      this.keepRun();
    }
    if (this.overlays.length === 0 && this.base === 'ready') this.newBattle();   // 装備を変えたかもしれないので作り直す
  }

  finish(won: boolean) {
    const b = this.battle;
    this.base = 'result'; this.overlays = [];
    this.resultWait = RESULT_WAIT;
    this.cur.result = won ? 1 : 0;      // 勝ち→一覧に戻る / 負け→もう一度
    this.outcome = { rank: null, newBest: false, prevBest: null, wins: 0 };
    this.gained = null;
    this.snd.stopBgm();
    if (this.inRun && this.run) { this.finishInRun(won); return; }
    if (!won) { this.snd.lose(); return; }
    this.snd.win();
    if (b.usedInvincible) return;        // 無敵を使った戦闘は、ランクも記録も付けない
    const rank = rankOf(b.time, this.enemy.rankSec);
    this.record(rank);
    const drop = this.enemy.drop;
    if (drop) { this.save.loot[drop.id] = (this.save.loot[drop.id] ?? 0) + 1; this.gained = drop; }
    storeSave(this.save);
  }
  /** 討伐の記録（最速タイム・ランク・回数）を付ける。rank が null ならランクは出さない（ダンジョンの敵） */
  record(rank: Rank | null) {
    const b = this.battle, id = this.enemy.id, old = this.save.records[id];
    const newBest = !old || b.time < old.bestTime, r = rank ?? 'C';
    this.save.records[id] = {
      bestTime: newBest ? b.time : old.bestTime,
      bestRank: !old || rankValue(r) > rankValue(old.bestRank) ? r : old.bestRank,
      wins: (old?.wins ?? 0) + 1,
    };
    this.outcome = { rank, newBest, prevBest: old ? old.bestTime : null, wins: this.save.records[id].wins };
  }

  // ---------------- ダンジョン ----------------
  /** ダンジョンの戦闘が終わった。最速タイムと回数は付ける（ランクの目安が無いので、ランクは付けない） */
  finishInRun(won: boolean) {
    const run = this.run!, b = this.battle, sv = this.save;
    if (!won) { this.snd.lose(); run.battleLost(); this.keepRun(); return; }
    this.snd.win();
    run.battleWon(b.hp, b.items.map(it => !!it?.used));
    if (!b.usedInvincible) this.record(null);
    const drop = this.enemy.drop;
    if (drop) { sv.loot[drop.id] = (sv.loot[drop.id] ?? 0) + 1; this.gained = drop; }
    if (run.state.cleared) {
      const id = run.def.id, rw = run.def.reward;
      if (!sv.cleared[id] && !sv.accessories.includes(rw.accessory)) {      // 初回はアクセサリ。2回目以降はお金
        sv.accessories.push(rw.accessory);
        if (!sv.accessory) sv.accessory = rw.accessory;
        this.reward = { accessory: rw.accessory };
      } else { sv.gold += rw.gold; this.reward = { gold: rw.gold }; }
      sv.cleared[id] = true;
    }
    this.keepRun();
  }
  /** 盤面のメニュー。入口（最初のマス）にいる間だけ、装備を変えられる */
  dmenuItems(): { label: string; act: 'equip' | 'legend' | 'help' | 'restart' | 'leave' | 'close'; note?: string }[] {
    const atStart = !!this.run && this.run.state.pos === 0;
    return [
      ...(atStart ? [{ label: '装備', act: 'equip' as const, note: '入口でだけ変えられる' }] : []),
      { label: 'マスの説明', act: 'legend' }, { label: '操作説明', act: 'help' },
      { label: this.restartArmed ? 'もう一度押すと、やり直す' : '最初からやり直す', act: 'restart' },
      { label: 'ダンジョンから出る', act: 'leave', note: '続きから再開できる' }, { label: '閉じる', act: 'close' },
    ];
  }
  /** 途中経過を保存する（踏破したら消す）。マスに止まるたび・戦闘のたびに呼ぶ */
  keepRun() {
    if (!this.run) return;
    const st = this.run.state;
    this.save.run = st.cleared ? null : { ...st, used: [...st.used] };
    storeSave(this.save);
  }
  sqPos(i: number) { const r = this.run!, q = r.board[i], G = r.def.cell; return { x: q.x * G + G / 2, y: q.y * G + G / 2 }; }
  private bfs(key: string, from: number, depth: number): Set<number> {
    const k = `${key}:${from}:${this.run!.state.midDone}`, hit = this.setCache.get(k);
    if (hit) return hit;
    const run = this.run!, out = new Set<number>(), q: [number, number][] = [[from, 0]];
    while (q.length) {
      const [i, d] = q.shift()!;
      if (d >= depth) continue;
      for (const n of run.board[i].next) {
        if (out.has(n)) continue;
        out.add(n);
        const kind = run.board[n].kind, gate = kind === 'boss' || (kind === 'mid' && !run.state.midDone);
        if (!(gate && depth < 99)) q.push([n, d + 1]);     // 関所では必ず止まるので、その先には届かない
      }
    }
    if (this.setCache.size > 200) this.setCache.clear();
    this.setCache.set(k, out);
    return out;
  }
  /** このマスより先にあるマス（通り過ぎたマスを薄く描くため） */
  aheadOf(pos: number) { return this.bfs('a', pos, 99); }
  /** サイコロ1回で届くマス */
  reachOf(pos: number) { return this.bfs('r', pos, 6); }

  enterDungeon(def: DungeonDef) {
    const saved = this.save.run?.dungeon === def.id ? this.save.run : undefined;
    this.run = new DungeonRun(def, RULES.playerMaxHp, this.save.items.map(x => !!x), Math.random, saved);
    this.inRun = true; this.reward = null; this.setCache.clear();
    loadBoardArt(this, def, this.run.board, ZOOM);     // 大きな絵なので、入るときに作る（起動を重くしない）
    this.toBoard();
  }
  toBoard() {
    const run = this.run!, st = run.state;
    this.base = 'board'; this.overlays = []; this.snd.stopBgm(); this.snd.intensity = 0;
    this.piece = this.sqPos(st.pos); this.target = null; this.effect = null; this.diceFace = 0;
    this.cam = this.camTarget();
    if (st.cleared) this.bmode = 'cleared';
    else if (st.pending) {       // 戦闘の途中で閉じていたら、その敵からやり直す
      const k = run.square.kind;
      this.effect = { kind: 'monster', enemy: st.pending, rank: k === 'mid' ? 'mid' : k === 'boss' ? 'boss' : 'zako' };
      this.bmode = 'landed';
    } else if (st.steps > 0) this.advance();
    else this.bmode = 'idle';
    this.keepRun();
  }
  leaveDungeon() { this.keepRun(); this.run = null; this.inRun = false; this.toList(); }
  camTarget() {
    const d = this.run!.def, G = d.cell, P = BOARD_PAD;
    return { x: Phaser.Math.Clamp(this.piece.x - 480, -P, d.size[0] * G + P - 960), y: Phaser.Math.Clamp(this.piece.y - 262, -P, d.size[1] * G + P - 540) };
  }
  /** 分かれ道で first を選んだとき、いまの出目で止まるマス（先にまた分かれ道があれば、そこまで） */
  stopFrom(first: number): number {
    const run = this.run!;
    let pos = first;
    for (let left = run.state.steps - 1; left > 0; left--) {
      const k = run.board[pos].kind, next = run.board[pos].next;
      if (k === 'boss' || (k === 'mid' && !run.state.midDone) || next.length !== 1) break;
      pos = next[0];
    }
    return pos;
  }
  /** 1マス進める。分かれ道なら選ぶ画面にする */
  advance(choice?: number) {
    const run = this.run!, r = run.step(choice);
    if (r === 'choose') { this.bmode = 'choose'; this.pick = 0; return; }
    this.bmode = 'moving'; this.target = this.sqPos(run.state.pos); this.landAfter = r === 'landed';
  }
  land() {
    const eff = this.run!.land();
    this.effect = eff; this.keepRun();
    if (eff.kind === 'none' && !eff.random) { this.bmode = 'idle'; this.effect = null; this.diceFace = 0; return; }
    this.bmode = 'landed'; this.landLeft = 1.8;
    if (eff.kind === 'monster') this.snd.warn();
    else if (eff.kind === 'event') this.snd.enemyHit(false);
    else if (eff.kind === 'none') this.snd.uiBack();
    else this.snd.item('heal');
  }
  closeLanded() {
    const eff = this.effect;
    if (eff?.kind === 'monster') { this.snd.uiOk(); this.toReady(enemyById(eff.enemy)); return; }
    this.bmode = 'idle'; this.effect = null; this.diceFace = 0;
  }
  updateBoard(dt: number) {
    const run = this.run;
    if (!run || this.base !== 'board') return;
    const d = run.def, G = d.cell, P = BOARD_PAD;
    if (this.top === 'board') {
      if (this.bmode === 'rolling') {
        if (!this.diceTest) this.diceFace = 1 + Math.floor(this.clock * 20) % 6;   // テストモードでは、選んだ目のまま      // 回っている間の目は飾り。止めた瞬間に抽選する
      } else if (this.bmode === 'moving' && this.target) {
        const dx = this.target.x - this.piece.x, dy = this.target.y - this.piece.y, dist = Math.hypot(dx, dy), stepLen = 340 * dt;
        if (dist <= stepLen) {
          this.piece = this.target; this.target = null; this.snd.uiMove();
          if (this.landAfter) this.land(); else this.advance();
        } else { this.piece = { x: this.piece.x + dx / dist * stepLen, y: this.piece.y + dy / dist * stepLen }; }
      } else if (this.bmode === 'landed' && this.effect && this.effect.kind !== 'monster') {
        this.landLeft -= dt;
        if (this.landLeft <= 0) this.closeLanded();
      } else if (this.bmode === 'look') {
        const v = 560 * dt, i = this.input2;
        this.cam.x = Phaser.Math.Clamp(this.cam.x + ((i.held('right') ? v : 0) - (i.held('left') ? v : 0)), -P, d.size[0] * G + P - 960);
        this.cam.y = Phaser.Math.Clamp(this.cam.y + ((i.held('down') ? v : 0) - (i.held('up') ? v : 0)), -P, d.size[1] * G + P - 540);
      }
    }
    if (this.bmode !== 'look') {
      const t = this.camTarget(), k = Math.min(1, dt * 7);
      this.cam.x += (t.x - this.cam.x) * k; this.cam.y += (t.y - this.cam.y) * k;
    }
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
    if (b === 'touchpad' && this.top === 'board') {    // すごろく: サイコロの目を選べるテストモードの切り替え
      this.diceTest = !this.diceTest; this.snd.keep(this.diceTest);
      if (this.bmode === 'rolling') this.diceFace = this.diceFace || 1;
      return;
    }
    if (b === 'touchpad') { this.invincible = !this.invincible; this.battle.invincible = this.invincible; this.snd.keep(this.invincible); return; }
    const ok = b === 'circle' || b === 'ok', back = b === 'cross' || b === 'back';
    const bt = this.battle;

    switch (this.top) {
      case 'list':
        if (b === 'skip' || b === 'left' || b === 'right') { this.listTab = this.listTab ? 0 : 1; this.snd.uiMove(); }   // L1 / R1: 討伐 ⇔ ダンジョン
        else if (this.listTab === 1 && b !== 'options') {
          if (b === 'up') this.move('dlist', -1, DUNGEONS.length);
          else if (b === 'down') this.move('dlist', 1, DUNGEONS.length);
          else if (ok) {
            const d = DUNGEONS[this.cur.dlist];
            if (d.locked) this.snd.miss(); else { this.snd.uiOk(); this.enterDungeon(d); }
          }
        }
        else if (b === 'up') this.move('list', -1, ENEMIES.length);
        else if (b === 'down') this.move('list', 1, ENEMIES.length);
        else if (ok) {
          const e = ENEMIES[this.cur.list];
          if (!this.unlocked(e)) this.snd.miss(); else { this.snd.uiOk(); this.toReady(e); }
        } else if (b === 'options') { this.cur.menu = 0; this.overlays.push('menu'); this.snd.uiOk(); }
        break;

      case 'ready':
        if (ok) { this.base = 'fight'; this.snd.startBgm(); this.snd.refill(); }   // 開始するだけ。○のカードは出さない
        else if (b === 'l2') { if (bt.cycleItem()) this.snd.uiMove(); }
        else if (this.inRun) { if (back || b === 'options') this.snd.miss(); }      // ダンジョンでは逃げられず、装備も変えられない
        else if (back) { this.snd.uiBack(); this.toList(); }
        else if (b === 'options') { this.cur.menu = 0; this.overlays.push('menu'); this.snd.uiOk(); }
        break;

      case 'board': {
        const run = this.run!, m = this.bmode;
        if (m === 'look') { if (b === 'square' || back) { this.bmode = this.lookFrom; this.snd.uiBack(); } break; }
        if (m === 'cleared') { if (ok) { this.snd.uiOk(); this.leaveDungeon(); } break; }
        if (m === 'landed') { if (ok) this.closeLanded(); break; }
        if (m === 'rolling') {      // 回っているサイコロ: ○で止める、✕でやめる。テストモードでは十字キーで目を選ぶ
          if (this.diceTest && (b === 'up' || b === 'right' || b === 'down' || b === 'left')) { this.diceFace = ((this.diceFace || 1) - 1 + (b === 'up' || b === 'right' ? 1 : 5)) % 6 + 1; this.snd.uiMove(); break; }
          if (ok) { this.rolled = run.roll(this.diceTest ? this.diceFace || 1 : undefined); this.diceFace = this.rolled; this.snd.uiOk(); this.keepRun(); this.advance(); }
          else if (back) { this.bmode = 'idle'; this.diceFace = 0; this.snd.uiBack(); }
          break;
        }
        if (m !== 'idle' && m !== 'choose') break;      // 移動の間は待つ
        if (b === 'options') { this.cur.dmenu = 0; this.restartArmed = false; this.overlays.push('dmenu'); this.snd.uiOk(); }
        else if (b === 'square') { this.lookFrom = m; this.bmode = 'look'; this.snd.uiOk(); }
        else if (b === 'tri') { this.overlays.push('legend'); this.snd.uiOk(); }
        else if (m === 'idle') { if (ok) { this.bmode = 'rolling'; if (this.diceTest) this.diceFace = 1; this.snd.refill(); } }
        else if (ok) { this.snd.uiOk(); this.advance(run.options()[this.pick]); }
        else {
          // 押した向きにいちばん近い行き先を選ぶ
          const v = b === 'up' ? [0, -1] : b === 'down' ? [0, 1] : b === 'left' ? [-1, 0] : b === 'right' ? [1, 0] : null;
          if (!v) break;
          const from = this.sqPos(run.state.pos), dots = run.options().map(o => { const p = this.sqPos(o); return (p.x - from.x) * v[0] + (p.y - from.y) * v[1]; });
          const best = dots.indexOf(Math.max(...dots));
          if (dots[best] > 0 && best !== this.pick) { this.pick = best; this.snd.uiMove(); }
        }
        break;
      }

      case 'dmenu': {
        const items = this.dmenuItems(), act = items[this.cur.dmenu]?.act;
        if (b === 'up' || b === 'down') { this.move('dmenu', b === 'up' ? -1 : 1, items.length); this.restartArmed = false; }
        else if (back || b === 'options' || (ok && act === 'close')) { this.snd.uiBack(); this.pop(); }
        else if (!ok) break;
        else if (act === 'equip') { this.snd.uiOk(); this.cur.slot = 0; this.equipFocus = 'slots'; this.overlays.push('equip'); }
        else if (act === 'legend' || act === 'help') { this.snd.uiOk(); this.overlays.push(act); }
        else if (act === 'restart') {
          if (!this.restartArmed) { this.restartArmed = true; this.snd.uiMove(); }      // 押し間違いを防ぐため、2回押して実行
          else { this.snd.uiOk(); this.save.run = null; this.enterDungeon(this.run!.def); }
        }
        else if (act === 'leave') { this.snd.uiBack(); this.leaveDungeon(); }
        break;
      }

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
        // 項目は横に並ぶ（左右）。以前の上下も効く
        if (b === 'up' || b === 'left') this.move('pause', -1, this.inRun ? PAUSE_DUNGEON.length : PAUSE.length);
        else if (b === 'down' || b === 'right') this.move('pause', 1, this.inRun ? PAUSE_DUNGEON.length : PAUSE.length);
        else if (this.inRun && ok && this.cur.pause === 1) { this.snd.uiBack(); this.run!.battleLost(); this.leaveDungeon(); }   // 戦闘の途中で出ると、負けた扱い
        else if (back || b === 'options' || (ok && this.cur.pause === 0)) { this.overlays = ['resume']; this.resumeLeft = RULES.resumeCountSec; this.snd.count(); }
        else if (ok && this.cur.pause === 1) { this.snd.uiOk(); this.toReady(this.enemy); }
        else if (ok && this.cur.pause === 2) { this.snd.uiBack(); this.toList(); }
        break;

      case 'resume': break;   // カウント中は操作を受け付けない

      case 'result':
        if (this.resultWait > 0) break;
        if (this.inRun && this.battle.result === 'won') { if (ok) { this.snd.uiOk(); this.toBoard(); } break; }
        if (this.inRun) {   // ダンジョンで負けた: 入口（中間地点）に戻るか、ダンジョンから出る
          if (b === 'up' || b === 'down' || b === 'left' || b === 'right') this.move('result', b === 'up' || b === 'left' ? -1 : 1, 2);
          else if (ok && this.cur.result === 1) { this.snd.uiBack(); this.leaveDungeon(); }
          else if (ok) { this.snd.uiOk(); this.toBoard(); }
          break;
        }
        // 選択肢は縦に並ぶ（上下）。以前の左右も効く
        if (b === 'left' || b === 'right' || b === 'up' || b === 'down') this.move('result', b === 'left' || b === 'up' ? -1 : 1, 2);
        if (this.inRun) { if (ok) { this.snd.uiOk(); this.toBoard(); } break; }
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
          if (b === 'up') this.move('slot', -1, EQUIP_ROWS.length);
          else if (b === 'down') this.move('slot', 1, EQUIP_ROWS.length);
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

      case 'legend':
      case 'help':
        if (ok || back || b === 'options') { this.snd.uiBack(); this.pop(); }
        break;

      case 'reset':
        if (b === 'left' || b === 'right') this.move('reset', b === 'left' ? -1 : 1, 2);
        else if (back || (ok && this.cur.reset === 0)) { this.snd.uiBack(); this.pop(); }
        else if (ok) {
          clearSave();
          this.save = loadSave(SAVE_CONFIG);
          this.cur.list = 0; this.enemy = ENEMIES[0]; this.run = null; this.inRun = false; this.listTab = 0; this.cur.dlist = 0;
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
    if (row === 2) return [null, ...ACCESSORIES.filter(a => s.accessories.includes(a.id))].map(a => ({ id: null, name: a ? a.name : 'なし', on: s.accessory === (a ? a.id : null), note: a && s.accessory === a.id ? '装備中' : '', desc: a ? a.desc : 'アクセサリを外す。', pick: () => { s.accessory = a ? a.id : null; } }));
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
    this.updateBoard(dt);

    for (const e of bt.events) {
      if (e.kind === 'hit') {
        // ダブルの2発目は少し遅らせて、音・数字・揺れを2回に分ける
        this.time.delayedCall(e.index * 130, () => {
          this.enemyShake = e.lv === 4 ? 0.35 : 0.12;
          this.ringPulse = e.lv === 4 ? 0.4 : 0.18;
          if (e.lv === 4) this.cameras.main.shake(180, 0.006);
          this.snd.hit(e.lv, e.hits > 1);
          this.popup(String(e.damage), e.lv === 4 || e.hits > 1 ? '#ffd24a' : C.text, e.lv === 4 ? 42 : Math.min(40, 26 + e.damage * 2), ENEMY_AT.y - 70 - e.index * 26, ENEMY_AT.x + Phaser.Math.Between(-60, 60));
          if (e.bonus > 0) this.popup(`使い切り +${e.bonus}`, '#7fe0a0', 18, ENEMY_AT.y - 120, ENEMY_AT.x);
        });
      } else if (e.kind === 'miss') this.snd.miss();
      else if (e.kind === 'spell') this.snd.spell();
      else if (e.kind === 'skip') this.snd.skip();
      else if (e.kind === 'refill') this.snd.refill();
      else if (e.kind === 'keep') this.snd.keep(e.on);
      else if (e.kind === 'item') {
        this.snd.item(e.effect);
        const it = bt.items[e.slot];
        this.popup(e.effect === 'heal' ? '+20 HP' : it ? it.def.name : '', '#7fe0a0', 20, ITEM_AT.y - 30, ITEM_AT.x);
      } else if (e.kind === 'heal') { if (e.amount > 0) this.popup(`+${e.amount} HP`, '#7fe0a0', 20, HP_AT.y, HP_AT.x); }
      else if (e.kind === 'chainBreak') { this.snd.chainBreak(); this.popup('チェイン切れ', C.warn, 15, CHAIN_AT.y - 54, CHAIN_AT.x); }
      else if (e.kind === 'burn') this.popup(`やけど -${e.damage}`, '#ff8a2a', 16, HP_AT.y - 30, HP_AT.x + 90);
      else if (e.kind === 'enemyCharge') { this.lastTick = 0; if (e.big && this.base === 'fight') this.snd.warn(); }
      else if (e.kind === 'enemyAttack') {
        this.hurt = e.big ? 0.6 : 0.35;
        this.cameras.main.shake(e.big ? 260 : 120, e.big ? 0.012 : 0.005);
        this.snd.enemyHit(e.big);
        this.popup(e.damage > 0 ? `-${e.damage}` : '無敵', e.damage > 0 ? '#ff6a6a' : '#ffd24a', e.big ? 32 : 22, HP_AT.y, HP_AT.x + 90);
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
    // いま見えている画面（奥から順）。HTML へ移した画面は Canvas に描かず、HTML の層に描く
    const views: ViewName[] = [];
    const show = (v: ViewName, canvas: () => void) => { views.push(v); if (!isHtml(v)) canvas(); };
    if (this.base === 'board') {
      // 盤面は3層を使う。メニューなどは、いちばん手前の1枚だけを最上層に描く
      show('board', () => drawBoard(this, a, b, this.L[2]));
      const o = this.top;
      if (o === 'dmenu') show('dmenu', () => drawDMenu(this, this.L[3])); else if (o === 'equip') show('equip', () => drawEquip(this, this.L[3]));
      else if (o === 'help') show('help', () => drawHelp(this, this.L[3])); else if (o === 'legend') show('legend', () => drawLegend(this, this.L[3]));
    } else {
      if (this.base === 'list' && isHtml('list')) { drawListScene(this, a, this.overlays.some(o => !isHtml(o))); views.push('list'); }   // 地と絵は Canvas、ほかは HTML
      else if (this.base === 'list') show('list', () => drawList(this, a));
      else if (isHtml('battle')) { drawBattleScene(this, a); if (this.base !== 'result') views.push('battle'); }   // 背景・敵・演出は Canvas、画面まわりは HTML（結果では隠す）
      else show('battle', () => drawBattle(this, a));
      if (this.base === 'result') show('result', () => drawResult(this, b));
      this.overlays.forEach((o, i) => {
        const l = this.L[Math.min(3, i + 1)];
        if (o === 'menu') show('menu', () => drawMenu(this, l));
        else if (o === 'equip') show('equip', () => drawEquip(this, l));
        else if (o === 'deck') show('deck', () => drawDeck(this, l));
        else if (o === 'shop') show('shop', () => drawShop(this, l));
        else if (o === 'confirm') show('confirm', () => drawConfirm(this, l));
        else if (o === 'help') show('help', () => drawHelp(this, l));
        else if (o === 'reset') show('reset', () => drawReset(this, l));
        else if (o === 'pause') show('pause', () => drawPause(this, l));
        else if (o === 'resume') show('resume', () => drawResume(this, l));
      });
    }
    // 位置合わせの目印（?uidebug）: HTML 側の水色の枠と、Canvas 側の赤い四角が重なれば合っている
    if (UI_DEBUG) for (const [x, y] of DEBUG_MARKS) this.fx.fillStyle(0xff2a2a, 1).fillRect(x + 4, y + 4, 12, 12);
    for (const l of this.L) l.end();
    this.ui.draw(this, views);
  }

  get pad() { return this.input2.padConnected; }
  /** アイテムの名前（無ければ null） */
  itemName(id: string | null) { return itemOf(id)?.name ?? null; }

}
