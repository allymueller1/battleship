import { describe, expect, it } from 'vitest';
import { randomFleet } from '../game/board';
import { createGame, startGame } from '../game/game';
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
});
