import { allCoords, coordKey, isInBounds } from '../coord';
import { pickRandom, type Rng } from '../rng';
import { shipCells } from '../board';
import type { Coord, Orientation, TargetView } from '../types';
import { unresolvedHits, untriedCoords } from './view';
import { BOARD_SIZE } from '../types';

const HIT_BONUS = 20;

const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

/**
 * Probability density over the board: for every legal placement of every
 * remaining ship, add weight to its untried cells. A placement covering k
 * unresolved hits weighs HIT_BONUS ** k, so once hits exist, placements
 * through them dominate and the AI targets instead of hunting.
 */
export function probabilityMap(view: TargetView): number[][] {
  const map = Array.from({ length: BOARD_SIZE }, () => new Array<number>(BOARD_SIZE).fill(0));
  const hits = new Set(unresolvedHits(view).map(coordKey));
  const sunkCells = new Set(view.sunkShips.flatMap((s) => s.cells.map(coordKey)));

  for (const spec of view.remainingShips) {
    for (const origin of allCoords()) {
      for (const orientation of ORIENTATIONS) {
        const cells = shipCells(origin, orientation, spec.length);
        if (!cells.every(isInBounds)) {
          continue;
        }
        if (
          cells.some((c) => view.shots.get(coordKey(c)) === 'miss' || sunkCells.has(coordKey(c)))
        ) {
          continue;
        }
        const weight = HIT_BONUS ** cells.filter((c) => hits.has(coordKey(c))).length;
        for (const c of cells) {
          if (!view.shots.has(coordKey(c))) {
            map[c.row]![c.col]! += weight;
          }
        }
      }
    }
  }
  return map;
}

/** Picks the untried cell with the highest density; ties broken randomly. */
export function chooseHardShot(view: TargetView, rng: Rng): Coord {
  const map = probabilityMap(view);
  const untried = untriedCoords(view);

  let best = 0;
  for (const c of untried) {
    best = Math.max(best, map[c.row]![c.col]!);
  }
  if (best === 0) {
    // no legal placement explains any untried cell — should not happen, but
    // never stall
    return pickRandom(rng, untried);
  }
  const tied = untried.filter((c) => map[c.row]![c.col]! === best);
  return pickRandom(rng, tied);
}
