import type { GameState, MoveRejection, Player } from '../game/game';
import { getShipSpec } from '../game/ships';
import type { Coord, ShipType, ShotResult } from '../game/types';
import type { PlaceError } from './placement';

const COLUMNS = 'ABCDEFGHIJ';

/** Human-readable cell name, e.g. { row: 4, col: 1 } -> "B5". */
export function coordLabel(c: Coord): string {
  return `${COLUMNS.charAt(c.col)}${c.row + 1}`;
}

function shipName(type: ShipType): string {
  return getShipSpec(type).name;
}

/** Describes a shot. A hit on the computer's fleet does not reveal which ship was hit. */
export function shotMessage(shooter: Player, result: ShotResult): string {
  const at = coordLabel(result.coord);
  if (shooter === 'player') {
    switch (result.kind) {
      case 'miss':
        return `You fired at ${at}: miss.`;
      case 'hit':
        return `You fired at ${at}: hit!`;
      case 'sunk':
        return `You fired at ${at}: hit! You sank the computer's ${shipName(result.ship.type)}.`;
    }
  }
  switch (result.kind) {
    case 'miss':
      return `The computer fired at ${at}: miss.`;
    case 'hit':
      return `The computer fired at ${at}: hit on your ${shipName(result.shipType)}.`;
    case 'sunk':
      return `The computer fired at ${at} and sank your ${shipName(result.ship.type)}.`;
  }
}

export function rejectionMessage(reason: MoveRejection, coord: Coord): string {
  switch (reason) {
    case 'already-fired':
      return `You already fired at ${coordLabel(coord)}. Pick a cell you haven't tried.`;
    case 'not-your-turn':
      return "Hold on, it's the computer's turn.";
    case 'game-over':
      return 'The game is over. Choose Play again to start a new one.';
    case 'wrong-phase':
      return 'Place your fleet and start the battle first.';
    case 'out-of-bounds':
      return 'That cell is off the board.';
  }
}

export function placementMessage(error: PlaceError, type: ShipType | null): string {
  const name = type ? `The ${shipName(type)}` : 'That ship';
  switch (error) {
    case 'none-selected':
      return 'All ships are placed. Select a ship to move it, or start the battle.';
    case 'out-of-bounds':
      return `${name} doesn't fit there because it would go off the board.`;
    case 'overlap':
      return `${name} would overlap another ship.`;
    case 'already-placed':
      return `${name} is already on the board.`;
  }
}

export function turnMessage(state: GameState): string {
  switch (state.phase) {
    case 'placing':
      return 'Place your fleet: choose a ship, then a cell. Press R or Rotate to turn it.';
    case 'over':
      return state.winner === 'player'
        ? 'You win! You sank the whole enemy fleet.'
        : 'You lose. The computer sank your whole fleet.';
    case 'playing':
      return state.turn === 'player'
        ? 'Your turn: fire at a cell in Enemy waters.'
        : "Computer's turn…";
  }
}
