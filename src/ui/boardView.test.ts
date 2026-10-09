// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FX_LIFETIME_MS } from './effects';
import { createBoardView, type ShipSprite } from './boardView';

const sprite = (over: Partial<ShipSprite> = {}): ShipSprite => ({
  type: 'destroyer',
  origin: { row: 1, col: 2 },
  orientation: 'horizontal',
  length: 2,
  state: 'intact',
  ...over,
});

describe('setShips', () => {
  it('renders one sprite per ship inside .ship-layer, outside the grid', () => {
    const view = createBoardView({ label: 'test', onActivate: () => {} });
    view.setShips([sprite(), sprite({ type: 'carrier', length: 5, state: 'wreck' })]);

    const layer = view.element.querySelector('.ship-layer')!;
    const sprites = layer.querySelectorAll('.ship-sprite');
    expect(sprites).toHaveLength(2);
    expect(view.element.querySelector('[role="grid"] .ship-sprite')).toBeNull();

    const first = sprites[0] as HTMLElement;
    expect(first.className).toContain('ship-sprite--destroyer');
    expect(first.className).toContain('ship-sprite--horizontal');
    expect(first.className).toContain('ship-sprite--intact');
    expect(first.style.getPropertyValue('--row')).toBe('1');
    expect(first.style.getPropertyValue('--col')).toBe('2');
    expect(first.style.getPropertyValue('--len')).toBe('2');
    expect(first.querySelector('svg.ship-art')).not.toBeNull();

    const wreck = sprites[1] as HTMLElement;
    expect(wreck.className).toContain('ship-sprite--carrier');
    expect(wreck.className).toContain('ship-sprite--wreck');
  });

  it('rebuilds only when a sprite key changes', () => {
    const view = createBoardView({ label: 'test', onActivate: () => {} });
    view.setShips([sprite()]);
    const first = view.element.querySelector('.ship-sprite')!;

    view.setShips([sprite()]);
    expect(view.element.querySelector('.ship-sprite')).toBe(first);

    view.setShips([sprite({ state: 'wreck' })]);
    expect(view.element.querySelector('.ship-sprite')).not.toBe(first);
  });
});

describe('clearEffects', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forgets effect timers once they fire', () => {
    vi.useFakeTimers();
    const view = createBoardView({ label: 'test', onActivate: () => {} });
    for (let i = 0; i < 3; i++) {
      view.spawnEffect('miss', [{ row: i, col: i }], false);
    }

    vi.advanceTimersByTime(FX_LIFETIME_MS);
    expect(view.element.querySelectorAll('.fx-layer .fx')).toHaveLength(0);

    const spy = vi.spyOn(globalThis, 'clearTimeout');
    view.clearEffects();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('drag', () => {
  function makeView(canStart: (c: { row: number; col: number }) => boolean) {
    const calls: string[] = [];
    const view = createBoardView({
      label: 'test',
      onActivate: (c) => calls.push(`activate ${c.row},${c.col}`),
      drag: {
        canStart,
        onStart: (c) => calls.push(`start ${c.row},${c.col}`),
        onMove: (c) => calls.push(`move ${c ? `${c.row},${c.col}` : 'null'}`),
        onEnd: (c) => calls.push(`end ${c ? `${c.row},${c.col}` : 'null'}`),
        onCancel: () => calls.push('cancel'),
      },
    });
    document.body.append(view.element);
    return { view, calls };
  }

  function cell(view: { element: HTMLElement }, row: number, col: number): HTMLElement {
    return view.element.querySelector<HTMLElement>(`.cell[data-row="${row}"][data-col="${col}"]`)!;
  }

  function pointer(type: string, x: number, y: number): MouseEvent {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    Object.defineProperty(e, 'isPrimary', { value: true });
    return e;
  }

  let pointCell: HTMLElement | null = null;
  let originalFromPoint: typeof document.elementFromPoint;

  function stubFromPoint() {
    originalFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => pointCell;
  }

  function restoreFromPoint() {
    document.elementFromPoint = originalFromPoint;
  }

  it('drags a ship cell to another cell and swallows the click', () => {
    const { view, calls } = makeView((c) => c.row === 0 && c.col === 0);
    stubFromPoint();
    try {
      const start = cell(view, 0, 0);
      const dest = cell(view, 0, 3);
      const grid = view.element.querySelector('[role="grid"]')!;
      start.dispatchEvent(pointer('pointerdown', 5, 5));
      pointCell = dest;
      grid.dispatchEvent(pointer('pointermove', 60, 5));
      grid.dispatchEvent(pointer('pointerup', 60, 5));
      dest.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(calls).toEqual(['start 0,0', 'move 0,3', 'end 0,3']);
    } finally {
      restoreFromPoint();
      view.element.remove();
    }
  });

  it("a drag that fires no click doesn't swallow the next click", async () => {
    const { view, calls } = makeView((c) => c.row === 0 && c.col === 0);
    stubFromPoint();
    try {
      const start = cell(view, 0, 0);
      const dest = cell(view, 0, 3);
      const grid = view.element.querySelector('[role="grid"]')!;
      start.dispatchEvent(pointer('pointerdown', 5, 5));
      pointCell = dest;
      grid.dispatchEvent(pointer('pointermove', 60, 5));
      grid.dispatchEvent(pointer('pointerup', 60, 5));
      // Touch drags never fire a click; the suppression window must close on its own.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const next = cell(view, 0, 4);
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(calls).toContain('activate 0,4');
    } finally {
      restoreFromPoint();
      view.element.remove();
    }
  });

  it('a press and release on the same cell is just a click', () => {
    const { view, calls } = makeView(() => true);
    stubFromPoint();
    try {
      const start = cell(view, 1, 1);
      pointCell = start;
      const grid = view.element.querySelector('[role="grid"]')!;
      start.dispatchEvent(pointer('pointerdown', 5, 5));
      grid.dispatchEvent(pointer('pointerup', 5, 5));
      start.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(calls).toEqual(['activate 1,1']);
    } finally {
      restoreFromPoint();
      view.element.remove();
    }
  });

  it('pointercancel mid-drag cancels', () => {
    const { view, calls } = makeView(() => true);
    stubFromPoint();
    try {
      cell(view, 0, 0).dispatchEvent(pointer('pointerdown', 5, 5));
      pointCell = cell(view, 2, 2);
      const grid = view.element.querySelector('[role="grid"]')!;
      grid.dispatchEvent(pointer('pointermove', 40, 40));
      grid.dispatchEvent(pointer('pointercancel', 40, 40));

      expect(calls).toEqual(['start 0,0', 'move 2,2', 'cancel']);
    } finally {
      restoreFromPoint();
      view.element.remove();
    }
  });

  it('does nothing when canStart is false', () => {
    const { view, calls } = makeView(() => false);
    stubFromPoint();
    try {
      cell(view, 0, 0).dispatchEvent(pointer('pointerdown', 5, 5));
      pointCell = cell(view, 2, 2);
      const grid = view.element.querySelector('[role="grid"]')!;
      grid.dispatchEvent(pointer('pointermove', 40, 40));
      grid.dispatchEvent(pointer('pointerup', 40, 40));

      expect(calls).toEqual([]);
    } finally {
      restoreFromPoint();
      view.element.remove();
    }
  });
});
