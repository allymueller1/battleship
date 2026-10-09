import type { ShipType } from '../game/types';

/** The space-themed name shown for each ship type. */
export const SHIP_NAMES: Record<ShipType, string> = {
  carrier: 'Mothership',
  battleship: 'Dreadnought',
  cruiser: 'Frigate',
  submarine: 'Stealth Raider',
  destroyer: 'Scout',
};

/** The themed display name for a ship type, e.g. 'submarine' -> 'Stealth Raider'. */
export function shipDisplayName(type: ShipType): string {
  return SHIP_NAMES[type];
}
