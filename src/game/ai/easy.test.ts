import { describe, expect, it } from 'vitest';
import { allCoords } from '../coord';
import { createRng } from '../rng';
import { randomFleet } from '../board';
import { chooseEasyShot } from './easy';
import { makeView, simulateGame } from './simulate.test-utils';

describe('chooseEasyShot', () => {
  it('returns the last untried cell on a nearly-full board', () => {
    const shots = allCoords().slice(0, 99);
    const view = makeView([], shots);
    for (let i = 0; i < 20; i++) {
      expect(chooseEasyShot(view, createRng(i))).toEqual({ row: 9, col: 9 });
    }
  });

  it('only ever picks untried cells over many draws', () => {
    const view = makeView([], allCoords().slice(0, 50));
    for (let i = 0; i < 200; i++) {
      const shot = chooseEasyShot(view, createRng(i));
      expect(view.shots.has(`${shot.row},${shot.col}`)).toBe(false);
    }
  });
});

describe('easy opponent simulation', () => {
  it('sinks every fleet within 100 shots across 200 seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const shots = simulateGame(
        chooseEasyShot,
        randomFleet(createRng(seed)),
        createRng(seed + 100_000),
      );
      expect(shots).toBeLessThanOrEqual(100);
    }
  });
});
