// メニュー類（HTML）。C 柱の案（docs/samples/style-S4-C.png）。仕様は docs/look.md の13章
// 左に柱を立ててメニューの項目を縦に並べ、右に選んだ画面の中身を出す。盤面から開いたときは、柱に盤面のメニューの項目を出す
import { html, nothing, type TemplateResult } from 'lit-html';
import { LEVEL_LABELS } from '../game/battle';
import { runeKey } from '../game/runes';
import { ATTACKS, ENEMIES, RULES, SHOP, SPELLS } from '../game/content';
import { EQUIP_ROWS, MENU, SQUARE } from '../screens/common';
import type { GameScene } from '../scenes/GameScene';

const LEVELS = ['C', 'B', 'A', 'S'];
const corners = html`<div class="corner" style="left:14px;top:14px;border-left:1px solid var(--gold);border-top:1px solid var(--gold)"></div>
  <div class="corner" style="right:14px;bottom:14px;border-right:1px solid var(--gold);border-bottom:1px solid var(--gold)"></div>`;
/** 操作の案内。[ゲームパッド, キーボード, 説明] を並べる */
const guide = (gs: GameScene, items: [string, string, string][]) =>
  html`<div class="guide">${items.map(([p, k, t]) => html`<span class="key">${gs.pad ? p : k}</span>${t}`)}</div>`;
const BACK: [string, string, string] = ['✕', 'Backspace', '戻る'];

/** 武器の威力の札。cmp を渡すと、上がる所を金、下がる所を差し色に */
function chips(p: number[], cmp?: number[]) {
  return html`<span class="chips">${LEVELS.map((l, i) => html`<span class="chip"><b>${l}</b><span class=${cmp ? (p[i] > cmp[i] ? 'up' : p[i] < cmp[i] ? 'down' : '') : ''}>${p[i]}</span></span>`)}</span>`;
}

// ---------------- 柱 ----------------
type Tab = { label: string; off?: boolean; note?: string; act?: string };
function tabs(gs: GameScene): { items: Tab[]; title: string; sub?: string } {
  if (gs.base === 'board' && gs.run) return { items: gs.dmenuItems().map(x => ({ label: x.label, act: x.act })), title: 'MENU', sub: gs.run.def.name };
  return { items: MENU.map(m => ({ label: m.label, off: m.off, note: m.off ? '準備中' : undefined, act: m.act })), title: 'MENU' };
}
/** focus: 柱を操作している（メニューを開いたところ）。そうでなければ、active の項目の中身を右に出している */
function pillar(gs: GameScene, active: number, focus: boolean) {
  const { items, title, sub } = tabs(gs);
  return html`<div class="pil"><div class="t">${title}${sub ? html`<small>${sub}</small>` : nothing}</div>
    ${items.map((t, i) => html`<div class="tab ${focus && i === active ? 'on' : ''} ${!focus && i === active ? 'cur' : ''} ${t.off ? 'off' : ''} ${gs.restartArmed && t.act === 'restart' ? 'warn' : ''}" style="top:${90 + i * 46}px">${t.label}${t.note ? html`<small>${t.note}</small>` : nothing}</div>`)}
    <div class="sm" style="left:30px;top:442px">所持金</div>
    <div class="n" style="position:absolute;left:30px;top:458px;font-size:24px">${gs.save.gold}<span style="font-size:11px;color:var(--sub);margin-left:6px">G</span></div></div>`;
}
const activeOf = (gs: GameScene, act: string) => tabs(gs).items.findIndex(t => t.act === act);
const page = (gs: GameScene, act: string, body: TemplateResult) => html`<div class="mn">${pillar(gs, activeOf(gs, act), false)}${corners}${body}</div>`;

