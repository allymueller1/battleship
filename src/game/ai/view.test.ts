import { describe, expect, it } from 'vitest';
import { allCoords, coordKey } from '../coord';
import { makeView } from './simulate.test-utils';
import { unresolvedHits, untriedCoords } from './view';

describe('untriedCoords', () => {
  it('returns all 100 cells on a fresh view', () => {
    expect(untriedCoords(makeView([], []))).toHaveLength(100);
  });

  it('excludes fired cells, hit or miss', () => {
    const view = makeView(
      [{ type: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'horizontal' }],
      [
        { row: 0, col: 0 },
        { row: 5, col: 5 },
      ],
    );
    const untried = new Set(untriedCoords(view).map(coordKey));
    expect(untried.size).toBe(98);
    expect(untried.has('0,0')).toBe(false);
    expect(untried.has('5,5')).toBe(false);
  });
});

describe('unresolvedHits', () => {
  it('keeps hits on ships that are still afloat', () => {
    const view = makeView(
      [{ type: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'horizontal' }],
      [{ row: 0, col: 0 }],
    );
    expect(unresolvedHits(view)).toEqual([{ row: 0, col: 0 }]);
  });

  it('drops cells of sunk ships', () => {
    const view = makeView(
      [{ type: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'horizontal' }],
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    );
    expect(unresolvedHits(view)).toEqual([]);
  });

  it('keeps an adjacent hit from a different touching ship', () => {
    const view = makeView(
      [
        { type: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'horizontal' },
        { type: 'submarine', origin: { row: 1, col: 0 }, orientation: 'horizontal' },
      ],
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ],
    );
    expect(unresolvedHits(view)).toEqual([{ row: 1, col: 0 }]);
  });

  it('returns hits in row-major order', () => {
    const view = makeView(
      [{ type: 'carrier', origin: { row: 2, col: 2 }, orientation: 'horizontal' }],
      [
        { row: 2, col: 5 },
        { row: 2, col: 3 },
      ],
    );
    expect(unresolvedHits(view)).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 5 },
    ]);
    expect(allCoords().length).toBe(100);
  });
});
