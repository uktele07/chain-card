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
    await key(g.page, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');   // アイテム1（武器 → 防具 → アクセサリ → アイテム1）
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

describe('ダンジョン', () => {
  /** 行き先をダンジョンに切り替えて、炎の神殿に入る */
  const enter = async () => { await key(g.page, 'ArrowRight', 'Enter'); await waitTop(g.page, 'board'); };
  const mode = (m: string) => g.page.waitForFunction(x => (window as any).__scene.bmode === x, m);
  /** サイコロの目と敵の抽選を固定する（v=0 なら 1 の目） */
  /** サイコロを回して、止める */
  const roll = async () => { await key(g.page, 'Enter'); await mode('rolling'); await key(g.page, 'Enter'); };
  const fix = (v: number) => g.page.evaluate(x => { (window as any).__scene.run.rng = () => x; }, v);

  it('準備中のダンジョンには入れない。炎の神殿に入ると盤面が出る', async () => {
    g = await open();
    await key(g.page, 'ArrowRight', 'ArrowDown', 'Enter');
    expect(await top(g.page)).toBe('list');
    await key(g.page, 'ArrowUp', 'Enter');
    await waitTop(g.page, 'board');
    expect(await scene(g.page, s => [s.run.state.pos, s.bmode])).toEqual([0, 'idle']);
  });

  it('入口にいる間だけ、盤面のメニューから装備を変えられる', async () => {
    g = await open({ weapons: ['sword', 'axe'] });
    await enter();
    await key(g.page, 'Escape', 'Enter');               // 先頭が「装備」
    await waitTop(g.page, 'equip');
    await key(g.page, 'Enter', 'ArrowDown', 'Enter', 'Backspace');   // 武器 → 2つ目
    await waitTop(g.page, 'dmenu');
    expect((await save(g.page)).weapon).not.toBe((await save(g.page)).weapons[0]);
    expect(await scene(g.page, s => s.run.state.pos)).toBe(0);
    await key(g.page, 'Escape');
    await scene(g.page, s => { s.run.state.pos = 4; s.toBoard(); });
    expect(await scene(g.page, s => s.dmenuItems().map((x: any) => x.act))).not.toContain('equip');
  });

  it('サイコロは ○ で回し、もう一度 ○ で止める。✕ でやめられる。△ でマスの説明', async () => {
    g = await open();
    await enter();
    await key(g.page, 'Enter');
    await mode('rolling');
    await key(g.page, 'Backspace');
    await mode('idle');
    expect(await scene(g.page, s => [s.run.state.pos, s.run.state.steps])).toEqual([0, 0]);
    await key(g.page, 'KeyW');
    await waitTop(g.page, 'legend');
    await key(g.page, 'Backspace');
    await waitTop(g.page, 'board');
    await fix(0.99);
    await roll();
    await g.page.waitForFunction(() => (window as any).__scene.bmode !== 'moving');
    expect(await scene(g.page, s => [s.rolled, s.run.state.pos])).toEqual([6, 6]);
  });

  it('サイコロで進み、モンスターのマスで戦う。HPとアイテムの使用を持ち越し、戦利品が入る', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { s.run.state.pos = 1; s.toBoard(); });
    await fix(0);
    await roll();
    await mode('landed');
    expect(await scene(g.page, s => [s.run.state.pos, s.effect.kind])).toEqual([2, 'monster']);
    await key(g.page, 'Enter');
    await waitTop(g.page, 'ready');
    await key(g.page, 'Backspace');                    // 逃げられない
    expect(await top(g.page)).toBe('ready');
    await start(g.page);
    await battle(g.page, b => { b.hp = 61; });
    await key(g.page, 'KeyE');                          // 回復薬を使う（+20）
    await win(g.page);
    await key(g.page, 'Enter');
    await waitTop(g.page, 'board');
    const st = await scene(g.page, s => JSON.parse(JSON.stringify(s.run.state)));
    expect(st.hp).toBe(81);
    expect(st.used).toEqual([true, false, false]);
    expect(st.pending).toBeNull();
    const sv = await stored(g.page);
    expect(sv.loot.fire_shard).toBe(1);
    expect(sv.run.pos).toBe(2);
    expect(sv.records.fire_lizard.wins).toBe(1);        // ダンジョンの敵にも、討伐回数と最速タイムを付ける（ランクは付けない）
    expect(sv.records.fire_lizard.bestTime).toBeGreaterThan(0);
  });

  it('分かれ道は盤面の上で選ぶ。先を見ることもできる', async () => {
    g = await open();
    await enter();
    // 最初の分かれ道のマスから
    const fork = await scene(g.page, s => { const f = s.run.board.findIndex((q: { next: number[] }) => q.next.length > 1); s.run.state.pos = f; s.toBoard(); return f; });
    await fix(0);
    await roll();
    await mode('choose');
    const first = await scene(g.page, s => s.run.options());
    expect(await scene(g.page, s => s.run.options().map((o: number) => s.stopFrom(o)))).toEqual(first);   // 1の目: 止まるのは最初のマス
    expect(first.length).toBe(2); expect(fork).toBeGreaterThan(0);
    await key(g.page, 'KeyA');
    await mode('look');
    await key(g.page, 'KeyA');
    await mode('choose');
    await key(g.page, 'ArrowDown');                     // 下の道（長い道）
    expect(await scene(g.page, s => s.pick)).toBe(1);
    await key(g.page, 'Enter');
    await g.page.waitForFunction(() => (window as any).__scene.bmode !== 'moving' && (window as any).__scene.bmode !== 'choose');
    expect(await scene(g.page, s => s.run.square.seg)).toBe('b1');
  });

  it('鍵を持って輪の分かれ目に来ると、扉を選べる。扉で止まって開く', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { const r = s.run; r.state.midDone = true; r.state.key = true; r.state.pos = r.board.findIndex((q: { next: number[] }) => q.next.includes(r.doorIndex)); s.toBoard(); });
    await fix(0.99);     // 6の目
    await roll();
    await mode('choose');
    expect(await scene(g.page, s => s.run.options()[s.pick] === s.run.doorIndex)).toBe(true);   // 扉の側を選んだ状態で始まる
    await key(g.page, 'Enter');
    await mode('landed');
    expect(await scene(g.page, s => [s.effect.kind, s.run.state.doorOpen, s.run.state.key, s.run.state.pos === s.run.doorIndex])).toEqual(['door', true, false, true]);
  });

  it('負けると入口に戻り、最大HPアップは消える', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { s.run.state.pos = 1; s.run.state.maxBonus = 10; s.run.state.hp = 110; s.toBoard(); });
    await fix(0);
    await roll();
    await mode('landed');
    await key(g.page, 'Enter');
    await waitTop(g.page, 'ready');
    expect(await battle(g.page, b => b.maxHp)).toBe(110);
    await start(g.page);
    await battle(g.page, b => { b.hp = 1; b.enemy.gauge = 99; });
    await waitTop(g.page, 'result');
    await g.page.waitForFunction(() => (window as any).__scene.resultWait <= 0);
    await key(g.page, 'Enter');
    await waitTop(g.page, 'board');
    expect(await scene(g.page, s => [s.run.state.pos, s.run.state.hp, s.run.state.maxBonus])).toEqual([0, 100, 0]);
  });

  it('負けたとき、ダンジョンから出ることもできる（続きは入口から）', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { s.run.state.pos = 1; s.toBoard(); });
    await fix(0);
    await roll();
    await mode('landed');
    await key(g.page, 'Enter');
    await waitTop(g.page, 'ready');
    await start(g.page);
    await battle(g.page, b => { b.hp = 1; b.enemy.gauge = 99; });
    await waitTop(g.page, 'result');
    await g.page.waitForFunction(() => (window as any).__scene.resultWait <= 0);
    await key(g.page, 'ArrowDown', 'Enter');            // ダンジョンから出る
    await waitTop(g.page, 'list');
    expect((await stored(g.page)).run.pos).toBe(0);
  });

  it('テストモード: タッチパッド（T）でサイコロの目を選べる。もう一度押すと解除', async () => {
    g = await open();
    await enter();
    await key(g.page, 'KeyT', 'Enter');
    await mode('rolling');
    await key(g.page, 'ArrowUp', 'ArrowUp', 'ArrowUp', 'Enter');   // 1 → 4
    await g.page.waitForFunction(() => (window as any).__scene.bmode !== 'moving' && (window as any).__scene.bmode !== 'rolling');
    expect(await scene(g.page, s => [s.rolled, s.diceTest])).toEqual([4, true]);
    await key(g.page, 'KeyT');
    expect(await scene(g.page, s => s.diceTest)).toBe(false);
  });

  it('最初からやり直すときは確認が出る。「いいえ」ではやり直さない', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { s.run.state.pos = 4; s.toBoard(); });
    await key(g.page, 'Escape', 'ArrowDown', 'Enter');   // 最初からやり直す（入口以外: 操作説明・やり直す・出る・閉じる）
    expect(await scene(g.page, s => s.restartArmed)).toBe(true);
    await key(g.page, 'Enter');                           // 初めは「いいえ」
    expect(await scene(g.page, s => [s.restartArmed, s.run.state.pos])).toEqual([false, 4]);
    await key(g.page, 'Enter', 'ArrowRight', 'Enter');    // はい、やり直す
    await waitTop(g.page, 'board');
    expect(await scene(g.page, s => s.run.state.pos)).toBe(0);
  });

  it('外に出ても、続きから再開できる', async () => {
    g = await open();
    await enter();
    await scene(g.page, s => { s.run.state.pos = 4; s.run.state.hp = 55; s.keepRun(); });
    await key(g.page, 'Escape', 'ArrowDown', 'ArrowDown', 'Enter');   // ダンジョンから出る（入口以外: 操作説明・やり直す・出る・閉じる）
    await waitTop(g.page, 'list');
    expect((await stored(g.page)).run.pos).toBe(4);
    await g.page.reload();
    await ready(g.page);
    await enter();
    expect(await scene(g.page, s => [s.run.state.pos, s.run.state.hp])).toEqual([4, 55]);
  });

  it('ボスを討伐すると踏破。初回は炎の指輪、2回目は300G', async () => {
    g = await open();
    for (const first of [true, false]) {
      await enter();
      await scene(g.page, s => { s.run.state.pos = s.run.bossIndex - 1; s.run.state.midDone = true; s.toBoard(); });
      await fix(0);
      await roll();
      await mode('landed');
      await key(g.page, 'Enter');
      await waitTop(g.page, 'ready');
      expect(await scene(g.page, s => s.enemy.id)).toBe('fire_beast');
      await start(g.page);
      await win(g.page);
      await key(g.page, 'Enter');
      await mode('cleared').catch(async e => { throw new Error(String(e) + JSON.stringify(await scene(g.page, s => [s.base, s.bmode, s.overlays, s.run && s.run.state, s.battle.result, s.battle.hp, s.resultWait]))); });
      const sv = await stored(g.page);
      expect(sv.run).toBeNull();
      expect(sv.cleared.fire).toBe(true);
      expect(sv.accessories).toEqual(['flame_ring']);
      expect(sv.accessory).toBe('flame_ring');
      expect(sv.gold).toBe(first ? 0 : 300);
      await key(g.page, 'Enter');
      await waitTop(g.page, 'list');
      await key(g.page, 'ArrowLeft');                   // 討伐の一覧に戻しておく
    }
  });
});