// ---------------- メニュー（右は空ける） ----------------
export function menuView(gs: GameScene) {
  return html`<div class="mn">${pillar(gs, gs.cur.menu, true)}${corners}
    ${guide(gs, [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', '決定'], ['✕', 'Esc', '閉じる']])}</div>`;
}
/** 盤面のメニュー。項目の注記は柱に出しきれないので、選んでいる項目の注記だけ右に出す */
export function dmenuView(gs: GameScene) {
  const items = gs.dmenuItems(), cur = items[gs.cur.dmenu];
  return html`<div class="mn">${pillar(gs, gs.cur.dmenu, true)}${corners}
    ${cur?.note ? html`<div class="desc" style="left:270px;top:${90 + gs.cur.dmenu * 46 + 12}px">${cur.note}</div>` : nothing}
    ${guide(gs, [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', '決定'], ['✕', 'Esc', '閉じる']])}</div>`;
}

// ---------------- 装備 ----------------
const KIND = ['武器', '防具', 'アクセサリ', 'アイテム', 'アイテム', 'アイテム'];
export function equipView(gs: GameScene) {
  const s = gs.save, slots = gs.equipFocus === 'slots';
  const value = (i: number) => i === 0 ? gs.weapon.name : i === 1 ? gs.armor.name : i === 2 ? gs.accessory?.name ?? 'なし' : (gs.itemName(s.items[i - 3]) ?? 'なし');
  const slotRow = (i: number, top: number) => {
    const v = value(i), sel = i === gs.cur.slot;
    return html`<div class="row ${sel && slots ? 'on' : ''} ${sel && !slots ? 'mark' : ''}" style="left:270px;top:${top}px;width:300px">${EQUIP_ROWS[i]}<span class="r ${v === 'なし' ? 'off' : ''}">${v}</span></div>`;
  };
  const opts = gs.equipOptions(), shown = slots ? Math.max(0, opts.findIndex(o => o.on)) : gs.cur.opt, d = opts[shown];
  const pitch = opts.length > 4 ? 38 : 42;
  const listEnd = 110 + opts.length * pitch;
  let detail: TemplateResult | typeof nothing = nothing;
  if (d?.power) detail = html`<div class="cmp" style="left:630px;top:${listEnd + 22}px;width:290px">
      <div class="ln"><span class="nm">${d.name}</span>${chips(d.power, d.on ? undefined : gs.weapon.power)}</div>
      ${d.on ? nothing : html`<div class="ln old"><span class="nm">現在: ${gs.weapon.name}</span>${chips(gs.weapon.power)}</div>`}</div>
    <div class="desc" style="left:630px;top:${listEnd + (d.on ? 70 : 104)}px;width:290px">${d.desc}</div>`;
  else if (d && d.def !== undefined) detail = html`<div class="cmp" style="left:630px;top:${listEnd + 22}px;width:290px">
      <div class="ln"><span class="nm">${d.name}</span><span class="def ${d.on ? '' : d.def > gs.armor.def ? 'up' : d.def < gs.armor.def ? 'down' : ''}">−${d.def}<small>被ダメージ${d.def ? '（最低1）' : ''}</small></span></div>
      ${d.on ? nothing : html`<div class="ln old"><span class="nm">現在: ${gs.armor.name}</span><span class="def" style="opacity:.5">−${gs.armor.def}</span></div>`}</div>
    <div class="desc" style="left:630px;top:${listEnd + (d.on ? 70 : 104)}px;width:290px">${d.desc}</div>`;
  else if (d) detail = html`<div class="desc" style="left:630px;top:${listEnd + 22}px;width:290px">${d.desc}</div>`;
  return page(gs, 'equip', html`<div class="pg">装備</div>
    <div class="hd" style="left:270px;top:92px">装備</div>${[0, 1, 2].map(i => slotRow(i, 110 + i * 42))}
    <div class="hd" style="left:270px;top:250px">アイテム（重複不可）</div>${[3, 4, 5].map(i => slotRow(i, 268 + (i - 3) * 42))}
    <div class="vl" style="left:600px;top:92px;height:380px"></div>
    <div class="hd" style="left:630px;top:92px">${KIND[gs.cur.slot]}一覧</div>
    ${opts.map((o, i) => html`<div class="row ${i === shown && !slots ? 'on' : ''} ${i === shown && slots ? 'lit' : ''}" style="left:630px;top:${110 + i * pitch}px;width:290px;height:${pitch}px">${o.name}${o.note ? html`<span class="r">${o.note}</span>` : nothing}</div>`)}
    ${detail}
    ${guide(gs, slots ? [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', '変更'], BACK] : [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', 'セット'], ['✕', 'Backspace', 'やめる']])}`);
}

