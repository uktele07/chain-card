// セーブデータ（ブラウザに保存）: 装備、デッキのスペル、持ち物、お金、敵ごとの記録
import type { RunState } from './dungeon';

export type Rank = 'S' | 'A' | 'B' | 'C';
/** 敵ごとの記録。wins は討伐回数（2026-11-17 から数える。それ以前の記録は 1 回として読む）。ダンジョンの敵はランクの目安が無いので bestRank は C のまま */
export interface EnemyRecord { bestTime: number; bestRank: Rank; wins: number }
export interface SaveData {
  items: (string | null)[];        // セットしたアイテム（3枠、重複なし）
  spells: string[];                // デッキに入れるスペル
  weapon: string; armor: string;   // 装備中
  weapons: string[]; armors: string[];   // 持っている武器・防具
  accessory: string | null; accessories: string[];   // 装備中のアクセサリと、持っているアクセサリ
  cleared: Record<string, boolean>;      // 踏破したダンジョン
  run: RunState | null;                  // 探索の途中経過（続きから再開するため）
  gold: number;
  loot: Record<string, number>;    // 換金アイテムの個数
  records: Record<string, EnemyRecord>;
  volume: Volume;                  // 音量（0〜10。セーブリセットでも消さない）
}
/** 音量の段階。0 は無音、10 が最大 */
export interface Volume { bgm: number; se: number }
export const DEFAULT_VOLUME: Volume = { bgm: 7, se: 10 };
const vol = (v: unknown, d: number) => typeof v === 'number' && v >= 0 && v <= 10 ? Math.round(v) : d;
export interface SaveConfig {
  items: string[]; defaultItems: (string | null)[];
  spells: string[]; defaultSpells: string[]; maxSpells: number;
  weapons: string[]; armors: string[]; startWeapon: string; startArmor: string;
  accessories: string[]; dungeons: string[];
}

const KEY = 'chain-card-save-v1';
const RANKS: Rank[] = ['C', 'B', 'A', 'S'];
export const rankValue = (r: Rank) => RANKS.indexOf(r);

export function rankOf(sec: number, th?: { S: number; A: number; B: number }): Rank {
  if (!th) return 'C';
  return sec <= th.S ? 'S' : sec <= th.A ? 'A' : sec <= th.B ? 'B' : 'C';
}

function fresh(c: SaveConfig): SaveData {
  return { items: [...c.defaultItems], spells: [...c.defaultSpells], weapon: c.startWeapon, armor: c.startArmor, weapons: [c.startWeapon], armors: [c.startArmor], accessory: null, accessories: [], cleared: {}, run: null, gold: 0, loot: {}, records: {}, volume: { ...DEFAULT_VOLUME } };
}
const uniq = <T>(a: T[]) => a.filter((x, i) => a.indexOf(x) === i);

/** 保存内容を読む。足りない項目や古い形式は、初期値で補う */
export function loadSave(c: SaveConfig): SaveData {
  const f = fresh(c);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return f;
    const d = JSON.parse(raw) as Partial<SaveData>;
    // アイテム: 3枠。同じものが重なっていたら、2つ目以降は「なし」にする
    const seen = new Set<string>();
    const items = (Array.isArray(d.items) ? d.items : f.items).slice(0, 3).map(x => {
      if (typeof x !== 'string' || !c.items.includes(x) || seen.has(x)) return null;
      seen.add(x); return x;
    });
    while (items.length < 3) items.push(null);
    const spells = Array.isArray(d.spells) ? uniq(d.spells.filter(x => c.spells.includes(x))).slice(0, c.maxSpells) : f.spells;
    const weapons = uniq([c.startWeapon, ...(Array.isArray(d.weapons) ? d.weapons.filter(x => c.weapons.includes(x)) : [])]);
    const armors = uniq([c.startArmor, ...(Array.isArray(d.armors) ? d.armors.filter(x => c.armors.includes(x)) : [])]);
    const records: Record<string, EnemyRecord> = {};
    for (const [k, v] of Object.entries(d.records ?? {})) {
      if (v && typeof v.bestTime === 'number' && RANKS.includes(v.bestRank)) records[k] = { bestTime: v.bestTime, bestRank: v.bestRank, wins: typeof v.wins === 'number' && v.wins >= 1 ? Math.floor(v.wins) : 1 };
    }
    const loot: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.loot ?? {})) if (typeof v === 'number' && v > 0) loot[k] = Math.floor(v);
    const accessories = uniq(Array.isArray(d.accessories) ? d.accessories.filter(x => c.accessories.includes(x)) : []);
    const cleared: Record<string, boolean> = {};
    for (const id of c.dungeons) if (d.cleared?.[id]) cleared[id] = true;
    const r = d.run;
    const run = r && c.dungeons.includes(r.dungeon) && typeof r.pos === 'number' && typeof r.hp === 'number' && Array.isArray(r.used) ? r : null;
    return {
      items, spells, weapons, armors, records, loot, accessories, cleared, run,
      accessory: accessories.includes(d.accessory ?? '') ? d.accessory! : null,
      weapon: weapons.includes(d.weapon ?? '') ? d.weapon! : c.startWeapon,
      armor: armors.includes(d.armor ?? '') ? d.armor! : c.startArmor,
      gold: typeof d.gold === 'number' && d.gold > 0 ? Math.floor(d.gold) : 0,
      volume: { bgm: vol(d.volume?.bgm, DEFAULT_VOLUME.bgm), se: vol(d.volume?.se, DEFAULT_VOLUME.se) },
    };
  } catch { return f; }   // 保存が使えない環境でも、そのまま遊べるようにする
}
export function storeSave(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 保存できなくても続行 */ } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* 同上 */ } }
