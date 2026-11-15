// 画面を通しで動かす確認。ルールの細部は src/game/battle.test.ts が見るので、ここは「画面がつながっているか」を見る。
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { battle, close, key, open, playAttack, ready, save, scene, start, stored, toReady, top, waitTop, win, type Game } from './helpers';

let g: Game;
afterEach(async () => { expect(g.errors).toEqual([]); await g.page.close(); });
afterAll(close);

const RICH = { gold: 400, loot: { slime_core: 3, dragon_scale: 2 } };

describe('敵の一覧', () => {
  it('起動すると敵の一覧が出る。出現していない敵は選べない', async () => {
    g = await open();
    expect(await top(g.page)).toBe('list');
    await key(g.page, 'ArrowUp', 'Enter');             // 最後の敵（未出現）
    expect(await top(g.page)).toBe('list');
    await key(g.page, 'ArrowDown');                     // 先頭に戻る
    await toReady(g.page);
    expect(await scene(g.page, s => s.enemy.id)).toBe('slime');
  });

  it('前の敵をすべて討伐すると、次の敵が選べるようになる', async () => {
    const rec = { bestTime: 30, bestRank: 'B' };
    g = await open({ records: { slime: rec, golem: rec, dragon: rec } });
    await toReady(g.page, 3);
    expect(await scene(g.page, s => s.enemy.id)).toBe('maou');
    await key(g.page, 'Backspace');
    await waitTop(g.page, 'list');
    await key(g.page, 'ArrowDown', 'Enter');            // その次はまだ出ていない
    expect(await top(g.page)).toBe('list');
  });
});

describe('戦闘', () => {
  it('開始に使ったボタンのカードは出ない。開始前は ✕ で一覧に戻れる', async () => {
    g = await open();
    await toReady(g.page);
    await key(g.page, 'KeyS');
    await waitTop(g.page, 'list');
    await toReady(g.page);
    await start(g.page);
    expect(await battle(g.page, b => b.stats.plays)).toBe(0);
  });

  it('討伐すると結果が出て、記録と戦利品が保存される', async () => {
    g = await open();
    await toReady(g.page);
    await start(g.page);
    await win(g.page);
    expect(await battle(g.page, b => b.result)).toBe('won');
    const s = await save(g.page);
    expect(s.records.slime.bestRank).toMatch(/^[SABC]$/);
    expect(s.loot.slime_core).toBe(1);
    await key(g.page, 'Enter');                         // 一覧に戻る
    await waitTop(g.page, 'list');
    await g.page.reload(); await ready(g.page);         // 開き直しても残る
    expect((await save(g.page)).records.slime).toBeTruthy();
  });

  it('負けると敗北の結果が出て、もう一度挑める。記録は付かない', async () => {
    g = await open();
    await toReady(g.page);
    await start(g.page);
    await battle(g.page, b => { b.hp = 1; b.enemy.gauge = 99; });
    await waitTop(g.page, 'result');
    expect(await battle(g.page, b => b.result)).toBe('lost');
    await g.page.waitForFunction(() => (window as any).__scene.resultWait <= 0);
    await key(g.page, 'Enter');                         // もう一度
    await waitTop(g.page, 'ready');
    expect(await battle(g.page, b => b.hp)).toBe(100);
    expect((await save(g.page)).records).toEqual({});
  });

  it('ポーズ中は時間が止まり、再開はカウントを挟む。戦闘終了で一覧に戻る', async () => {
    g = await open();
    await toReady(g.page);
    await start(g.page);
    await g.page.waitForFunction(() => (window as any).__battle.time > 0.2);
    await key(g.page, 'Escape');
    expect(await top(g.page)).toBe('pause');
    const t0 = await battle(g.page, b => b.time);
    await g.page.waitForTimeout(500);
    expect(await battle(g.page, b => b.time)).toBe(t0);
    await key(g.page, 'Enter');
    expect(await top(g.page)).toBe('resume');
    await waitTop(g.page, 'fight');
    await key(g.page, 'Escape', 'ArrowDown', 'ArrowDown', 'Enter');
    await waitTop(g.page, 'list');
  });

  it('無敵（テスト用）を使った戦闘は、記録も戦利品も付かない', async () => {
    g = await open();
    await toReady(g.page);
    await key(g.page, 'KeyT');
    await start(g.page);
    await g.page.waitForFunction(() => (window as any).__battle.usedInvincible);
    await win(g.page);
    const s = await save(g.page);
    expect(s.records).toEqual({});
    expect(s.loot).toEqual({});
  });

  it('アイテムは Q で切り替え、E で使う', async () => {
    g = await open();
    await toReady(g.page);
    await start(g.page);
    await battle(g.page, b => { b.hp = 50; });
    await key(g.page, 'KeyE');                          // 回復薬
    expect(await battle(g.page, b => b.hp)).toBe(70);
    expect(await battle(g.page, b => b.items[0].used)).toBe(true);
    const sel = await battle(g.page, b => b.selected);
    await key(g.page, 'KeyQ');
    expect(await battle(g.page, b => b.selected)).not.toBe(sel);
    await playAttack(g.page);                           // カードも出せる
    expect(await battle(g.page, b => b.stats.plays)).toBeGreaterThan(0);
  });
});

