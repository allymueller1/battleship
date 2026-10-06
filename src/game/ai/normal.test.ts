import { describe, expect, it } from 'vitest';
import { coordKey } from '../coord';
import { createRng } from '../rng';
import { randomFleet } from '../board';
import { chooseNormalShot } from './normal';
import { makeView, simulateGame } from './simulate.test-utils';
import type { Coord } from '../types';

function keys(coords: Coord[]): Set<string> {
  return new Set(coords.map(coordKey));
}

describe('chooseNormalShot — hunt mode', () => {
  it('picks only checkerboard cells on an empty view', () => {
    const view = makeView([], []);
    for (let i = 0; i < 200; i++) {
      const shot = chooseNormalShot(view, createRng(i));
      expect((shot.row + shot.col) % 2).toBe(0);
    }
  });
});

describe('chooseNormalShot — target mode', () => {
  it('probes a neighbor of a single hit', () => {
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
      expect(options.has(coordKey(chooseNormalShot(view, createRng(i))))).toBe(true);
    }
  });

  it('probes a neighbor of a corner hit', () => {
    const view = makeView(
      [{ type: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'vertical' }],
      [{ row: 0, col: 0 }],
    );
    const options = keys([
      { row: 1, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(options.has(coordKey(chooseNormalShot(view, createRng(1))))).toBe(true);
  });

  it('extends a two-hit line to either end', () => {
    const view = makeView(
      [{ type: 'cruiser', origin: { row: 4, col: 4 }, orientation: 'horizontal' }],
      [
        { row: 4, col: 4 },
        { row: 4, col: 5 },
      ],
    );
    const options = keys([
      { row: 4, col: 3 },
      { row: 4, col: 6 },
    ]);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(coordKey(chooseNormalShot(view, createRng(i))));
    }
    expect([...seen].every((k) => options.has(k))).toBe(true);
  });

  it('reverses the line when one end is blocked by a miss', () => {
    const view = makeView(
      [{ type: 'cruiser', origin: { row: 4, col: 4 }, orientation: 'horizontal' }],
      [
        { row: 4, col: 3 },
        { row: 4, col: 4 },
        { row: 4, col: 5 },
      ],
    );
    for (let i = 0; i < 50; i++) {
      expect(chooseNormalShot(view, createRng(i))).toEqual({ row: 4, col: 6 });
    }
  });

  it('tries perpendicular neighbors when both ends are blocked', () => {
    // hits (0,0),(0,1) belong to two different vertical ships; the run's ends
    // are blocked by the top edge and a miss at (0,2)
    const view = makeView(
      [
        { type: 'battleship', origin: { row: 0, col: 0 }, orientation: 'vertical' },
        { type: 'destroyer', origin: { row: 0, col: 1 }, orientation: 'vertical' },
      ],
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    );
    const options = keys([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
    const shot = chooseNormalShot(view, createRng(7));
    expect(options.has(coordKey(shot))).toBe(true);
  });

  it('targets a leftover hit next to a sunk ship instead of hunting', () => {
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
    const options = keys([
      { row: 2, col: 0 },
      { row: 1, col: 1 },
    ]);
    for (let i = 0; i < 50; i++) {
      expect(options.has(coordKey(chooseNormalShot(view, createRng(i))))).toBe(true);
    }
  });

  it('goes perpendicular for side-by-side ships blocked along the row', () => {
    // hits (2,3),(2,4) with misses at both row ends — the hits may belong to
    // two touching ships, so probe above and below
    const view = makeView(
      [
        { type: 'destroyer', origin: { row: 2, col: 3 }, orientation: 'vertical' },
        { type: 'cruiser', origin: { row: 2, col: 4 }, orientation: 'vertical' },
      ],
      [
        { row: 2, col: 2 },
        { row: 2, col: 3 },
        { row: 2, col: 4 },
        { row: 2, col: 5 },
      ],
    );
    const options = keys([
      { row: 1, col: 3 },
      { row: 3, col: 3 },
      { row: 1, col: 4 },
      { row: 3, col: 4 },
    ]);
    for (let i = 0; i < 50; i++) {
      expect(options.has(coordKey(chooseNormalShot(view, createRng(i))))).toBe(true);
    }
  });
});

describe('normal opponent simulation', () => {
  it('sinks every fleet within 100 shots across 200 seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const shots = simulateGame(
        chooseNormalShot,
        randomFleet(createRng(seed)),
        createRng(seed + 200_000),
      );
      expect(shots).toBeLessThanOrEqual(100);
    }
  });
});
