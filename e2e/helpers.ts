// 画面を通しで動かす確認のための道具。ゲームはキーボードで操作し、状態は window.__scene / window.__battle から読む。
import { chromium, type Browser, type Page } from 'playwright';
import { inject } from 'vitest';

export const SAVE_KEY = 'chain-card-save-v1';
/** カードのボタン（△ ○ ✕ □ の順） */
export const CARD_KEYS = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];

let browser: Browser | undefined;
export async function launch() { browser ??= await chromium.launch(); return browser; }
export async function close() { await browser?.close(); browser = undefined; }

export interface Game { page: Page; errors: string[] }

/** ゲームを開く。save を渡すと、その内容をセーブデータとして読み込ませる */
export async function open(save?: Record<string, unknown>): Promise<Game> {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(inject('baseUrl'));
  if (save) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save)]);
    await page.reload();
  }
  await ready(page);
  return { page, errors };
}
export async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__scene && (window as any).__battle && (window as any).__scene.L?.length);
  await page.waitForTimeout(150);
}

/** キーを押して、ゲームがその入力を処理するまで少し待つ */
export async function key(page: Page, ...codes: string[]) {
  for (const c of codes) { await page.keyboard.press(c); await page.waitForTimeout(90); }
}

/** いちばん手前の画面（list / ready / fight / result / menu / equip / deck / shop / confirm / help / reset / pause / resume） */
export const top = (page: Page) => page.evaluate(() => { const s = (window as any).__scene; return s.overlays[s.overlays.length - 1] ?? s.base; });
export const waitTop = (page: Page, name: string) => page.waitForFunction(n => { const s = (window as any).__scene; return (s.overlays[s.overlays.length - 1] ?? s.base) === n; }, name);
export const scene = <T>(page: Page, f: (s: any) => T) => page.evaluate(`(${f.toString()})(window.__scene)`) as Promise<T>;
export const battle = <T>(page: Page, f: (b: any) => T) => page.evaluate(`(${f.toString()})(window.__battle)`) as Promise<T>;
export const save = (page: Page) => scene(page, s => JSON.parse(JSON.stringify(s.save)));
export const stored = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);

/** 敵の一覧から、n番目の敵の開始前画面へ進む */
export async function toReady(page: Page, enemyIndex = 0) {
  for (let i = 0; i < enemyIndex; i++) await key(page, 'ArrowDown');
  await key(page, 'Enter');
  await waitTop(page, 'ready');
}
/** 開始前画面から戦闘を始める */
export async function start(page: Page) { await key(page, 'Enter'); await waitTop(page, 'fight'); }

/** いま出せるアタックを1枚出す（出せるものが来るまで待つ） */
export async function playAttack(page: Page) {
  for (let i = 0; i < 600; i++) {      // 遅い環境では、入れ替えを待つのに時間がかかる
    const st = await battle(page, b => ({ res: b.result, lock: b.lock, slots: b.slots.map((s: any) => !!s.card && s.card.type === 'attack' && b.canPlay(s.card)) }));
    if (st.res !== 'playing') return;
    const k = st.lock > 0 ? -1 : st.slots.indexOf(true);
    if (k >= 0) { await key(page, CARD_KEYS[k]); return; }
    await page.waitForTimeout(60);
  }
  throw new Error('no playable attack appeared');
}
/** 敵のHPを1にして、次の一撃で勝つ */
export async function win(page: Page) {
  await battle(page, b => { b.enemy.hp = 1; });
  for (let i = 0; i < 20 && (await top(page)) === 'fight'; i++) await playAttack(page);
  await waitTop(page, 'result');
  await page.waitForFunction(() => (window as any).__scene.resultWait <= 0);
}
