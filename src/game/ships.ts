import type { ShipSpec, ShipType } from './types';

export const FLEET: readonly ShipSpec[] = [
  { type: 'carrier', name: 'Carrier', length: 5 },
  { type: 'battleship', name: 'Battleship', length: 4 },
  { type: 'cruiser', name: 'Cruiser', length: 3 },
  { type: 'submarine', name: 'Submarine', length: 3 },
  { type: 'destroyer', name: 'Destroyer', length: 2 },
];

export function getShipSpec(type: ShipType): ShipSpec {
  const spec = FLEET.find((s) => s.type === type);
  if (!spec) {
    throw new Error(`Unknown ship type: ${type}`);
  }
  return spec;
}
