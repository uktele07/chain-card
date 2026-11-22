// データ（data/cards.json）を型付きで取り出す場所。画面とゲーム本体の両方から使う。
import data from '../../data/cards.json';
import dungeonData from '../../data/dungeons.json';
import type { DungeonDef } from './dungeon';
import type { CardDef, EnemyDef, ItemDef, Rules } from './battle';
import type { AccessoryDef, ArmorDef, WeaponDef } from './loadout';
import type { SaveConfig } from './save';

export const RULES = data.rules as unknown as Rules & { defaultItems: string[]; defaultSpells: string[]; maxSpells: number; resumeCountSec: number };
export type SpellDef = CardDef & { mark: string; long: string };
export const DEFS = data.cards as CardDef[];
export const ATTACKS = DEFS.filter(c => c.type === 'attack');
export const SPELLS = DEFS.filter(c => c.type === 'spell') as SpellDef[];
export const WEAPONS = data.weapons as WeaponDef[];
export const ARMORS = data.armors as ArmorDef[];
export const ITEMS = data.items as (ItemDef & { short: string })[];
export const ALL_ENEMIES = data.enemies as EnemyDef[];
/** いまはどの敵も落とさないが、持ち主のセーブに残っているかもしれない換金アイテム（2026-11-22 に敵を入れ替えた。売れるように残す） */
export const LEGACY_LOOT = [{ id: 'guard_core', name: '番人の核', price: 80 }, { id: 'beast_fang', name: '炎獣の牙', price: 150 }];
/** 討伐の一覧に出す敵（ダンジョン専用の敵は除く） */
export const ENEMIES = ALL_ENEMIES.filter(e => !e.dungeon);
export const enemyById = (id: string) => ALL_ENEMIES.find(e => e.id === id) ?? ALL_ENEMIES[0];
export const ACCESSORIES = data.accessories as AccessoryDef[];
export const DUNGEONS = dungeonData.dungeons as unknown as DungeonDef[];
export const itemOf = (id: string | null) => ITEMS.find(d => d.id === id) ?? null;
export const SAVE_CONFIG: SaveConfig = {
  items: ITEMS.map(d => d.id), defaultItems: RULES.defaultItems,
  spells: SPELLS.map(d => d.id), defaultSpells: RULES.defaultSpells, maxSpells: RULES.maxSpells,
  weapons: WEAPONS.map(d => d.id), armors: ARMORS.map(d => d.id), startWeapon: WEAPONS[0].id, startArmor: ARMORS[0].id,
  accessories: ACCESSORIES.map(d => d.id), dungeons: DUNGEONS.map(d => d.id),
};
export const SHOP = [...WEAPONS.filter(w => w.price).map(w => ({ kind: 'weapon' as const, def: w })), ...ARMORS.filter(a => a.price).map(a => ({ kind: 'armor' as const, def: a }))];
export const MARK: Record<string, string> = Object.fromEntries(SPELLS.map(c => [c.effect!, c.mark]));
