// デッキと装備の組み立て（ゲーム本体とシミュレーションの両方から使う）
import type { CardDef, Gear } from './battle';

export interface WeaponDef { id: string; name: string; power: number[]; attackWaitSec?: number; chargeMod?: number; price: number | null; desc: string }
export interface ArmorDef { id: string; name: string; def: number; chargeMod?: number; price: number | null; desc: string }

/** アタック28枚（固定）＋選んだスペル。スペルが上限より少ない分はCで埋めて30枚にする */
export function buildDeck(cards: CardDef[], spells: string[], maxSpells: number): CardDef[] {
  return cards
    .filter(c => c.type === 'attack' || spells.includes(c.id))
    .map(c => (c.type === 'attack' && c.lv === 1 ? { ...c, copies: c.copies + maxSpells - spells.length } : c));
}

export function gearOf(weapon: WeaponDef | undefined, armor: ArmorDef | undefined): Gear {
  return {
    power: weapon?.power,
    attackWaitSec: weapon?.attackWaitSec,
    chargeMod: (weapon?.chargeMod ?? 0) + (armor?.chargeMod ?? 0),
    def: armor?.def ?? 0,
  };
}
