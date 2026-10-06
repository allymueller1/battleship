import { describe, expect, it } from 'vitest';
import { allCoords, coordKey, isInBounds, neighbors, sameCoord } from './coord';
import { BOARD_SIZE } from './types';

describe('coordKey', () => {
  it('formats as row,col', () => {
    expect(coordKey({ row: 3, col: 7 })).toBe('3,7');
    expect(coordKey({ row: 0, col: 0 })).toBe('0,0');
  });
});

describe('isInBounds', () => {
  it('accepts the four corners', () => {
    for (const c of [
      { row: 0, col: 0 },
      { row: 0, col: 9 },
      { row: 9, col: 0 },
      { row: 9, col: 9 },
    ]) {
      expect(isInBounds(c)).toBe(true);
    }
  });

  it('rejects out-of-bounds coords', () => {
    for (const c of [
      { row: -1, col: 0 },
      { row: 0, col: -1 },
      { row: 10, col: 0 },
      { row: 0, col: 10 },
      { row: -1, col: -1 },
      { row: 10, col: 10 },
    ]) {
      expect(isInBounds(c)).toBe(false);
    }
  });

  it('rejects non-integer coords', () => {
    for (const c of [
      { row: 0.5, col: 0 },
      { row: 0, col: 0.5 },
      { row: NaN, col: 0 },
      { row: 0, col: NaN },
    ]) {
      expect(isInBounds(c)).toBe(false);
    }
  });
});

describe('allCoords', () => {
  it('returns all 100 cells in row-major order', () => {
    const coords = allCoords();
    expect(coords).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(coords[0]).toEqual({ row: 0, col: 0 });
    expect(coords[9]).toEqual({ row: 0, col: 9 });
    expect(coords[10]).toEqual({ row: 1, col: 0 });
    expect(coords[99]).toEqual({ row: 9, col: 9 });
    expect(coords.every(isInBounds)).toBe(true);
  });
});

describe('neighbors', () => {
  it('returns 2 neighbors for a corner', () => {
    expect(neighbors({ row: 0, col: 0 })).toEqual([
      { row: 1, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  it('returns 3 neighbors for an edge cell', () => {
    expect(neighbors({ row: 0, col: 5 })).toEqual([
      { row: 1, col: 5 },
      { row: 0, col: 4 },
      { row: 0, col: 6 },
    ]);
  });

  it('returns 4 neighbors for a middle cell in up/down/left/right order', () => {
    expect(neighbors({ row: 4, col: 4 })).toEqual([
      { row: 3, col: 4 },
      { row: 5, col: 4 },
      { row: 4, col: 3 },
      { row: 4, col: 5 },
    ]);
  });
});

describe('sameCoord', () => {
  it('compares by row and col', () => {
    expect(sameCoord({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true);
    expect(sameCoord({ row: 1, col: 2 }, { row: 2, col: 1 })).toBe(false);
  });
});
