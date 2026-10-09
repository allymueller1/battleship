import { describe, expect, it } from 'vitest';
import { placeShip, createBoard } from '../game/board';
import { createGame, type GameState } from '../game/game';
import { createRng } from '../game/rng';
import { fireShot } from '../game/shots';
import {
  coordLabel,
  endSummary,
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
    expect(shotMessage('player', { kind: 'miss', coord: at })).toBe('Your strike at B1: miss.');
    expect(shotMessage('player', { kind: 'hit', coord: at, shipType: 'cruiser' })).toBe(
      'Your strike at B1: hit!',
    );
    expect(shotMessage('player', { kind: 'sunk', coord: at, ship: destroyer })).toBe(
      'Your strike at B1: hit! You destroyed the enemy Scout.',
    );
  });

  it('names the player ship the computer hit or sank', () => {
    expect(shotMessage('computer', { kind: 'miss', coord: at })).toBe('Enemy strike at B1: miss.');
    expect(shotMessage('computer', { kind: 'hit', coord: at, shipType: 'cruiser' })).toBe(
      'Enemy strike at B1: hit on your Frigate.',
    );
    expect(shotMessage('computer', { kind: 'sunk', coord: at, ship: destroyer })).toBe(
      'Enemy strike at B1 destroyed your Scout.',
    );
  });
});

describe('rejectionMessage', () => {
  it('explains every rejection reason', () => {
    const c = { row: 2, col: 2 };
    expect(rejectionMessage('already-fired', c)).toMatch(/already struck C3/);
    expect(rejectionMessage('not-your-turn', c)).toMatch(/enemy is firing/);
    expect(rejectionMessage('game-over', c)).toMatch(/Play again/);
    expect(rejectionMessage('wrong-phase', c)).toMatch(/start the battle/);
    expect(rejectionMessage('out-of-bounds', c)).toMatch(/off the grid/);
  });
});

describe('placementMessage', () => {
  it('names the ship and the problem', () => {
    expect(placementMessage('out-of-bounds', 'carrier')).toMatch(/Mothership .*off the grid/);
    expect(placementMessage('overlap', 'cruiser')).toMatch(/Frigate would overlap/);
    expect(placementMessage('already-placed', 'destroyer')).toMatch(/already on the board/);
    expect(placementMessage('none-selected', null)).toMatch(/All ships are placed/);
  });
});

describe('endSummary', () => {
  const winnerState = (winner: 'player' | 'computer'): GameState => {
    const computerBoard = [
      { row: 0, col: 0 }, // hit — destroyer
      { row: 0, col: 1 }, // hit — destroyer sunk
      { row: 4, col: 4 }, // miss
    ].reduce(
      (b, c) => fireShot(b, c).board,
      placeShip(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal'),
    );
    const playerBoard = [
      { row: 1, col: 1 }, // miss
      { row: 3, col: 3 }, // hit — carrier
    ].reduce(
      (b, c) => fireShot(b, c).board,
      placeShip(createBoard(), 'carrier', { row: 3, col: 3 }, 'horizontal'),
    );
    return { phase: 'over', turn: 'player', winner, playerBoard, computerBoard };
  };

  it('summarises a player win with exact stats', () => {
    const summary = endSummary(winnerState('player'), 'Captain');
    expect(summary.won).toBe(true);
    expect(summary.title).toBe('Victory!');
    expect(summary.text).toBe('You destroyed the enemy fleet in 3 strikes on Captain.');
    expect(summary.player).toEqual({ shots: 3, hits: 2 });
    expect(summary.computer).toEqual({ shots: 2, hits: 1 });
  });

  it('summarises a computer win', () => {
    const summary = endSummary(winnerState('computer'), 'Admiral');
    expect(summary.won).toBe(false);
    expect(summary.title).toBe('Defeat');
    expect(summary.text).toBe('The enemy destroyed your fleet in 2 strikes on Admiral.');
  });

  it('throws while the game is not over', () => {
    expect(() => endSummary(createGame(createRng(1)), 'Cadet')).toThrow(/phase/);
  });
});

describe('turnMessage', () => {
  const base = createGame(createRng(1));

  it('covers each phase and turn', () => {
    expect(turnMessage(base)).toMatch(/Deploy your fleet/);
    expect(turnMessage({ ...base, phase: 'playing', turn: 'player' })).toMatch(/Your turn/);
    expect(turnMessage({ ...base, phase: 'playing', turn: 'computer' })).toMatch(/Enemy's turn/);
    expect(turnMessage({ ...base, phase: 'over', winner: 'player' })).toMatch(/Victory/);
    expect(turnMessage({ ...base, phase: 'over', winner: 'computer' })).toMatch(/Defeat/);
  });
});
