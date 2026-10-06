import { describe, expect, it } from 'vitest';
import { placeShip, createBoard } from '../game/board';
import { createGame } from '../game/game';
import { createRng } from '../game/rng';
import {
  coordLabel,
  placementMessage,
  rejectionMessage,
  shotMessage,
  turnMessage,
} from './messages';

const destroyer = placeShip(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal').ships[0]!;

describe('coordLabel', () => {
  it('uses a column letter and a 1-based row', () => {
    expect(coordLabel({ row: 0, col: 0 })).toBe('A1');
    expect(coordLabel({ row: 4, col: 1 })).toBe('B5');
    expect(coordLabel({ row: 9, col: 9 })).toBe('J10');
  });
});

describe('shotMessage', () => {
  const at = { row: 0, col: 1 };

  it('describes player shots without revealing which ship was hit', () => {
    expect(shotMessage('player', { kind: 'miss', coord: at })).toBe('You fired at B1: miss.');
    expect(shotMessage('player', { kind: 'hit', coord: at, shipType: 'cruiser' })).toBe(
      'You fired at B1: hit!',
    );
    expect(shotMessage('player', { kind: 'sunk', coord: at, ship: destroyer })).toBe(
      "You fired at B1: hit! You sank the computer's Destroyer.",
    );
  });

  it('names the player ship the computer hit or sank', () => {
    expect(shotMessage('computer', { kind: 'miss', coord: at })).toBe(
      'The computer fired at B1: miss.',
    );
    expect(shotMessage('computer', { kind: 'hit', coord: at, shipType: 'cruiser' })).toBe(
      'The computer fired at B1: hit on your Cruiser.',
    );
    expect(shotMessage('computer', { kind: 'sunk', coord: at, ship: destroyer })).toBe(
      'The computer fired at B1 and sank your Destroyer.',
    );
  });
});

describe('rejectionMessage', () => {
  it('explains every rejection reason', () => {
    const c = { row: 2, col: 2 };
    expect(rejectionMessage('already-fired', c)).toMatch(/already fired at C3/);
    expect(rejectionMessage('not-your-turn', c)).toMatch(/computer's turn/);
    expect(rejectionMessage('game-over', c)).toMatch(/Play again/);
    expect(rejectionMessage('wrong-phase', c)).toMatch(/start the battle/);
    expect(rejectionMessage('out-of-bounds', c)).toMatch(/off the board/);
  });
});

describe('placementMessage', () => {
  it('names the ship and the problem', () => {
    expect(placementMessage('out-of-bounds', 'carrier')).toMatch(/Carrier .*off the board/);
    expect(placementMessage('overlap', 'cruiser')).toMatch(/Cruiser would overlap/);
    expect(placementMessage('already-placed', 'destroyer')).toMatch(/already on the board/);
    expect(placementMessage('none-selected', null)).toMatch(/All ships are placed/);
  });
});

describe('turnMessage', () => {
  const base = createGame(createRng(1));

  it('covers each phase and turn', () => {
    expect(turnMessage(base)).toMatch(/Place your fleet/);
    expect(turnMessage({ ...base, phase: 'playing', turn: 'player' })).toMatch(/Your turn/);
    expect(turnMessage({ ...base, phase: 'playing', turn: 'computer' })).toMatch(/Computer's turn/);
    expect(turnMessage({ ...base, phase: 'over', winner: 'player' })).toMatch(/You win/);
    expect(turnMessage({ ...base, phase: 'over', winner: 'computer' })).toMatch(/You lose/);
  });
});
