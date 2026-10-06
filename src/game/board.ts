import { coordKey, isInBounds } from './coord';
import { pickRandom, randomInt, type Rng } from './rng';
import { getShipSpec, FLEET } from './ships';
import {
  BOARD_SIZE,
  type Board,
  type Coord,
  type Orientation,
  type PlacedShip,
  type ShipType,
} from './types';

export function createBoard(): Board {
  return { ships: [], shots: new Map() };
}

/** Cells the ship would occupy; may include out-of-bounds cells — callers validate. */
export function shipCells(origin: Coord, orientation: Orientation, length: number): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < length; i++) {
    cells.push(
      orientation === 'horizontal'
        ? { row: origin.row, col: origin.col + i }
        : { row: origin.row + i, col: origin.col },
    );
  }
  return cells;
}

export type PlacementError = 'out-of-bounds' | 'overlap' | 'already-placed';

export function validatePlacement(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation,
): PlacementError | null {
  if (board.ships.some((s) => s.type === type)) {
    return 'already-placed';
  }
  const cells = shipCells(origin, orientation, getShipSpec(type).length);
  if (cells.some((c) => !isInBounds(c))) {
    return 'out-of-bounds';
  }
  const occupied = new Set(board.ships.flatMap((s) => s.cells.map(coordKey)));
  if (cells.some((c) => occupied.has(coordKey(c)))) {
    return 'overlap';
  }
  return null;
}

export function placeShip(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation,
): Board {
  const error = validatePlacement(board, type, origin, orientation);
  if (error) {
    throw new Error(`Cannot place ${type}: ${error}`);
  }
  const ship: PlacedShip = {
    type,
    origin,
    orientation,
    cells: shipCells(origin, orientation, getShipSpec(type).length),
  };
  return { ...board, ships: [...board.ships, ship] };
}

/** Returns a copy without the ship; a copy even if the ship was never placed. */
export function removeShip(board: Board, type: ShipType): Board {
  return { ...board, ships: board.ships.filter((s) => s.type !== type) };
}

export function shipAt(board: Board, coord: Coord): PlacedShip | undefined {
  const key = coordKey(coord);
  return board.ships.find((s) => s.cells.some((c) => coordKey(c) === key));
}

export function isFleetComplete(board: Board): boolean {
  return FLEET.every((spec) => board.ships.some((s) => s.type === spec.type));
}

const MAX_PLACEMENT_ATTEMPTS = 1000;

/** Places the whole FLEET at random; retries each ship until a valid spot is found. */
export function randomFleet(rng: Rng): Board {
  let board = createBoard();
  for (const spec of FLEET) {
    for (let attempt = 0; ; attempt++) {
      if (attempt >= MAX_PLACEMENT_ATTEMPTS) {
        throw new Error(`Could not place ${spec.type} after ${MAX_PLACEMENT_ATTEMPTS} attempts`);
      }
      const orientation = pickRandom(rng, ['horizontal', 'vertical'] as const);
      const origin = {
        row: randomInt(rng, BOARD_SIZE),
        col: randomInt(rng, BOARD_SIZE),
      };
      if (!validatePlacement(board, spec.type, origin, orientation)) {
        board = placeShip(board, spec.type, origin, orientation);
        break;
      }
    }
  }
  return board;
}
