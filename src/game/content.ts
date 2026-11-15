// データ（data/cards.json）を型付きで取り出す場所。画面とゲーム本体の両方から使う。
import data from '../../data/cards.json';
import type { CardDef, EnemyDef, ItemDef, Rules } from './battle';
import type { ArmorDef, WeaponDef } from './loadout';
import type { SaveConfig } from './save';

export const RULES = data.rules as unknown as Rules & { defaultItems: string[]; defaultSpells: string[]; maxSpells: number; resumeCountSec: number };
export type SpellDef = CardDef & { mark: string; long: string };
export const DEFS = data.cards as CardDef[];
export const ATTACKS = DEFS.filter(c => c.type === 'attack');
export const SPELLS = DEFS.filter(c => c.type === 'spell') as SpellDef[];
export const WEAPONS = data.weapons as WeaponDef[];
export const ARMORS = data.armors as ArmorDef[];
export const ITEMS = data.items as (ItemDef & { short: string })[];
export const ENEMIES = data.enemies as EnemyDef[];
export const itemOf = (id: string | null) => ITEMS.find(d => d.id === id) ?? null;
export const SAVE_CONFIG: SaveConfig = {
  items: ITEMS.map(d => d.id), defaultItems: RULES.defaultItems,
  spells: SPELLS.map(d => d.id), defaultSpells: RULES.defaultSpells, maxSpells: RULES.maxSpells,
  weapons: WEAPONS.map(d => d.id), armors: ARMORS.map(d => d.id), startWeapon: WEAPONS[0].id, startArmor: ARMORS[0].id,
};
export const SHOP = [...WEAPONS.filter(w => w.price).map(w => ({ kind: 'weapon' as const, def: w })), ...ARMORS.filter(a => a.price).map(a => ({ kind: 'armor' as const, def: a }))];
export const MARK: Record<string, string> = Object.fromEntries(SPELLS.map(c => [c.effect!, c.mark]));
