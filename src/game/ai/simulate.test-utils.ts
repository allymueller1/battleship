import { createBoard, placeShip } from '../board';
import { fireShot, allShipsSunk, targetView } from '../shots';
import { coordKey, isInBounds } from '../coord';
import type { Rng } from '../rng';
import type { Board, Coord, Orientation, ShipType, TargetView } from '../types';

export type ShotChooser = (view: TargetView, rng: Rng) => Coord;

/** Builds a TargetView from placed ships and fired shots, for crafting scenarios. */
export function makeView(
  ships: { type: ShipType; origin: Coord; orientation: Orientation }[],
  shots: Coord[],
): TargetView {
  let board = createBoard();
  for (const { type, origin, orientation } of ships) {
    board = placeShip(board, type, origin, orientation);
  }
  for (const shot of shots) {
    board = fireShot(board, shot).board;
  }
  return targetView(board);
}

/**
 * Plays a solo game for one AI against the given board: repeatedly asks the
 * chooser for a coord and fires it, until every ship is sunk. Returns the
 * number of shots taken. Throws if the AI picks an out-of-bounds or repeated
 * coord, or stalls (more shots than there are cells).
 */
export function simulateGame(choose: ShotChooser, board: Board, rng: Rng): number {
  const tried = new Set<string>();
  for (let shots = 1; shots <= 100; shots++) {
    const coord = choose(targetView(board), rng);
    if (!isInBounds(coord)) {
      throw new Error(`AI chose out-of-bounds coord ${coordKey(coord)}`);
    }
    const key = coordKey(coord);
    if (tried.has(key)) {
      throw new Error(`AI repeated coord ${key}`);
    }
    tried.add(key);
    board = fireShot(board, coord).board;
    if (allShipsSunk(board)) {
      return shots;
    }
  }
  throw new Error('AI failed to sink the fleet within 100 shots');
}
