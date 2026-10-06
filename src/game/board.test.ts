import { describe, expect, it } from 'vitest';
import {
  createBoard,
  isFleetComplete,
  placeShip,
  randomFleet,
  removeShip,
  shipAt,
  shipCells,
  validatePlacement,
} from './board';
import { coordKey, isInBounds } from './coord';
import { createRng } from './rng';
import { FLEET } from './ships';
import type { Board } from './types';

function emptyBoard(): Board {
  return createBoard();
}

describe('createBoard', () => {
  it('starts with no ships and no shots', () => {
    const board = createBoard();
    expect(board.ships).toHaveLength(0);
    expect(board.shots.size).toBe(0);
  });
});

describe('shipCells', () => {
  it('spans rightward for horizontal ships, origin first', () => {
    expect(shipCells({ row: 2, col: 3 }, 'horizontal', 4)).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
    ]);
  });

  it('spans downward for vertical ships, origin first', () => {
    expect(shipCells({ row: 1, col: 0 }, 'vertical', 3)).toEqual([
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
    ]);
  });
});

describe('validatePlacement', () => {
  it('accepts a valid placement', () => {
    expect(validatePlacement(emptyBoard(), 'carrier', { row: 0, col: 0 }, 'horizontal')).toBeNull();
  });

  it('rejects a ship running off the right edge', () => {
    expect(validatePlacement(emptyBoard(), 'carrier', { row: 0, col: 7 }, 'horizontal')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects a ship running off the bottom edge', () => {
    expect(validatePlacement(emptyBoard(), 'battleship', { row: 8, col: 0 }, 'vertical')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects a negative origin', () => {
    expect(validatePlacement(emptyBoard(), 'destroyer', { row: -1, col: 0 }, 'vertical')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects a fractional origin', () => {
    expect(validatePlacement(createBoard(), 'destroyer', { row: 0.5, col: 0 }, 'horizontal')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects overlap with an existing ship', () => {
    const board = placeShip(emptyBoard(), 'carrier', { row: 0, col: 0 }, 'horizontal');
    expect(validatePlacement(board, 'destroyer', { row: 0, col: 4 }, 'vertical')).toBe('overlap');
  });

  it('allows ships touching side by side', () => {
    const board = placeShip(emptyBoard(), 'carrier', { row: 0, col: 0 }, 'horizontal');
    expect(validatePlacement(board, 'battleship', { row: 1, col: 0 }, 'horizontal')).toBeNull();
  });

  it('allows ships touching end to end', () => {
    const board = placeShip(emptyBoard(), 'carrier', { row: 0, col: 0 }, 'horizontal');
    expect(validatePlacement(board, 'destroyer', { row: 0, col: 5 }, 'horizontal')).toBeNull();
  });

  it('rejects placing the same type twice', () => {
    const board = placeShip(emptyBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal');
    expect(validatePlacement(board, 'destroyer', { row: 5, col: 5 }, 'horizontal')).toBe(
      'already-placed',
    );
  });
});

describe('placeShip', () => {
  it('adds the ship with its cells', () => {
    const board = placeShip(emptyBoard(), 'destroyer', { row: 3, col: 3 }, 'vertical');
    expect(board.ships).toHaveLength(1);
    expect(board.ships[0]).toMatchObject({
      type: 'destroyer',
      origin: { row: 3, col: 3 },
      orientation: 'vertical',
    });
    expect(board.ships[0]?.cells).toHaveLength(2);
  });

  it('throws with the reason when invalid', () => {
    expect(() => placeShip(emptyBoard(), 'carrier', { row: 0, col: 9 }, 'horizontal')).toThrow(
      /out-of-bounds/,
    );
  });

  it('does not mutate the input board', () => {
    const board = emptyBoard();
    placeShip(board, 'destroyer', { row: 0, col: 0 }, 'horizontal');
    expect(board.ships).toHaveLength(0);
  });

  it('stores a copy of the origin, not the caller object', () => {
    const origin = { row: 0, col: 0 };
    const board = placeShip(emptyBoard(), 'destroyer', origin, 'horizontal');
    origin.row = 7;
    expect(board.ships[0]?.origin).toEqual({ row: 0, col: 0 });
    expect(board.ships[0]?.origin).toEqual(board.ships[0]?.cells[0]);
  });
});

describe('removeShip', () => {
  it('removes a placed ship', () => {
    const board = placeShip(emptyBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal');
    const removed = removeShip(board, 'destroyer');
    expect(removed.ships).toHaveLength(0);
    expect(board.ships).toHaveLength(1);
  });

  it('returns a copy when the ship is not placed', () => {
    const board = emptyBoard();
    const removed = removeShip(board, 'carrier');
    expect(removed).not.toBe(board);
    expect(removed.ships).toHaveLength(0);
  });
});

describe('shipAt', () => {
  it('finds the ship occupying a coord', () => {
    const board = placeShip(emptyBoard(), 'submarine', { row: 2, col: 2 }, 'horizontal');
    expect(shipAt(board, { row: 2, col: 4 })?.type).toBe('submarine');
    expect(shipAt(board, { row: 3, col: 2 })).toBeUndefined();
  });
});

describe('isFleetComplete', () => {
  it('is false until every FLEET type is placed', () => {
    let board = emptyBoard();
    expect(isFleetComplete(board)).toBe(false);
    // one ship per row, all horizontal — no overlap possible
    for (let i = 0; i < FLEET.length - 1; i++) {
      board = placeShip(board, FLEET[i]!.type, { row: i, col: 0 }, 'horizontal');
      expect(isFleetComplete(board)).toBe(false);
    }
    board = placeShip(board, 'destroyer', { row: 4, col: 0 }, 'horizontal');
    expect(isFleetComplete(board)).toBe(true);
  });
});

describe('randomFleet', () => {
  it('places a legal complete fleet for many seeds', () => {
    for (let seed = 0; seed < 500; seed++) {
      const board = randomFleet(createRng(seed));
      expect(board.ships).toHaveLength(5);
      expect(isFleetComplete(board)).toBe(true);
      const cells = board.ships.flatMap((s) => s.cells);
      expect(cells.every(isInBounds)).toBe(true);
      expect(new Set(cells.map(coordKey)).size).toBe(17);
    }
  });

  it('produces identical boards for the same seed', () => {
    expect(randomFleet(createRng(99))).toEqual(randomFleet(createRng(99)));
  });
});
