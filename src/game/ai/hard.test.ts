import { describe, expect, it } from 'vitest';
import { coordKey } from '../coord';
import { createRng } from '../rng';
import { randomFleet } from '../board';
import { chooseHardShot, probabilityMap } from './hard';
import { makeView, simulateGame } from './simulate.test-utils';
import type { Coord } from '../types';

function keys(coords: Coord[]): Set<string> {
  return new Set(coords.map(coordKey));
}

describe('probabilityMap', () => {
  it('gives 0 to tried cells', () => {
    const view = makeView([], [{ row: 4, col: 4 }]);
    const map = probabilityMap(view);
    expect(map[4]![4]).toBe(0);
    expect(map[4]![5]!).toBeGreaterThan(0);
  });

  it('gives 0 to an untried cell enclosed by misses and the edge', () => {
    // (0,0) can only be reached by a ship of length >= 2 going right or down;
    // with misses at (0,1) and (1,0) nothing covers it
    const view = makeView(
      [],
      [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ],
    );
    expect(probabilityMap(view)[0]![0]).toBe(0);
  });
});

describe('chooseHardShot', () => {
  it('chooses one of the four centre cells on an empty view', () => {
    const centre = keys([
      { row: 4, col: 4 },
      { row: 4, col: 5 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
    ]);
    for (let i = 0; i < 50; i++) {
      const shot = chooseHardShot(makeView([], []), createRng(i));
      expect(centre.has(coordKey(shot))).toBe(true);
    }
  });

  it('chooses an orthogonal neighbor of a single unresolved hit', () => {
    const view = makeView(
      [{ type: 'cruiser', origin: { row: 5, col: 5 }, orientation: 'horizontal' }],
      [{ row: 5, col: 5 }],
    );
    const options = keys([
      { row: 4, col: 5 },
      { row: 6, col: 5 },
      { row: 5, col: 4 },
      { row: 5, col: 6 },
    ]);
    for (let i = 0; i < 50; i++) {
      expect(options.has(coordKey(chooseHardShot(view, createRng(i))))).toBe(true);
    }
  });

  it('keeps targeting the leftover hit of a touching ship after a sink', () => {
    // destroyer sunk at (0,0),(0,1); an unresolved hit at (1,0) belongs to a
    // different ship. The densest cell is in line with that hit — the ×20
    // weight reaches every untried cell of placements through it, so the
    // argmax may be a couple of cells along the line, not just a neighbor.
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
    const map = probabilityMap(view);
    const max = Math.max(...map.flat());
    for (let i = 0; i < 50; i++) {
      const shot = chooseHardShot(view, createRng(i));
      const inLine = (shot.row === 1 && shot.col <= 4) || (shot.col === 0 && shot.row <= 5);
      expect(inLine).toBe(true);
      expect(map[shot.row]![shot.col]).toBe(max);
    }
  });
});

describe('hard opponent simulation', () => {
  it('sinks every fleet within 100 shots across 200 seeds', { timeout: 60_000 }, () => {
    for (let seed = 0; seed < 200; seed++) {
      const shots = simulateGame(
        chooseHardShot,
        randomFleet(createRng(seed)),
        createRng(seed + 300_000),
      );
      expect(shots).toBeLessThanOrEqual(100);
    }
  });
});