// ---------------- カード編集 ----------------
export function deckView(gs: GameScene) {
  const sp = gs.save.spells, p = gs.weapon.power, nAtk = ATTACKS.reduce((n, c) => n + c.copies, 0), d = SPELLS[gs.cur.deck];
  return page(gs, 'deck', html`<div class="pg">カード編集</div>
    <div style="position:absolute;left:470px;top:40px;font-size:12px;letter-spacing:2px;color:var(--sub)">デッキ <span class="n" style="font-size:18px;color:#fff">${nAtk + sp.length}</span> 枚</div>
    <div class="hd" style="left:270px;top:92px">アタック（枚数は固定）</div>
    ${ATTACKS.map((c, i) => html`<div class="row" style="left:270px;top:${110 + i * 42}px;width:300px;color:var(--sub)"><span class="mk gold">${LEVEL_LABELS[c.lv!]}</span>威力 ${p[c.lv! - 1]}<span class="r n" style="font-size:16px;color:#fff">× ${c.copies}</span></div>`)}
    <div class="desc" style="left:270px;top:${120 + ATTACKS.length * 42}px;width:300px;letter-spacing:2px;line-height:2">武器　　　　<span style="color:#fff">${gs.weapon.name}</span><br>アクセサリ　<span style="color:${gs.accessory ? '#fff' : '#5c554a'}">${gs.accessory?.name ?? 'なし'}</span></div>
    <div class="vl" style="left:600px;top:92px;height:380px"></div>
    <div class="hd" style="left:630px;top:92px">スペル（重複不可）</div>
    <div class="cnt" style="right:40px;top:70px"><span class="big">${sp.length}</span><span class="of">/ ${RULES.maxSpells}</span><span class="u">枚</span></div>
    ${SPELLS.map((c, i) => { const on = sp.includes(c.id); return html`<div class="row ${i === gs.cur.deck ? 'on' : ''} ${on ? 'lit' : ''}" style="left:630px;top:${110 + i * 44}px;width:290px;height:44px"><span class="mk ${on ? '' : 'off'}">${c.mark === '×2' ? 'x2' : c.mark}</span>${c.name}<span class="r g">${on ? '採用中' : ''}</span></div>`; })}
    <div class="desc" style="left:630px;top:${130 + SPELLS.length * 44}px;width:290px">${d.long}<br>スペルの効果は、次に出すアタックに乗る。重ね掛け可。</div>
    ${guide(gs, [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', '入れる / 外す'], BACK])}`);
}

