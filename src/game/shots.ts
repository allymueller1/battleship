import { coordKey, isInBounds } from './coord';
import { FLEET } from './ships';
import type { Board, Coord, PlacedShip, ShipSpec, ShotResult, TargetView } from './types';

/**
 * Applies a shot and returns the updated board plus the outcome.
 * Throws on out-of-bounds or repeated coords — the game layer guards first.
 */
export function fireShot(board: Board, coord: Coord): { board: Board; result: ShotResult } {
  if (!isInBounds(coord)) {
    throw new Error(`Shot out of bounds: ${coordKey(coord)}`);
  }
  const key = coordKey(coord);
  if (board.shots.has(key)) {
    throw new Error(`Already fired at: ${key}`);
  }

  const shot = { ...coord };
  const ship = board.ships.find((s) => s.cells.some((c) => coordKey(c) === key));
  const shots = new Map(board.shots);
  shots.set(key, ship ? 'hit' : 'miss');
  const next: Board = { ...board, shots };

  if (!ship) {
    return { board: next, result: { kind: 'miss', coord: shot } };
  }
  if (isShipSunk(next, ship)) {
    return { board: next, result: { kind: 'sunk', coord: shot, ship } };
  }
  return { board: next, result: { kind: 'hit', coord: shot, shipType: ship.type } };
}

export function isShipSunk(board: Board, ship: PlacedShip): boolean {
  return ship.cells.every((c) => board.shots.get(coordKey(c)) === 'hit');
}

/** True only when every placed ship is sunk; false for a board with no ships. */
export function allShipsSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every((s) => isShipSunk(board, s));
}

/** Per-spec sunk flags in FLEET order; ships not yet placed count as not sunk. */
export function fleetStatus(board: Board): { spec: ShipSpec; sunk: boolean }[] {
  return FLEET.map((spec) => {
    const ship = board.ships.find((s) => s.type === spec.type);
    return { spec, sunk: ship ? isShipSunk(board, ship) : false };
  });
}

export function targetView(board: Board): TargetView {
  return {
    shots: new Map(board.shots),
    sunkShips: board.ships.filter((s) => isShipSunk(board, s)),
    remainingShips: FLEET.filter((spec) => {
      const ship = board.ships.find((s) => s.type === spec.type);
      return !ship || !isShipSunk(board, ship);
    }),
  };
}
