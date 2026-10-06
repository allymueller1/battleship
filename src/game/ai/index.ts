import { fire, turnRejection, type GameState, type MoveOutcome } from '../game';
import { targetView } from '../shots';
import type { Rng } from '../rng';
import type { Coord, TargetView } from '../types';
import { chooseEasyShot } from './easy';
import { chooseHardShot } from './hard';
import { chooseNormalShot } from './normal';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export function chooseShot(difficulty: Difficulty, view: TargetView, rng: Rng): Coord {
  switch (difficulty) {
    case 'easy':
      return chooseEasyShot(view, rng);
    case 'normal':
      return chooseNormalShot(view, rng);
    case 'hard':
      return chooseHardShot(view, rng);
  }
}

/** Picks the computer's shot from what it can see of the player's board and fires it. */
export function playComputerTurn(state: GameState, difficulty: Difficulty, rng: Rng): MoveOutcome {
  const rejection = turnRejection(state, 'computer');
  if (rejection) {
    return { ok: false, reason: rejection };
  }
  return fire(state, 'computer', chooseShot(difficulty, targetView(state.playerBoard), rng));
}
