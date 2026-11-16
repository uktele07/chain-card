// 画面: 開始前・戦闘（結果・ポーズの背景も兼ねる）
import Phaser from 'phaser';
import { LEVEL_LABELS, type Card, type ItemDef } from '../game/battle';
import { W, H } from '../game/display';
import { iconKey, monsterKey } from '../game/art';
import type { Layer } from '../game/ui';
import { RULES, MARK } from '../game/content';
import { C, CHAIN_COL, CX, CY, CW, CH, RING, POS, GLY, MON, cursor } from './common';
import type { GameScene } from '../scenes/GameScene';

// --- 開始前・戦闘（結果・ポーズの背景も兼ねる） ---
export function drawBattle(gs: GameScene, l: Layer) {
  const b = gs.battle, e = b.enemy!, act = b.enemyAction!;
  const ready = gs.base === 'ready', fight = gs.base === 'fight' && gs.overlays.length === 0;
  const hidden = !ready && !fight;            // ポーズ・再開待ち・結果: 手札と敵のゲージを隠す
  const big = fight && !!act.big && e.stunLeft <= 0;

  // 敵: 名前・HP・行動ゲージ
  const x = CX - 200, w = 400, sx = gs.enemyShake > 0 ? Phaser.Math.Between(-5, 5) : 0;
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
    const blink = big && Math.floor(gs.clock * 6) % 2 ? 0.75 : 1;
    l.rect(x + 18, 108, (w - 36) * Phaser.Math.Clamp(e.gauge / act.chargeSec, 0, 1), 20, { fill: stun ? '#5fb0e8' : big ? C.miss : C.gauge, alpha: blink });
  }

  // 敵の絵。強い攻撃の溜め中は赤く光る
  const dead = b.result === 'won';
  if (big) l.ellipse(MON.x, MON.y, 250 + Math.sin(gs.clock * 10) * 14, 250 + Math.sin(gs.clock * 10) * 14, '#ff2a2a', 0.22);
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
    l.text(p.x, p.y - 14, cardBig(c), 38, C.text, 'middle', true, al);
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
    l.text(CX, CY + 16, gs.pad ? '○' : 'Enter', gs.pad ? 24 : 15, C.keep, 'middle', true);
  } else {
    const col = locked ? C.miss : CHAIN_COL[b.chain], chain = hidden ? 0 : b.chain;
    l.circle(CX, CY, RING + gs.ringPulse * 20, { fill: col, alpha: chain > 0 ? 0.2 : 0.08 });
    l.circle(CX, CY, RING, { stroke: C.line, sw: 3 });
    if (!hidden) {
      const ratio = b.chain > 0 ? b.chainTimer / RULES.chainTimerSec : 0;
      l.arc(CX, CY, RING, ratio, ratio < 0.34 ? C.miss : col, 6);
      const waiting = !locked && b.lock > 0.15;   // 斧などの待ち
      l.text(CX, CY - 27, locked ? 'ミス' : waiting ? '構え' : b.charging && b.chargeTotal > 0.2 ? '入れ替え中' : 'CHAIN', 10, locked ? C.miss : waiting ? C.keep : C.dim, 'middle', true);
      l.text(CX, CY - 1, locked ? '✕' : b.chain > 0 ? LEVEL_LABELS[b.chain] : '–', 36, locked ? C.miss : b.chain > 0 ? col : C.dim, 'middle', true).setScale(1 + gs.ringPulse * 1.2);
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
  const low = b.hp <= b.maxHp * 0.3, hw = 320, hx = CX - hw / 2;
  l.text(hx, 500, b.invincible ? 'HP　無敵（テスト用）' : 'HP', 12, b.invincible ? C.keep : C.dim, 'start', true);
  if (e.def.burn && !b.invincible) l.text(hx + 30, 500, `やけど（${e.def.burn.everySec}秒ごとに −${e.def.burn.damage}）`, 11, '#ff8a2a', 'start', true);
  l.text(hx + hw, 500, `${b.hp} / ${b.maxHp}`, 15, low ? '#ff6a6a' : C.text, 'end', true);
  l.rect(hx, 512, hw, 14, { fill: C.panel, rx: 4 });
  l.rect(hx, 512, hw * b.hp / b.maxHp, 14, { fill: low ? C.miss : C.item, rx: 4 });

  // アイテム（左）
  l.text(30, 178, 'アイテム', 12, C.dim, 'start', true);
  l.text(270, 178, gs.pad ? 'L2 で切り替え' : 'Q で切り替え', 11, C.dim, 'end');
  b.items.forEach((it, i) => {
    const y = 192 + i * 62, live = !!it && !it.used, on = i === b.selected && live && !hidden;
    l.rect(30, y, 240, 54, { fill: live ? C.itemBg : C.panel, stroke: on ? C.white : live ? C.item : C.ng, sw: on ? 3 : 1.5, rx: 9, alpha: live ? 1 : 0.7 });
    if (!it) { l.text(150, y + 27, 'なし', 13, C.faint); return; }
    const al = live ? 1 : 0.4, def = it.def as ItemDef & { short?: string };
    l.image(iconKey(def.id), 50, y + 19, 20, al);
    l.text(66, y + 19, def.name, 15, C.text, 'start', true, al);
    l.text(44, y + 39, it.used ? '使用済み' : def.short ?? '', 11, C.dim, 'start', false, al);
    if (on) {
      cursor(l, 18, y + 27);
      if (!ready) { l.rect(214, y + 14, 44, 26, { fill: C.white, rx: 6 }); l.text(236, y + 27, gs.pad ? 'R2' : 'E', 13, C.ink, 'middle', true); }
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

  if (ready && !gs.inRun) l.text(930, 520, gs.pad ? '✕ 戻る　　OPTIONS メニュー' : 'Backspace 戻る　　Esc メニュー', 12, C.dim, 'end');

  // 被弾の赤いフラッシュと、強い攻撃の予告（画面の縁と手札の中央が赤く点滅）
  if (gs.hurt > 0 && fight) gs.fx.fillStyle(0xff2a2a, Math.min(0.35, gs.hurt * 0.7)).fillRect(0, 0, W, H);
  if (big) {
    const left = act.chargeSec - e.gauge, near = left <= 1.5;
    const pulse = 0.5 + 0.5 * Math.sin(gs.clock * (near ? 22 : 9));
    const th = (near ? 20 : 10) + pulse * (near ? 10 : 5), alpha = (near ? 0.5 : 0.28) + pulse * 0.3;
    gs.fx.fillStyle(0xff2a2a, alpha);
    gs.fx.fillRect(0, 0, W, th).fillRect(0, H - th, W, th).fillRect(0, th, th, H - th * 2).fillRect(W - th, th, th, H - th * 2);
    gs.fx.lineStyle(near ? 5 : 3, 0xff2a2a, alpha).strokeCircle(CX, CY, RING + 12 + pulse * 5);
  }
}

export function cardBig(c: Card) { return c.type === 'attack' ? LEVEL_LABELS[c.lv!] : MARK[c.effect!] ?? '?'; }
