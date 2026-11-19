import { afterEach, describe, expect, it } from 'vitest';
import { loadSave, type SaveConfig } from './save';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; },
  clear: () => {}, key: () => null, length: 0,
};
const c: SaveConfig = { items: ['potion'], defaultItems: ['potion', null, null], spells: [], defaultSpells: [], maxSpells: 2, weapons: ['w'], armors: ['a'], startWeapon: 'w', startArmor: 'a', accessories: [], dungeons: [] };
afterEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('セーブの読み込み', () => {
  it('討伐回数の無い古い記録は、1回として読む（持ち主の記録を消さない）', () => {
    store['chain-card-save-v1'] = JSON.stringify({ records: { slime: { bestTime: 18.4, bestRank: 'A' } } });
    expect(loadSave(c).records.slime).toEqual({ bestTime: 18.4, bestRank: 'A', wins: 1 });
  });
  it('討伐回数がある記録は、そのまま読む', () => {
    store['chain-card-save-v1'] = JSON.stringify({ records: { slime: { bestTime: 18.4, bestRank: 'A', wins: 7 } } });
    expect(loadSave(c).records.slime.wins).toBe(7);
  });
  it('音量の無い古いセーブは、初期値（BGM 7、効果音 10）で読む。範囲外は初期値', () => {
    store['chain-card-save-v1'] = JSON.stringify({ gold: 5 });
    expect(loadSave(c).volume).toEqual({ bgm: 7, se: 10 });
    store['chain-card-save-v1'] = JSON.stringify({ volume: { bgm: 0, se: 42 } });
    expect(loadSave(c).volume).toEqual({ bgm: 0, se: 10 });
  });
});
