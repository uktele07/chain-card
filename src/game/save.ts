// セーブデータ（ブラウザに保存）: セットしたアイテムと、敵ごとの記録
export type Rank = 'S' | 'A' | 'B' | 'C';
export interface EnemyRecord { bestTime: number; bestRank: Rank }
export interface SaveData { items: (string | null)[]; records: Record<string, EnemyRecord> }

const KEY = 'chain-card-save-v1';
const RANKS: Rank[] = ['C', 'B', 'A', 'S'];
export const rankValue = (r: Rank) => RANKS.indexOf(r);

export function rankOf(sec: number, th?: { S: number; A: number; B: number }): Rank {
  if (!th) return 'C';
  return sec <= th.S ? 'S' : sec <= th.A ? 'A' : sec <= th.B ? 'B' : 'C';
}

export function loadSave(defaults: (string | null)[], validItems: string[]): SaveData {
  const fresh: SaveData = { items: [...defaults], records: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const d = JSON.parse(raw) as Partial<SaveData>;
    const items = Array.isArray(d.items) ? d.items.slice(0, 3).map(x => (typeof x === 'string' && validItems.includes(x) ? x : null)) : fresh.items;
    while (items.length < 3) items.push(null);
    const records: Record<string, EnemyRecord> = {};
    for (const [k, v] of Object.entries(d.records ?? {})) {
      if (v && typeof v.bestTime === 'number' && RANKS.includes(v.bestRank)) records[k] = { bestTime: v.bestTime, bestRank: v.bestRank };
    }
    return { items, records };
  } catch { return fresh; }   // 保存が使えない環境でも、そのまま遊べるようにする
}
export function storeSave(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 保存できなくても続行 */ } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* 同上 */ } }
