import { describe, expect, it } from 'vitest';
import { createBoard, placeShip } from './board';
import { coordKey } from './coord';
import { allShipsSunk, fireShot, fleetStatus, isShipSunk, targetView } from './shots';
import { FLEET } from './ships';
import type { Board } from './types';

function boardWithDestroyer(): Board {
  return placeShip(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal');
}

describe('fireShot', () => {
  it('records a miss on an empty cell', () => {
    const { board, result } = fireShot(boardWithDestroyer(), { row: 5, col: 5 });
    expect(result).toEqual({ kind: 'miss', coord: { row: 5, col: 5 } });
    expect(board.shots.get('5,5')).toBe('miss');
  });

  it('returns hit with the ship type', () => {
    const { board, result } = fireShot(boardWithDestroyer(), { row: 0, col: 0 });
    expect(result).toEqual({ kind: 'hit', coord: { row: 0, col: 0 }, shipType: 'destroyer' });
    expect(board.shots.get('0,0')).toBe('hit');
  });

  it('returns sunk with the ship on its final cell', () => {
    const { board } = fireShot(boardWithDestroyer(), { row: 0, col: 0 });
    const { result } = fireShot(board, { row: 0, col: 1 });
    expect(result.kind).toBe('sunk');
    if (result.kind === 'sunk') {
      expect(result.ship.type).toBe('destroyer');
      expect(result.ship.cells).toHaveLength(2);
    }
  });

  it('throws on out-of-bounds shots', () => {
    expect(() => fireShot(boardWithDestroyer(), { row: -1, col: 0 })).toThrow(/out of bounds/);
    expect(() => fireShot(boardWithDestroyer(), { row: 0, col: 10 })).toThrow(/out of bounds/);
  });

  it('throws on repeated shots', () => {
    const { board } = fireShot(boardWithDestroyer(), { row: 5, col: 5 });
    expect(() => fireShot(board, { row: 5, col: 5 })).toThrow(/already fired/i);
  });

  it('does not mutate the input board', () => {
    const board = boardWithDestroyer();
    fireShot(board, { row: 0, col: 0 });
    expect(board.shots.size).toBe(0);
  });

  it('stores a copy of the coord in the result, not the caller object', () => {
    const coord = { row: 5, col: 5 };
    const { result } = fireShot(boardWithDestroyer(), coord);
    coord.row = 0;
    expect(result.coord).toEqual({ row: 5, col: 5 });
  });
});

describe('isShipSunk / allShipsSunk', () => {
  it('detects a sunk ship only when every cell is hit', () => {
    const start = boardWithDestroyer();
    const ship = start.ships[0]!;
    const { board } = fireShot(start, { row: 0, col: 0 });
    expect(isShipSunk(board, ship)).toBe(false);
    const { board: final } = fireShot(board, { row: 0, col: 1 });
    expect(isShipSunk(final, ship)).toBe(true);
    expect(allShipsSunk(final)).toBe(true);
  });

  it('allShipsSunk is false for a board with no ships', () => {
    expect(allShipsSunk(createBoard())).toBe(false);
  });
});

describe('fleetStatus', () => {
  it('lists every FLEET spec in order with sunk flags', () => {
    const start = boardWithDestroyer();
    const before = fleetStatus(start);
    expect(before.map((f) => f.spec)).toEqual(FLEET);
    expect(before.every((f) => !f.sunk)).toBe(true);

    let board = start;
    for (const c of [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]) {
      board = fireShot(board, c).board;
    }
    const after = fleetStatus(board);
    expect(after.find((f) => f.spec.type === 'destroyer')?.sunk).toBe(true);
    expect(after.find((f) => f.spec.type === 'carrier')?.sunk).toBe(false);
  });
});

describe('targetView', () => {
  it('exposes shots and sunk ships but no unsunk ship cells', () => {
    const start = boardWithDestroyer();
    let board = fireShot(start, { row: 5, col: 5 }).board;
    board = fireShot(board, { row: 0, col: 0 }).board;
    board = fireShot(board, { row: 0, col: 1 }).board;

    const view = targetView(board);
    expect(view.shots.get('5,5')).toBe('miss');
    expect(view.shots.get('0,0')).toBe('hit');
    expect(view.sunkShips.map((s) => s.type)).toEqual(['destroyer']);
    expect(view.remainingShips.map((s) => s.type)).toEqual([
      'carrier',
      'battleship',
      'cruiser',
      'submarine',
    ]);
  });

  it('lists all ships as remaining before any are placed', () => {
    const view = targetView(createBoard());
    expect(view.remainingShips).toEqual(FLEET);
    expect(view.sunkShips).toHaveLength(0);
  });

  it('returns a copy of the shots map', () => {
    const board = fireShot(boardWithDestroyer(), { row: 5, col: 5 }).board;
    const view = targetView(board);
    expect(view.shots).not.toBe(board.shots);
    expect(view.shots.get(coordKey({ row: 5, col: 5 }))).toBe('miss');
  });
});