// ---------------- ショップ ----------------
export function shopView(gs: GameScene) {
  const s = gs.save, buying = gs.shopTab === 0, sell = gs.sellList();
  const head = html`<div class="pg">ショップ</div>
    <div class="tabs" style="left:440px;top:44px"><span class=${buying ? 'on' : ''}>買う</span><span class=${buying ? '' : 'on'}>売る</span><span class="sw">${gs.pad ? 'L1 / R1' : '← →'}</span></div>
    <div class="vl" style="left:600px;top:100px;height:372px"></div>`;
  let body: TemplateResult;
  if (buying) {
    const firstArmor = SHOP.findIndex(g => g.kind === 'armor');
    const rowOf = (i: number) => {
      const g = SHOP[i], own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id), poor = !own && s.gold < (g.def.price ?? 0);
      const top = 118 + i * 44 + (i >= firstArmor ? 34 : 0);
      return html`<div class="row ${i === gs.cur.shop ? 'on' : ''} ${own ? 'off' : ''}" style="left:270px;top:${top}px;width:300px;height:44px">${g.def.name}<span class="r ${own ? 'off' : poor ? 'warn' : 'g'}">${own ? '購入済み' : `${g.def.price} G`}</span></div>`;
    };
    const g = SHOP[gs.cur.shop], price = g.def.price ?? 0, own = (g.kind === 'weapon' ? s.weapons : s.armors).includes(g.def.id);
    const cmp = g.kind === 'weapon'
      ? html`<div class="ln"><span class="nm">${g.def.name}</span>${chips(g.def.power, gs.weapon.power)}</div><div class="ln old"><span class="nm">現在: ${gs.weapon.name}</span>${chips(gs.weapon.power)}</div>`
      : html`<div class="ln"><span class="nm">${g.def.name}</span><span class="def">−${g.def.def}<small>被ダメージ（最低1）</small></span></div><div class="ln old"><span class="nm">現在: ${gs.armor.name}</span><span class="def" style="opacity:.5">−${gs.armor.def}</span></div>`;
    body = html`<div class="hd" style="left:270px;top:100px">武器</div><div class="hd" style="left:270px;top:${100 + firstArmor * 44 + 34}px">防具</div>
      ${SHOP.map((_, i) => rowOf(i))}
      <div class="cmp" style="left:630px;top:118px;width:290px">${cmp}</div>
      <div class="desc" style="left:630px;top:204px;width:290px">${g.def.desc}</div>
      ${!own && s.gold < price ? html`<div class="note" style="left:630px;top:300px">あと ${price - s.gold} G 足りない。</div>` : nothing}`;
  } else if (!sell.length) {
    body = html`<div class="desc" style="left:270px;top:110px;width:300px;font-size:13px">売れる物がない。<br>敵を討伐すると手に入る。</div>
      <div class="desc" style="left:630px;top:110px;width:290px">戦利品をお金に換えられる。</div>`;
  } else {
    const cur = Math.min(gs.cur.sell, sell.length), total = sell.reduce((n, x) => n + x.price * s.loot[x.id], 0), d = sell[cur];
    const from = d ? ENEMIES.find(e => e.drop?.id === d.id) : undefined;
    body = html`<div class="hd" style="left:270px;top:100px">戦利品</div>
      ${sell.map((x, i) => html`<div class="row ${i === cur ? 'on' : ''}" style="left:270px;top:${118 + i * 44}px;width:300px;height:44px">${x.name}<span class="r">×${s.loot[x.id]}　<span style="color:var(--gold)">${x.price} G</span></span></div>`)}
      <div class="row ${cur === sell.length ? 'on' : ''}" style="left:270px;top:${118 + sell.length * 44}px;width:300px;height:44px">すべて売る<span class="r g">+${total} G</span></div>
      ${d ? html`<div style="position:absolute;left:630px;top:118px;font-size:18px;letter-spacing:3px">1個 <span class="n" style="color:var(--gold)">${d.price} G</span></div>
        <div class="desc" style="left:630px;top:158px;width:290px">所持 ${s.loot[d.id]}個${from ? html`<br>${from.name} の戦利品。` : nothing}<br>個数を選んで売る。</div>`
        : html`<div style="position:absolute;left:630px;top:118px;font-size:18px;letter-spacing:3px">合計 <span class="n" style="color:var(--gold)">+${total} G</span></div>
        <div class="desc" style="left:630px;top:158px;width:290px">${sell.map(x => `${x.name} ×${s.loot[x.id]}`).join('　')}<br>持っている戦利品をまとめて売る。</div>`}`;
  }
  return page(gs, 'shop', html`${head}${body}
    ${guide(gs, [['↑ ↓', '↑ ↓', '選ぶ'], ['○', 'Enter', buying ? '買う' : '売る'], [gs.pad ? 'L1 / R1' : '← →', '← →', buying ? '売る' : '買う'], BACK])}`);
}

