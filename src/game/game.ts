import { createBoard, isFleetComplete, randomFleet } from './board';
import { coordKey, isInBounds } from './coord';
import type { Rng } from './rng';
import { allShipsSunk, fireShot } from './shots';
import type { Board, Coord, ShotResult } from './types';

export type Player = 'player' | 'computer';
export type Phase = 'placing' | 'playing' | 'over';

export interface GameState {
  readonly phase: Phase;
  readonly turn: Player;
  readonly winner: Player | null;
  readonly playerBoard: Board;
  readonly computerBoard: Board;
}

export type MoveRejection =
  | 'wrong-phase'
  | 'not-your-turn'
  | 'already-fired'
  | 'out-of-bounds'
  | 'game-over';

export type MoveOutcome =
  | { readonly ok: true; readonly state: GameState; readonly result: ShotResult }
  | { readonly ok: false; readonly reason: MoveRejection };

/**
 * Starts a fresh game: the human is still placing ships, the computer's fleet
 * is already deployed. "Play again" means calling createGame again — there is
 * no separate reset function.
 */
export function createGame(rng: Rng): GameState {
  return {
    phase: 'placing',
    turn: 'player',
    winner: null,
    playerBoard: createBoard(),
    computerBoard: randomFleet(rng),
  };
}

export function startGame(state: GameState, playerBoard: Board): GameState {
  if (state.phase !== 'placing') {
    throw new Error(`Cannot start game in phase: ${state.phase}`);
  }
  if (!isFleetComplete(playerBoard)) {
    throw new Error('Cannot start game: fleet is not complete');
  }
  return { ...state, phase: 'playing', turn: 'player', playerBoard };
}

export function fire(state: GameState, shooter: Player, coord: Coord): MoveOutcome {
  if (state.phase === 'over') {
    return { ok: false, reason: 'game-over' };
  }
  if (state.phase !== 'playing') {
    return { ok: false, reason: 'wrong-phase' };
  }
  if (state.turn !== shooter) {
    return { ok: false, reason: 'not-your-turn' };
  }
  if (!isInBounds(coord)) {
    return { ok: false, reason: 'out-of-bounds' };
  }

  const targetBoard = shooter === 'player' ? state.computerBoard : state.playerBoard;
  if (targetBoard.shots.has(coordKey(coord))) {
    return { ok: false, reason: 'already-fired' };
  }

  const { board, result } = fireShot(targetBoard, coord);
  const next: GameState = {
    ...state,
    playerBoard: shooter === 'player' ? state.playerBoard : board,
    computerBoard: shooter === 'player' ? board : state.computerBoard,
  };

  if (allShipsSunk(board)) {
    return { ok: true, state: { ...next, phase: 'over', winner: shooter }, result };
  }
  return { ok: true, state: { ...next, turn: opponentOf(shooter) }, result };
}

export function opponentOf(player: Player): Player {
  return player === 'player' ? 'computer' : 'player';
}
