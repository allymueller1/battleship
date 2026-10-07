import type { GameState } from '../game/game';

export function boardInteractivity(state: GameState): { player: boolean; enemy: boolean } {
  return { player: state.phase === 'placing', enemy: state.phase === 'playing' };
}
