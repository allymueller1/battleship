import type { GameState, MoveRejection, Player } from '../game/game';
import type { Board, Coord, ShipType, ShotResult } from '../game/types';
import type { PlaceError } from './placement';
import { shipDisplayName } from './theme';

const COLUMNS = 'ABCDEFGHIJ';

/** Human-readable cell name, e.g. { row: 4, col: 1 } -> "B5". */
export function coordLabel(c: Coord): string {
  return `${COLUMNS.charAt(c.col)}${c.row + 1}`;
}

function shipName(type: ShipType): string {
  return shipDisplayName(type);
}

/** Describes a shot. A hit on the computer's fleet does not reveal which ship was hit. */
export function shotMessage(shooter: Player, result: ShotResult): string {
  const at = coordLabel(result.coord);
  if (shooter === 'player') {
    switch (result.kind) {
      case 'miss':
        return `Your strike at ${at}: miss.`;
      case 'hit':
        return `Your strike at ${at}: hit!`;
      case 'sunk':
        return `Your strike at ${at}: hit! You destroyed the enemy ${shipName(result.ship.type)}.`;
    }
  }
  switch (result.kind) {
    case 'miss':
      return `Enemy strike at ${at}: miss.`;
    case 'hit':
      return `Enemy strike at ${at}: hit on your ${shipName(result.shipType)}.`;
    case 'sunk':
      return `Enemy strike at ${at} destroyed your ${shipName(result.ship.type)}.`;
  }
}

export function rejectionMessage(reason: MoveRejection, coord: Coord): string {
  switch (reason) {
    case 'already-fired':
      return `You already struck ${coordLabel(coord)}. Pick a new target.`;
    case 'not-your-turn':
      return 'Hold on, the enemy is firing.';
    case 'game-over':
      return 'The battle is over. Choose Play again to start a new one.';
    case 'wrong-phase':
      return 'Deploy your fleet and start the battle first.';
    case 'out-of-bounds':
      return 'That target is off the grid.';
  }
}

export function placementMessage(error: PlaceError, type: ShipType | null): string {
  const name = type ? `The ${shipName(type)}` : 'That ship';
  switch (error) {
    case 'none-selected':
      return 'All ships are placed. Select a ship to move it, or start the battle.';
    case 'out-of-bounds':
      return `${name} doesn't fit there because it would go off the grid.`;
    case 'overlap':
      return `${name} would overlap another ship.`;
    case 'already-placed':
      return `${name} is already on the board.`;
  }
}

export interface ShotStats {
  readonly shots: number;
  readonly hits: number;
}

export interface EndSummary {
  readonly won: boolean;
  readonly title: string;
  readonly text: string;
  readonly player: ShotStats;
  readonly computer: ShotStats;
}

function shotStats(board: Board): ShotStats {
  let hits = 0;
  for (const mark of board.shots.values()) {
    if (mark === 'hit') {
      hits++;
    }
  }
  return { shots: board.shots.size, hits };
}

/** The end-of-game title, text and per-side shot counts for the end dialog. */
export function endSummary(state: GameState, level: string): EndSummary {
  if (state.phase !== 'over') {
    throw new Error(`Cannot summarise a game in phase: ${state.phase}`);
  }
  const won = state.winner === 'player';
  const shots = won ? state.computerBoard.shots.size : state.playerBoard.shots.size;
  return {
    won,
    title: won ? 'Victory!' : 'Defeat',
    text: won
      ? `You destroyed the enemy fleet in ${shots} strikes on ${level}.`
      : `The enemy destroyed your fleet in ${shots} strikes on ${level}.`,
    player: shotStats(state.computerBoard),
    computer: shotStats(state.playerBoard),
  };
}

export function turnMessage(state: GameState): string {
  switch (state.phase) {
    case 'placing':
      return 'Deploy your fleet: choose a ship, then a cell. Press R or Rotate to turn it.';
    case 'over':
      return state.winner === 'player'
        ? 'Victory! You destroyed the whole enemy fleet.'
        : 'Defeat. The enemy destroyed your whole fleet.';
    case 'playing':
      return state.turn === 'player'
        ? 'Your turn: target a cell in the Enemy sector.'
        : "Enemy's turn…";
  }
}
