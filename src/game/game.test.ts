import { describe, expect, it } from 'vitest';
import { randomFleet } from './board';
import { allCoords, sameCoord } from './coord';
import { createGame, fire, opponentOf, startGame, type GameState } from './game';
import { createRng } from './rng';
import { allShipsSunk, fireShot } from './shots';

const SEED = 12345;

function playingState(): GameState {
  const state = createGame(createRng(SEED));
  return startGame(state, randomFleet(createRng(SEED + 1)));
}

describe('createGame', () => {
  it('starts in placing phase, player to move, no winner', () => {
    const state = createGame(createRng(SEED));
    expect(state.phase).toBe('placing');
    expect(state.turn).toBe('player');
    expect(state.winner).toBeNull();
    expect(state.playerBoard.ships).toHaveLength(0);
  });

  it('deploys a complete computer fleet', () => {
    const state = createGame(createRng(SEED));
    expect(state.computerBoard.ships).toHaveLength(5);
    expect(state.computerBoard.ships.flatMap((s) => s.cells)).toHaveLength(17);
  });
});

describe('startGame', () => {
  it('rejects an incomplete fleet', () => {
    const state = createGame(createRng(SEED));
    expect(() => startGame(state, state.playerBoard)).toThrow(/fleet/);
  });

  it('rejects starting outside the placing phase', () => {
    const state = playingState();
    expect(() => startGame(state, state.playerBoard)).toThrow(/phase/);
  });

  it('rejects a board that already has shots', () => {
    const state = createGame(createRng(SEED));
    const board = fireShot(randomFleet(createRng(SEED + 1)), { row: 9, col: 9 }).board;
    expect(() => startGame(state, board)).toThrow(/shots/);
  });

  it('moves to playing with the player to move', () => {
    const state = playingState();
    expect(state.phase).toBe('playing');
    expect(state.turn).toBe('player');
    expect(state.playerBoard.ships).toHaveLength(5);
  });
});

describe('fire', () => {
  it('rejects out-of-bounds, out-of-turn, and repeat shots', () => {
    let state = playingState();
    expect(fire(state, 'computer', { row: 0, col: 0 })).toEqual({
      ok: false,
      reason: 'not-your-turn',
    });
    expect(fire(state, 'player', { row: -1, col: 0 })).toEqual({
      ok: false,
      reason: 'out-of-bounds',
    });
    expect(fire(state, 'player', { row: 0.5, col: 0 })).toEqual({
      ok: false,
      reason: 'out-of-bounds',
    });

    const shot = fire(state, 'player', { row: 0, col: 0 });
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    state = shot.state;

    // now the computer's turn; asking the player to fire again is rejected
    expect(fire(state, 'player', { row: 0, col: 1 })).toEqual({
      ok: false,
      reason: 'not-your-turn',
    });

    const counter = fire(state, 'computer', { row: 0, col: 0 });
    expect(counter.ok).toBe(true);
    if (!counter.ok) return;
    state = counter.state;

    // same cell on the computer board again is a repeat
    expect(fire(state, 'player', { row: 0, col: 0 })).toEqual({
      ok: false,
      reason: 'already-fired',
    });
  });

  it('rejects firing while still placing', () => {
    const state = createGame(createRng(SEED));
    expect(fire(state, 'player', { row: 0, col: 0 })).toEqual({
      ok: false,
      reason: 'wrong-phase',
    });
  });

  it('alternates turns on hit and on miss', () => {
    const state = playingState();
    // find a hit and a miss on the computer board
    const hit = state.computerBoard.ships[0]!.cells[0]!;
    const miss = allCoords().find(
      (c) => !state.computerBoard.ships.some((s) => s.cells.some((sc) => sameCoord(sc, c))),
    )!;

    const afterHit = fire(state, 'player', hit);
    expect(afterHit.ok && afterHit.state.turn === 'computer').toBe(true);

    const afterMiss = fire(state, 'player', miss);
    expect(afterMiss.ok && afterMiss.state.turn === 'computer').toBe(true);
  });

  it('ends the game when the last ship sinks and rejects further fire', () => {
    // player sweeps the computer's ship cells in row-major order
    const state = playingState();
    const targets = allCoords().filter((c) =>
      state.computerBoard.ships.some((s) => s.cells.some((sc) => sameCoord(sc, c))),
    );
    expect(targets).toHaveLength(17);

    // the computer sweeps its target row-major too, one shot per player move
    let outcome = fire(state, 'player', targets[0]!);
    for (let i = 1; outcome.ok && outcome.state.phase !== 'over' && i < targets.length; i++) {
      const counter = fire(outcome.state, 'computer', allCoords()[i - 1]!);
      expect(counter.ok).toBe(true);
      if (!counter.ok) break;
      outcome = fire(counter.state, 'player', targets[i]!);
    }

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.phase).toBe('over');
    expect(outcome.state.winner).toBe('player');
    expect(allShipsSunk(outcome.state.computerBoard)).toBe(true);
    expect(fire(outcome.state, 'player', { row: 5, col: 5 })).toEqual({
      ok: false,
      reason: 'game-over',
    });
    expect(fire(outcome.state, 'computer', { row: 5, col: 5 })).toEqual({
      ok: false,
      reason: 'game-over',
    });
  });

  it('does not mutate the prior state', () => {
    const state = playingState();
    const before = state.computerBoard;
    const outcome = fire(state, 'player', { row: 0, col: 0 });
    expect(outcome.ok).toBe(true);
    expect(state.computerBoard).toBe(before);
    expect(state.turn).toBe('player');
    expect(state.phase).toBe('playing');
  });

  it('plays a full scripted game to a winner without throwing', () => {
    // Both sides sweep cells in row-major order with a fixed seed.
    let state = playingState();
    const cells = allCoords();
    let i = 0;
    let j = 0;
    while (state.phase !== 'over') {
      if (state.turn === 'player') {
        const outcome = fire(state, 'player', cells[i++]!);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) state = outcome.state;
      } else {
        const outcome = fire(state, 'computer', cells[j++]!);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) state = outcome.state;
      }
      expect(i + j).toBeLessThanOrEqual(200);
    }
    expect(state.winner).not.toBeNull();
    const loserBoard = state.winner === 'player' ? state.computerBoard : state.playerBoard;
    expect(allShipsSunk(loserBoard)).toBe(true);
  });
});

describe('opponentOf', () => {
  it('returns the other player', () => {
    expect(opponentOf('player')).toBe('computer');
    expect(opponentOf('computer')).toBe('player');
  });
});
