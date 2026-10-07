import { describe, expect, it } from 'vitest';
import { randomFleet } from '../game/board';
import { createGame, fire, startGame } from '../game/game';
import { createRng } from '../game/rng';
import { boardInteractivity } from './interactivity';

function playingState() {
  return startGame(createGame(createRng(7)), randomFleet(createRng(8)));
}

describe('boardInteractivity', () => {
  it('only your board is interactive while placing', () => {
    expect(boardInteractivity(createGame(createRng(7)))).toEqual({
      player: true,
      enemy: false,
    });
  });

  it('only the enemy board is interactive on your turn', () => {
    expect(boardInteractivity(playingState())).toEqual({
      player: false,
      enemy: true,
    });
  });

  it('neither board is interactive once the game is over', () => {
    const state = playingState();
    expect(boardInteractivity({ ...state, phase: 'over', winner: 'player' })).toEqual({
      player: false,
      enemy: false,
    });
  });

  it("neither board is interactive on the computer's turn", () => {
    const outcome = fire(playingState(), 'player', { row: 0, col: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.turn).toBe('computer');
    expect(boardInteractivity(outcome.state)).toEqual({
      player: false,
      enemy: false,
    });
  });
});
