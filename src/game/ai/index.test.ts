import { describe, expect, it } from 'vitest';
import { allCoords } from '../coord';
import { createGame, fire, startGame } from '../game';
import { createRng } from '../rng';
import { randomFleet } from '../board';
import { chooseShot, DIFFICULTIES, playComputerTurn, type Difficulty } from './index';
import { chooseEasyShot } from './easy';
import { chooseNormalShot } from './normal';
import { chooseHardShot } from './hard';
import { makeView, simulateGame, type ShotChooser } from './simulate.test-utils';

const CHOOSERS: Record<Difficulty, ShotChooser> = {
  easy: chooseEasyShot,
  normal: chooseNormalShot,
  hard: chooseHardShot,
};

describe('chooseShot', () => {
  it('dispatches to the chooser for each difficulty', () => {
    const view = makeView([], []);
    for (const difficulty of DIFFICULTIES) {
      const shot = chooseShot(difficulty, view, createRng(1));
      expect(shot).toEqual(CHOOSERS[difficulty](view, createRng(1)));
    }
  });

  it('throws when the view has no untried cells', () => {
    const full = makeView([], allCoords());
    for (const difficulty of DIFFICULTIES) {
      expect(() => chooseShot(difficulty, full, createRng(1))).toThrow();
    }
  });
});

describe('playComputerTurn', () => {
  it('fires one new shot on the player board and passes the turn', () => {
    const rng = createRng(42);
    let state = startGame(createGame(rng), randomFleet(createRng(7)));
    const playerShot = fire(state, 'player', { row: 9, col: 9 });
    expect(playerShot.ok).toBe(true);
    if (!playerShot.ok) return;
    state = playerShot.state;
    expect(state.turn).toBe('computer');

    const before = state.playerBoard.shots.size;
    const outcome = playComputerTurn(state, 'normal', createRng(2));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.playerBoard.shots.size).toBe(before + 1);
    expect(outcome.state.turn).toBe('player');
  });

  it('is rejected when it is not the computer turn', () => {
    const state = startGame(createGame(createRng(42)), randomFleet(createRng(7)));
    expect(state.turn).toBe('player');
    expect(playComputerTurn(state, 'easy', createRng(2))).toEqual({
      ok: false,
      reason: 'not-your-turn',
    });
  });
});

describe('difficulty strength ordering', () => {
  it('hard < normal < easy mean shots over the same 200 seeds', { timeout: 60_000 }, () => {
    const means = {} as Record<Difficulty, number>;
    for (const difficulty of DIFFICULTIES) {
      let total = 0;
      for (let seed = 0; seed < 200; seed++) {
        const board = randomFleet(createRng(seed));
        total += simulateGame(CHOOSERS[difficulty], board, createRng(seed + 500_000));
      }
      means[difficulty] = total / 200;
    }
    expect(means.hard).toBeLessThan(means.normal);
    expect(means.normal).toBeLessThan(means.easy);
    expect(means.normal).toBeLessThan(75);
  });
});
