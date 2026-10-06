import { allCoords, coordKey } from '../coord';
import type { Coord, TargetView } from '../types';

/** Every cell not yet fired at, in row-major order. */
export function untriedCoords(view: TargetView): Coord[] {
  return allCoords().filter((c) => !view.shots.has(coordKey(c)));
}

/**
 * 'hit' cells that do not belong to any sunk ship, in row-major order.
 * Sinking a ship only clears that ship's own cells, so a hit from a
 * different (touching) ship stays unresolved.
 */
export function unresolvedHits(view: TargetView): Coord[] {
  const sunkCells = new Set(view.sunkShips.flatMap((s) => s.cells.map(coordKey)));
  return allCoords().filter(
    (c) => view.shots.get(coordKey(c)) === 'hit' && !sunkCells.has(coordKey(c)),
  );
}
