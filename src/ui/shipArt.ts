import { getShipSpec } from '../game/ships';
import type { ShipType } from '../game/types';

// Original outline designs, nose pointing right. Each unit of ship length is 100 wide.
const ART: Record<ShipType, string> = {
  carrier: [
    '<path d="M30 50 L70 26 L380 22 L470 42 L490 50 L470 58 L380 78 L70 74 Z"/>',
    '<path d="M200 22 Q250 0 300 22"/>',
    '<path d="M140 26 L180 8 L260 8 L240 24 M140 74 L180 92 L260 92 L240 76"/>',
    '<path d="M90 50 L440 50 M320 38 L360 38 M320 62 L360 62"/>',
    '<path class="ship-engine" d="M8 40 L30 40 M8 60 L30 60"/>',
  ].join(''),
  battleship: [
    '<path d="M20 34 L300 30 L385 50 L300 70 L20 66 L36 50 Z"/>',
    '<path d="M120 30 L140 14 L200 14 L215 30"/>',
    '<circle cx="160" cy="50" r="9"/><circle cx="245" cy="50" r="9"/>',
    '<path d="M60 50 L130 50"/>',
    '<path class="ship-engine" d="M4 42 L22 42 M4 58 L22 58"/>',
  ].join(''),
  cruiser: [
    '<path d="M24 50 L90 30 L260 44 L285 50 L260 56 L90 70 Z"/>',
    '<path d="M90 30 L60 10 L130 34 M90 70 L60 90 L130 66"/>',
    '<path d="M195 50 L235 50"/>',
    '<path class="ship-engine" d="M6 50 L26 50"/>',
  ].join(''),
  submarine: [
    '<path d="M20 50 L120 12 L285 50 L120 88 Z"/>',
    '<path d="M80 50 L150 34 L230 50 L150 66 Z"/>',
    '<path class="ship-engine" d="M6 50 L24 50"/>',
  ].join(''),
  destroyer: [
    '<path d="M24 50 L64 30 L150 38 L186 50 L150 62 L64 70 Z"/>',
    '<ellipse cx="128" cy="50" rx="16" ry="7"/>',
    '<path class="ship-engine" d="M4 44 L26 44 M4 56 L26 56"/>',
  ].join(''),
};

/** Original neon outline art for a ship, drawn horizontally in a `length x 1` viewBox. */
export function shipSvg(type: ShipType): string {
  const length = getShipSpec(type).length;
  return `<svg class="ship-art" viewBox="0 0 ${length * 100} 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${ART[type]}</svg>`;
}
