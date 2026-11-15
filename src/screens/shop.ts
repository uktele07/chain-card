// 画面: ショップ
import { W, H } from '../game/display';
import type { Layer } from '../game/ui';
import { ENEMIES, SHOP } from '../game/content';
import { C, guide, powerChips, rows } from './common';
import type { GameScene } from '../scenes/GameScene';

export function drawShop(gs: GameScene, l: Layer) {
  l.rect(0, 0, W, H, { fill: C.bg });
  const s = gs.save, sell = gs.sellList(), buying = gs.shopTab === 0;
  l.text(40, 40, 'ショップ', 24, C.text, 'start', true);
  ['買う', '売る'].forEach((t, i) => {
    const x = 180 + i * 96, on = i === gs.shopTab;
    l.rect(x, 22, 88, 36, { fill: on ? C.sel : undefined, stroke: on ? C.white : C.line, sw: on ? 2 : 1.5, rx: 18 });
    l.text(x + 44, 40, t, 16, on ? C.text : C.dim, 'middle', on);
  });
  l.text(388, 40, gs.pad ? 'L1 / R1 で切り替え' : '←→ で切り替え', 11, C.dim, 'start');
  l.text(920, 40, `所持金  ${s.gold} G`, 16, C.keep, 'end', true);
  l.rect(470, 80, 450, 250, { fill: C.panel, stroke: C.line, rx: 12 });

  if (buying) {
    const firstArmor = SHOP.findIndex(g => g.kind === 'armor');
    const ys = rows(l, 40, 80, 400, 44, SHOP.length, gs.cur.shop, { heads: { 0: '武器', [firstArmor]: '防具' } });
    SHOP.forEach((g, i) => {
      const own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id), poor = !own && s.gold < (g.def.price ?? 0);
      l.text(80, ys[i], g.def.name, 16, own ? C.dim : C.text, 'start', i === gs.cur.shop);
      l.text(418, ys[i], own ? '購入済み' : `${g.def.price} G`, 15, own ? C.faint : poor ? C.warn : C.keep, 'end', true);
    });
    const g = SHOP[gs.cur.shop], price = g.def.price ?? 0, own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id);
    l.text(494, 114, g.def.name, 22, C.text, 'start', true);
    l.text(896, 114, own ? '購入済み' : `${price} G`, 18, own ? C.faint : C.keep, 'end', true);
    if (g.kind === 'weapon') {
      // 選んでいる武器と、いまの武器を上下にそろえて比べる
      l.text(494, 162, g.def.name, 13, C.text, 'start', true);
      powerChips(l, 660, 162, g.def.power);
      l.text(494, 196, `現在: ${gs.weapon.name}`, 12, C.dim, 'start');
      powerChips(l, 660, 196, gs.weapon.power, 0.6);
    } else {
      l.text(494, 162, g.def.name, 13, C.text, 'start', true);
      l.text(660, 162, `被ダメージ −${g.def.def}（最低1）`, 15, C.text, 'start', true);
      l.text(494, 196, `現在: ${gs.armor.name}`, 12, C.dim, 'start');
      l.text(660, 196, `被ダメージ −${gs.armor.def}`, 15, C.dim, 'start', true);
    }
    l.text(494, 240, g.def.desc, 12, C.dim, 'start');
    l.text(494, 296, own ? '「装備」で着けられる。' : s.gold < price ? `あと ${price - s.gold} G 足りない。` : '買った物は「装備」で着ける。', 12, own ? C.dim : s.gold < price ? C.warn : C.keep, 'start');
  } else if (!sell.length) {
    l.rect(40, 80, 400, 100, { fill: C.panel, stroke: C.line, rx: 12 });
    l.text(60, 116, '売れる物がない。', 14, C.dim, 'start');
    l.text(60, 144, '敵を討伐すると手に入る。', 13, C.faint, 'start');
    l.text(494, 114, '売る', 22, C.dim, 'start', true);
    l.text(494, 160, '戦利品をお金に換えられる。', 13, C.dim, 'start');
  } else {
    const total = sell.reduce((n, d) => n + d.price * s.loot[d.id], 0), cur = Math.min(gs.cur.sell, sell.length);
    const ys = rows(l, 40, 80, 400, 44, sell.length + 1, cur, { heads: { 0: '戦利品' } });
    sell.forEach((d, i) => {
      l.text(80, ys[i], d.name, 16, C.text, 'start', i === cur);
      l.text(320, ys[i], `×${s.loot[d.id]}`, 13, C.dim, 'end');
      l.text(418, ys[i], `${d.price} G`, 15, C.keep, 'end', true);
    });
    l.text(80, ys[sell.length], 'すべて売る', 16, C.text, 'start', cur === sell.length);
    l.text(418, ys[sell.length], `+${total} G`, 15, C.item, 'end', true);
    const d = sell[cur];
    if (d) {
      const from = ENEMIES.find(e => e.drop?.id === d.id);
      l.text(494, 114, d.name, 22, C.text, 'start', true);
      l.text(494, 160, `1個 ${d.price} G`, 15, C.text, 'start', true);
      l.text(494, 190, `所持 ${s.loot[d.id]}個`, 13, C.dim, 'start');
      if (from) l.text(494, 240, `${from.name} の戦利品。`, 13, C.dim, 'start');
      l.text(494, 296, '個数を選んで売る。', 12, C.keep, 'start');
    } else {
      l.text(494, 114, 'すべて売る', 22, C.text, 'start', true);
      l.text(494, 160, `合計 +${total} G`, 15, C.text, 'start', true);
      l.text(494, 190, sell.map(x => `${x.name} ×${s.loot[x.id]}`).join('　'), 12, C.dim, 'start');
      l.text(494, 296, '持っている戦利品をまとめて売る。', 12, C.keep, 'start');
    }
  }
  guide(gs, l,
    buying ? '↑↓ 選ぶ　　○ 買う　　L1 / R1 売る　　✕ 戻る' : '↑↓ 選ぶ　　○ 売る　　L1 / R1 買う　　✕ 戻る',
    buying ? '↑↓ 選ぶ　　Enter 買う　　←→ 売る　　Backspace 戻る' : '↑↓ 選ぶ　　Enter 売る　　←→ 買う　　Backspace 戻る');
}