describe('メニュー', () => {
  it('灰色の項目は飛ばす。✕ で閉じる', async () => {
    g = await open();
    await key(g.page, 'Escape');
    expect(await top(g.page)).toBe('menu');
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) { labels.push(await scene(g.page, s => s.cur.menu)); await key(g.page, 'ArrowDown'); }
    expect(new Set(labels).size).toBe(6);               // 7項目のうち1つ（設定）は止まらない
    await key(g.page, 'Backspace');
    expect(await top(g.page)).toBe('list');
  });

  it('装備: 武器を持ち替えると戦闘に反映される。同じアイテムは2つセットできない', async () => {
    g = await open({ weapons: ['axe'], armors: ['iron'] });
    await key(g.page, 'Escape', 'Enter');
    expect(await top(g.page)).toBe('equip');
    await key(g.page, 'Enter', 'ArrowDown', 'Enter');   // 武器 → 2つ目（斧）
    expect((await save(g.page)).weapon).toBe('axe');
    await key(g.page, 'ArrowDown', 'ArrowDown', 'Enter');   // アイテム1（アクセサリは飛ばす）
    const before = (await save(g.page)).items;
    const want = before[1];                             // アイテム2にある物を、アイテム1に選ぶ
    for (let i = 0; i < 8 && (await scene(g.page, s => s.equipOptions()[s.cur.opt].id)) !== want; i++) await key(g.page, 'ArrowDown');
    await key(g.page, 'Enter');
    const after = (await save(g.page)).items;
    expect(after[0]).toBe(want);
    expect(after[1]).toBe(before[0]);                   // 入れ替わる
    expect(new Set(after.filter(Boolean)).size).toBe(after.filter(Boolean).length);
    await key(g.page, 'Backspace', 'Backspace');
    await toReady(g.page);
    expect(await battle(g.page, b => b.gear.power)).toEqual([0, 3, 5, 20]);
    expect(await battle(g.page, b => b.gear.attackWaitSec)).toBe(0.5);
  });

  it('カード編集: スペルは2枚まで。入れなければデッキは28枚', async () => {
    g = await open();
    await key(g.page, 'Escape', 'ArrowDown', 'Enter');
    expect(await top(g.page)).toBe('deck');
    await key(g.page, 'ArrowDown', 'ArrowDown', 'Enter');   // 3枚目は入らない
    expect((await save(g.page)).spells).toEqual(['double', 'levelx']);
    await key(g.page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');   // 2枚とも外す
    expect((await save(g.page)).spells).toEqual([]);
    await key(g.page, 'Backspace', 'Backspace');
    await toReady(g.page);
    expect(await battle(g.page, b => b.pool.length + b.slots.filter((s: any) => s.card).length)).toBe(28);
  });

  it('ショップ: 買うときは確認が出る。やめれば何も変わらない', async () => {
    g = await open(RICH);
    await key(g.page, 'Escape', 'ArrowDown', 'ArrowDown', 'Enter');
    expect(await top(g.page)).toBe('shop');
    await key(g.page, 'Enter');
    expect(await top(g.page)).toBe('confirm');
    await key(g.page, 'ArrowRight', 'Enter');           // やめる
    expect((await save(g.page)).gold).toBe(400);
    await key(g.page, 'Enter', 'Enter');                // 買う
    const s = await save(g.page);
    expect(s.weapons).toContain('axe');
    expect(s.gold).toBe(300);
    await key(g.page, 'Enter');                         // 購入済みは買えない
    expect(await top(g.page)).toBe('shop');
    expect((await stored(g.page)).gold).toBe(300);      // 保存もされている
  });

  it('ショップ: 個数を選んで売れる。すべて売ると戦利品がなくなる', async () => {
    g = await open(RICH);
    await key(g.page, 'Escape', 'ArrowDown', 'ArrowDown', 'Enter', 'Space');   // 売る側へ
    await key(g.page, 'Enter', 'ArrowUp', 'Enter');     // スライムの核を2個
    let s = await save(g.page);
    expect(s.loot.slime_core).toBe(1);
    expect(s.gold).toBe(440);
    await key(g.page, 'ArrowUp', 'Enter');              // すべて売る
    expect(await top(g.page)).toBe('confirm');
    await key(g.page, 'Backspace');                     // ✕ で取り消せる
    expect((await save(g.page)).gold).toBe(440);
    await key(g.page, 'Enter', 'Enter');
    s = await save(g.page);
    expect(s.loot).toEqual({});
    expect(s.gold).toBe(660);
    await key(g.page, 'Enter');                         // 売る物がなくても落ちない
    expect(await top(g.page)).toBe('shop');
  });

  it('セーブリセット: 「いいえ」が初期位置。「はい」で初期状態に戻る', async () => {
    g = await open({ ...RICH, weapons: ['axe'], weapon: 'axe', records: { slime: { bestTime: 20, bestRank: 'A' } } });
    await key(g.page, 'Escape', 'ArrowUp', 'ArrowUp', 'Enter');
    expect(await top(g.page)).toBe('reset');
    await key(g.page, 'Enter');                         // いいえ
    expect((await save(g.page)).gold).toBe(400);
    await key(g.page, 'Enter', 'ArrowRight', 'Enter');  // はい
    await waitTop(g.page, 'list');
    const s = await save(g.page);
    expect(s).toMatchObject({ gold: 0, weapon: 'sword', records: {}, loot: {} });
    expect(await stored(g.page)).toBeNull();
  });

  it('操作説明が開いて、閉じられる', async () => {
    g = await open();
    await key(g.page, 'Escape', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
    expect(await top(g.page)).toBe('help');
    await key(g.page, 'Backspace', 'Backspace');
    expect(await top(g.page)).toBe('list');
  });
});

describe('セーブデータ', () => {
  it('古い形式や壊れた内容でも、初期値で補って起動する', async () => {
    g = await open({ items: ['potion', 'potion', 'nope'], spells: ['double', 'double', 'x'], weapon: 'durandal', gold: -5 });
    const s = await save(g.page);
    expect(s.items).toEqual(['potion', null, null]);    // 重複と不明な物は外れる
    expect(s.spells).toEqual(['double']);
    expect(s.weapon).toBe('sword');                     // 持っていない武器は装備できない
    expect(s.gold).toBe(0);
  });
});
