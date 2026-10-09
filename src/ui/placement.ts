import {
  createBoard,
  placeShip,
  randomFleet,
  removeShip,
  shipAt,
  shipCells,
  validatePlacement,
  type PlacementError,
} from '../game/board';
import { isInBounds } from '../game/coord';
import type { Rng } from '../game/rng';
import { FLEET, getShipSpec } from '../game/ships';
import type { Board, Coord, Orientation, ShipType } from '../game/types';

/** UI-side state while the player arranges their fleet. */
export interface PlacementState {
  readonly board: Board;
  readonly selected: ShipType | null;
  readonly orientation: Orientation;
}

export type PlaceError = PlacementError | 'none-selected';

export function initialPlacement(): PlacementState {
  return { board: createBoard(), selected: FLEET[0]?.type ?? null, orientation: 'horizontal' };
}

export function nextUnplaced(board: Board): ShipType | null {
  return FLEET.find((spec) => !board.ships.some((s) => s.type === spec.type))?.type ?? null;
}

export function rotate(state: PlacementState): PlacementState {
  return {
    ...state,
    orientation: state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
  };
}

/** Selects a ship to place; a ship that is already on the board is picked back up. */
export function selectShip(state: PlacementState, type: ShipType): PlacementState {
  const ship = state.board.ships.find((s) => s.type === type);
  return {
    ...state,
    board: removeShip(state.board, type),
    selected: type,
    orientation: ship?.orientation ?? state.orientation,
  };
}

/** Picks up the ship covering `coord`, if any. */
export function pickUpAt(state: PlacementState, coord: Coord): PlacementState | null {
  const ship = shipAt(state.board, coord);
  if (!ship) {
    return null;
  }
  return selectShip(state, ship.type);
}

export function placeSelected(
  state: PlacementState,
  origin: Coord,
): { state: PlacementState; error: PlaceError | null } {
  if (!state.selected) {
    return { state, error: 'none-selected' };
  }
  const error = validatePlacement(state.board, state.selected, origin, state.orientation);
  if (error) {
    return { state, error };
  }
  const board = placeShip(state.board, state.selected, origin, state.orientation);
  return { state: { ...state, board, selected: nextUnplaced(board) }, error: null };
}

/** A ship being dragged: where it came from and which cell was grabbed. */
export interface Drag {
  readonly type: ShipType;
  readonly from: Coord;
  readonly orientation: Orientation;
  readonly grab: number;
}

/** Picks up the ship under `coord` and remembers where it was grabbed, or null on an empty cell. */
export function startDrag(
  state: PlacementState,
  coord: Coord,
): { state: PlacementState; drag: Drag } | null {
  const ship = shipAt(state.board, coord);
  if (!ship) {
    return null;
  }
  const grab = ship.cells.findIndex((c) => c.row === coord.row && c.col === coord.col);
  if (grab < 0) {
    return null;
  }
  return {
    state: selectShip(state, ship.type),
    drag: { type: ship.type, from: ship.origin, orientation: ship.orientation, grab },
  };
}

/** The origin that keeps the grabbed cell under the pointer. */
export function dragOrigin(drag: Drag, pointer: Coord, orientation: Orientation): Coord {
  return orientation === 'horizontal'
    ? { row: pointer.row, col: pointer.col - drag.grab }
    : { row: pointer.row - drag.grab, col: pointer.col };
}

/**
 * Places the dragged ship at `origin` if it fits; otherwise (invalid or null)
 * puts it back where it came from.
 */
export function dropDrag(
  state: PlacementState,
  drag: Drag,
  origin: Coord | null,
): { state: PlacementState; snappedBack: boolean } {
  // The ship may already be back on the board if something replaced the
  // placement while this drag was still live.
  if (state.board.ships.some((s) => s.type === drag.type)) {
    return { state, snappedBack: false };
  }
  if (origin && validatePlacement(state.board, drag.type, origin, state.orientation) === null) {
    const board = placeShip(state.board, drag.type, origin, state.orientation);
    return { state: { ...state, board, selected: nextUnplaced(board) }, snappedBack: false };
  }
  // The snap-back spot may no longer be free either; leave the ship unplaced
  // and selected rather than throwing.
  if (validatePlacement(state.board, drag.type, drag.from, drag.orientation) !== null) {
    return {
      state: { ...state, selected: drag.type, orientation: drag.orientation },
      snappedBack: true,
    };
  }
  const board = placeShip(state.board, drag.type, drag.from, drag.orientation);
  return {
    state: {
      ...state,
      board,
      selected: nextUnplaced(board),
      orientation: drag.orientation,
    },
    snappedBack: true,
  };
}

export function randomizePlacement(state: PlacementState, rng: Rng): PlacementState {
  return { ...state, board: randomFleet(rng), selected: null };
}

/** The on-board cells the selected ship would cover at `origin`, and whether it fits there. */
export function previewAt(
  state: PlacementState,
  origin: Coord | null,
): { cells: Coord[]; valid: boolean } | null {
  if (!state.selected || !origin) {
    return null;
  }
  const cells = shipCells(origin, state.orientation, getShipSpec(state.selected).length);
  return {
    cells: cells.filter(isInBounds),
    valid: validatePlacement(state.board, state.selected, origin, state.orientation) === null,
  };
}