/** 売買の確認。ショップの右側に重ねる。売るときは個数も選ぶ */
export function confirmView(gs: GameScene) {
  const d = gs.deal, s = gs.save;
  if (!d) return html``;
  let act = '買う', after = s.gold, body: TemplateResult;
  if (d.kind === 'buy') {
    const g = SHOP[d.index], price = g.def.price ?? 0;
    after = s.gold - price;
    body = html`<div class="ask" style="top:40px">${g.def.name} を買いますか？</div>
      <div class="ask n" style="top:84px;font-size:30px;color:var(--gold)">${price} G</div>`;
  } else if (d.kind === 'sell') {
    const x = gs.sellList().find(v => v.id === d.id), max = s.loot[d.id] ?? 0, price = x?.price ?? 0;
    act = '売る'; after = s.gold + price * d.qty;
    body = html`<div class="ask" style="top:30px">${x?.name ?? ''} を売りますか？</div>
      <div class="ask" style="top:66px;font-size:12px;color:var(--sub)">個数　<span style="color:${max > 1 ? '#fff' : '#5c554a'}">▼</span>　<span class="n" style="font-size:30px;color:#fff">${d.qty}</span>　<span style="color:${max > 1 ? '#fff' : '#5c554a'}">▲</span>　/ ${max}</div>
      <div class="ask n" style="top:112px;font-size:18px;color:var(--gold)">+${price * d.qty} G</div>`;
  } else {
    const list = gs.sellList(), total = list.reduce((n, x) => n + x.price * s.loot[x.id], 0);
    act = '売る'; after = s.gold + total;
    body = html`<div class="ask" style="top:30px">戦利品をすべて売りますか？</div>
      <div class="ask" style="top:66px;font-size:11px;color:var(--sub)">${list.map(x => `${x.name} ×${s.loot[x.id]}`).join('　')}</div>
      <div class="ask n" style="top:94px;font-size:30px;color:var(--gold)">+${total} G</div>`;
  }
  const qty = d.kind === 'sell';
  return html`<div class="mn" style="background:transparent;z-index:21"><div class="dim"></div>
    <div class="fr2" style="left:329px;top:144px;width:562px;height:262px"></div><div class="fr" style="left:335px;top:150px;width:550px;height:250px">
      ${body}
      <div class="ask" style="top:150px;font-size:11px;color:var(--sub)">所持金　${s.gold} G　→　<span style="color:#fff">${after} G</span></div>
    </div>
    ${[act, 'やめる'].map((l, i) => html`<div class="ch ${i === gs.dealCursor ? 'on' : ''}" style="left:${420 + i * 196}px;top:342px;width:184px">${l}</div>`)}
    ${guide(gs, [...(qty ? [['↑ ↓', '↑ ↓', '個数'] as [string, string, string]] : []), ['← →', '← →', '選ぶ'], ['○', 'Enter', '決定'], ['✕', 'Backspace', 'やめる']])}</div>`;
}

// ---------------- 操作説明 ----------------
const HELP: [string, string, string][] = [
  ['カードを出す', '△ ○ ✕ □', 'W D S A（上・右・下・左）'], ['キープ / 解除', '十字キー', '矢印キー'], ['入れ替え', 'R1・L1', 'スペース'],
  ['アイテムを切り替える', 'L2', 'Q'], ['アイテムを使う', 'R2', 'E'], ['メニュー / ポーズ', 'OPTIONS', 'Esc'],
  ['決定 / 戻る（メニュー）', '○ / ✕', 'Enter / Backspace'], ['消音', '–', 'M'],
  ['テスト（戦闘: 無敵 / 盤面: サイコロの目を選ぶ）', 'タッチパッド', 'T'],
];
const RULES_TEXT = [
  'カードは C → B → A → S の順。同じレベル・1つ下・C はいつでも出せる。S を出すとチェインは消える。',
  'スペルの効果は、次に出すアタックに乗る。重ね掛け可。',
  '入れ替えるとチェインが1段下がる。使い切れば下がらない。4枚目がアタックなら +1 ダメージ。',
  '出せるカードがなくなると、自動で入れ替わる。',
  'アイテムは3つまで。それぞれ1戦に1回。',
  'ダンジョンでは、HPとアイテムの使用を次の戦闘に持ち越す。マスの効果で回復・復活する。',
];
export function helpView(gs: GameScene) {
  return page(gs, 'help', html`<div class="pg">操作説明</div>
    <table style="left:270px;top:92px;width:650px"><tr><th>操作</th><th>ゲームパッド</th><th>キーボード</th></tr>
      ${HELP.map(r => html`<tr><td class="k">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`)}</table>
    <div class="hd" style="left:270px;top:356px">ルール</div>
    <ul class="rules" style="left:270px;top:374px;width:650px">${RULES_TEXT.map(r => html`<li>${r}</li>`)}</ul>
    ${guide(gs, [BACK])}`);
}

