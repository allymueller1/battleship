import { describe, expect, it } from 'vitest';
import { isFleetComplete } from '../game/board';
import { createRng } from '../game/rng';
import {
  initialPlacement,
  nextUnplaced,
  pickUpAt,
  placeSelected,
  previewAt,
  randomizePlacement,
  rotate,
  selectShip,
} from './placement';

describe('initialPlacement', () => {
  it('starts empty, horizontal, with the carrier selected', () => {
    const s = initialPlacement();
    expect(s.board.ships).toHaveLength(0);
    expect(s.orientation).toBe('horizontal');
    expect(s.selected).toBe('carrier');
  });
});

describe('rotate', () => {
  it('toggles orientation', () => {
    const s = rotate(initialPlacement());
    expect(s.orientation).toBe('vertical');
    expect(rotate(s).orientation).toBe('horizontal');
  });
});

describe('placeSelected', () => {
  it('places the selected ship and selects the next unplaced one', () => {
    const { state, error } = placeSelected(initialPlacement(), { row: 0, col: 0 });
    expect(error).toBeNull();
    expect(state.board.ships.map((s) => s.type)).toEqual(['carrier']);
    expect(state.selected).toBe('battleship');
  });

  it('leaves state unchanged and reports why when the ship does not fit', () => {
    const start = initialPlacement();
    const offBoard = placeSelected(start, { row: 0, col: 6 });
    expect(offBoard.error).toBe('out-of-bounds');
    expect(offBoard.state).toBe(start);

    const vertical = rotate(placeSelected(start, { row: 0, col: 0 }).state);
    const overlap = placeSelected(vertical, { row: 0, col: 2 });
    expect(overlap.error).toBe('overlap');
    expect(overlap.state).toBe(vertical);
  });

  it('reports none-selected once every ship is placed', () => {
    let s = initialPlacement();
    for (let row = 0; row < 5; row++) {
      s = placeSelected(s, { row, col: 0 }).state;
    }
    expect(isFleetComplete(s.board)).toBe(true);
    expect(s.selected).toBeNull();
    expect(placeSelected(s, { row: 9, col: 0 }).error).toBe('none-selected');
  });
});

describe('selectShip / pickUpAt', () => {
  it('picks a placed ship back up, keeping its orientation', () => {
    const placed = placeSelected(rotate(initialPlacement()), { row: 0, col: 0 }).state;
    const picked = pickUpAt(placed, { row: 3, col: 0 });
    expect(picked?.board.ships).toHaveLength(0);
    expect(picked?.selected).toBe('carrier');
    expect(picked?.orientation).toBe('vertical');
  });

  it('returns null for an empty cell', () => {
    expect(pickUpAt(initialPlacement(), { row: 5, col: 5 })).toBeNull();
  });

  it('selecting an unplaced ship just selects it', () => {
    const s = selectShip(initialPlacement(), 'destroyer');
    expect(s.selected).toBe('destroyer');
    expect(s.board.ships).toHaveLength(0);
  });
});

describe('randomizePlacement', () => {
  it('places a complete fleet and clears the selection', () => {
    const s = randomizePlacement(initialPlacement(), createRng(7));
    expect(isFleetComplete(s.board)).toBe(true);
    expect(s.selected).toBeNull();
    expect(nextUnplaced(s.board)).toBeNull();
  });
});

describe('previewAt', () => {
  it('returns the covered cells and validity', () => {
    const p = previewAt(initialPlacement(), { row: 2, col: 3 });
    expect(p?.valid).toBe(true);
    expect(p?.cells).toHaveLength(5);
  });

  it('clips off-board cells and marks the preview invalid', () => {
    const p = previewAt(initialPlacement(), { row: 0, col: 8 });
    expect(p?.valid).toBe(false);
    expect(p?.cells).toEqual([
      { row: 0, col: 8 },
      { row: 0, col: 9 },
    ]);
  });

  it('is null without a hovered cell or a selected ship', () => {
    expect(previewAt(initialPlacement(), null)).toBeNull();
    const full = randomizePlacement(initialPlacement(), createRng(1));
    expect(previewAt(full, { row: 0, col: 0 })).toBeNull();
  });
});
