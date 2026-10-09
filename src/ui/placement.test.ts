import { describe, expect, it } from 'vitest';
import { isFleetComplete, placeShip, shipAt } from '../game/board';
import { createRng } from '../game/rng';
import {
  dragOrigin,
  dropDrag,
  initialPlacement,
  nextUnplaced,
  placeSelected,
  previewAt,
  randomizePlacement,
  rotate,
  selectShip,
  startDrag,
  type Drag,
  type PlacementState,
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

describe('selectShip', () => {
  it('selecting an unplaced ship just selects it', () => {
    const s = selectShip(initialPlacement(), 'destroyer');
    expect(s.selected).toBe('destroyer');
    expect(s.board.ships).toHaveLength(0);
  });

  it('selecting a placed ship restores its orientation', () => {
    let state = rotate(initialPlacement());
    state = placeSelected(state, { row: 0, col: 0 }).state; // carrier, vertical
    state = rotate(state); // orientation is now horizontal
    state = selectShip(state, 'carrier');
    expect(state.orientation).toBe('vertical');
    expect(previewAt(state, { row: 0, col: 0 })?.valid).toBe(true);
  });

  it('selecting an unplaced ship keeps the current orientation', () => {
    const state = selectShip(rotate(initialPlacement()), 'destroyer');
    expect(state.orientation).toBe('vertical');
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

describe('startDrag', () => {
  const placed = (): PlacementState => placeSelected(initialPlacement(), { row: 0, col: 0 }).state;

  it('returns null on an empty cell', () => {
    expect(startDrag(placed(), { row: 5, col: 5 })).toBeNull();
  });

  it('picks up the ship and remembers the grabbed cell', () => {
    const s = placed();
    const out = startDrag(s, { row: 0, col: 2 });
    expect(out).not.toBeNull();
    const { state, drag } = out!;
    expect(state.board.ships).toHaveLength(0);
    expect(state.selected).toBe('carrier');
    expect(drag).toEqual({
      type: 'carrier',
      from: { row: 0, col: 0 },
      orientation: 'horizontal',
      grab: 2,
    });
  });
});

describe('dragOrigin', () => {
  const drag: Drag = {
    type: 'carrier',
    from: { row: 0, col: 0 },
    orientation: 'horizontal',
    grab: 2,
  };

  it('keeps the grabbed cell under the pointer, horizontal', () => {
    expect(dragOrigin(drag, { row: 4, col: 6 }, 'horizontal')).toEqual({ row: 4, col: 4 });
  });

  it('keeps the grabbed cell under the pointer, vertical', () => {
    expect(dragOrigin({ ...drag, grab: 1 }, { row: 6, col: 3 }, 'vertical')).toEqual({
      row: 5,
      col: 3,
    });
  });
});

describe('dropDrag', () => {
  const setUp = () => {
    const s = placeSelected(initialPlacement(), { row: 0, col: 0 }).state;
    const out = startDrag(s, { row: 0, col: 2 })!;
    return { state: out.state, drag: out.drag };
  };

  it('places the ship at a valid new origin', () => {
    const { state, drag } = setUp();
    const dropped = dropDrag(state, drag, { row: 4, col: 4 });
    expect(dropped.snappedBack).toBe(false);
    expect(dropped.state.board.ships[0]!.origin).toEqual({ row: 4, col: 4 });
    expect(dropped.state.selected).toBe(nextUnplaced(dropped.state.board));
  });

  it('snaps back onto an overlap', () => {
    const { state, drag } = setUp();
    const withBattleship = placeShip(state.board, 'battleship', { row: 4, col: 0 }, 'vertical');
    const dropped = dropDrag({ ...state, board: withBattleship }, drag, { row: 4, col: 0 });
    expect(dropped.snappedBack).toBe(true);
    const ship = dropped.state.board.ships.find((s) => s.type === 'carrier')!;
    expect(ship.origin).toEqual({ row: 0, col: 0 });
    expect(ship.orientation).toBe('horizontal');
    expect(dropped.state.orientation).toBe('horizontal');
    expect(dropped.state.selected).toBe(nextUnplaced(dropped.state.board));
  });

  it('snaps back when partly off the board', () => {
    const { state, drag } = setUp();
    const dropped = dropDrag(state, drag, { row: 0, col: 8 });
    expect(dropped.snappedBack).toBe(true);
    expect(dropped.state.board.ships[0]!.origin).toEqual({ row: 0, col: 0 });
  });

  it('snaps back on a null drop', () => {
    const { state, drag } = setUp();
    const dropped = dropDrag(state, drag, null);
    expect(dropped.snappedBack).toBe(true);
    expect(dropped.state.board.ships[0]!.origin).toEqual({ row: 0, col: 0 });
  });
});

describe('dropDrag defensive cases', () => {
  const setUp = () => {
    const s = placeSelected(initialPlacement(), { row: 0, col: 0 }).state;
    const out = startDrag(s, { row: 0, col: 2 })!;
    return { state: out.state, drag: out.drag };
  };

  it('does nothing when the ship is already back on the board', () => {
    const { state, drag } = setUp();
    // Simulate the ship being re-placed by another path while the drag was live.
    const board = placeShip(state.board, drag.type, { row: 5, col: 5 }, 'vertical');
    const busy = { ...state, board };
    const dropped = dropDrag(busy, drag, { row: 7, col: 0 });
    expect(dropped.snappedBack).toBe(false);
    expect(dropped.state).toBe(busy);
  });

  it('leaves the ship unplaced and selected when the snap-back spot is blocked', () => {
    const { state, drag } = setUp();
    // Another ship now occupies the drag's original cells.
    const board = placeShip(state.board, 'destroyer', { row: 0, col: 0 }, 'horizontal');
    const dropped = dropDrag({ ...state, board }, drag, null);
    expect(dropped.snappedBack).toBe(true);
    expect(shipAt(dropped.state.board, { row: 0, col: 0 })?.type).toBe('destroyer');
    expect(dropped.state.board.ships.find((s) => s.type === 'carrier')).toBeUndefined();
    expect(dropped.state.selected).toBe('carrier');
  });
});