// ---------------- セーブリセット ----------------
export function resetView(gs: GameScene) {
  return page(gs, 'reset', html`<div class="pg">セーブリセット</div>
    <div class="fr2" style="left:329px;top:134px;width:562px;height:252px"></div><div class="fr warn" style="left:335px;top:140px;width:550px;height:240px">
      <div class="ask" style="top:36px">セーブデータを消しますか？</div>
      <div class="ask" style="top:78px;font-size:12px;color:var(--sub)">装備、所持金、持ち物、記録がすべて消えます。</div>
      <div class="ask" style="top:102px;font-size:12px;color:var(--ac)">元に戻せません。</div></div>
    ${['いいえ', 'はい、消す'].map((l, i) => html`<div class="ch ${i === gs.cur.reset ? 'on' : ''} ${i ? 'warn' : ''}" style="left:${420 + i * 196}px;top:310px;width:184px">${l}</div>`)}
    ${guide(gs, [['← →', '← →', '選ぶ'], ['○', 'Enter', '決定'], ['✕', 'Backspace', 'やめる']])}`);
}

// ---------------- マスの説明（盤面のメニューから） ----------------
const iconCache = new Map<string, string>();
function iconUrl(gs: GameScene, key: string) {
  if (!iconCache.has(key) && gs.textures.exists(key)) { try { iconCache.set(key, gs.textures.getBase64(key)); } catch { /* 絵が無くても続ける */ } }
  return iconCache.get(key) ?? '';
}
export function legendView(gs: GameScene) {
  const d = gs.run!.def;
  const list: [string, string][] = [
    ['monster', '敵と戦う。討伐すると戦利品を1つ得る。'], ['heal', `HP +${d.heal}。`],
    ['maxhp', `最大HP +${d.maxHpUp}。HPも同じだけ回復。負けると消える。`], ['item', '使ったアイテムが1つ復活する。'],
    ['event', `${d.event.name}。${d.event.damage} ダメージ（HPは1残る）。`], ['random', '上のどれか、または何も起こらない。'],
    ['mid', '必ず止まる。討伐すると、負けてもここから再開。'], ['boss', '必ず止まる。討伐すると踏破。'],
  ];
  // メニューの柱は出さない（盤面の △ で開く画面。メニューの項目ではない）
  return html`<div class="mn">${corners}<div class="pg" style="left:40px">マスの説明</div>
    ${list.map(([k, t], i) => { const sq = SQUARE[k], url = iconUrl(gs, runeKey(k)); return html`<div class="row" style="left:40px;top:${92 + i * 44}px;width:880px;height:44px;color:#fff"><span class="sq">${url ? html`<img src=${url}>` : nothing}</span><span style="width:150px">${sq.name}</span><span style="font-size:12px;letter-spacing:1px;color:var(--sub);white-space:normal">${t}</span></div>`; })}
    <div class="row" style="left:40px;top:${92 + list.length * 44}px;width:880px;height:44px;color:#fff"><span class="sq" style="background:linear-gradient(135deg,#585049,#3d3631);border-radius:3px"></span><span style="width:150px">絵のないマス</span><span style="font-size:12px;letter-spacing:1px;color:var(--sub)">何も起こらない。</span></div>
    ${guide(gs, [BACK])}</div>`;
}
