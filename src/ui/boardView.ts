import { BOARD_SIZE, type Coord, type Orientation, type ShipType } from '../game/types';
import { shipSvg } from './shipArt';
import { FX_LIFETIME_MS, type EffectKind } from './effects';

export interface CellView {
  readonly classes: readonly string[];
  readonly label: string;
}

export interface DragHandlers {
  canStart(coord: Coord): boolean;
  onStart(coord: Coord): void;
  onMove(coord: Coord | null): void;
  onEnd(coord: Coord | null): void;
  onCancel(): void;
}

export interface BoardViewOptions {
  readonly label: string;
  readonly onActivate: (coord: Coord) => void;
  readonly onHover?: (coord: Coord | null) => void;
  readonly drag?: DragHandlers;
}

export interface ShipSprite {
  readonly type: ShipType;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly length: number;
  readonly state: 'intact' | 'wreck';
}

export interface BoardView {
  readonly element: HTMLElement;
  update(cell: (coord: Coord) => CellView): void;
  setInteractive(interactive: boolean): void;
  setShips(ships: readonly ShipSprite[]): void;
  spawnEffect(kind: EffectKind, cells: readonly Coord[], particles: boolean): void;
  clearEffects(): void;
  /** Drops any in-progress pointer drag without calling its handlers. */
  cancelDrag(): void;
  focus(): void;
}

const COLUMNS = 'ABCDEFGHIJ';

const MOVES: Record<string, (c: Coord) => Coord> = {
  ArrowUp: (c) => ({ row: c.row - 1, col: c.col }),
  ArrowDown: (c) => ({ row: c.row + 1, col: c.col }),
  ArrowLeft: (c) => ({ row: c.row, col: c.col - 1 }),
  ArrowRight: (c) => ({ row: c.row, col: c.col + 1 }),
  Home: (c) => ({ row: c.row, col: 0 }),
  End: (c) => ({ row: c.row, col: BOARD_SIZE - 1 }),
};

function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function clamp(n: number): number {
  return Math.min(BOARD_SIZE - 1, Math.max(0, n));
}

function header(role: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', role);
  el.className = 'board-label';
  el.textContent = text;
  return el;
}

/**
 * A 10x10 ARIA grid of buttons with a roving tabindex: Tab enters the board once,
 * arrow keys / Home / End move between cells, Enter or Space activates.
 */
export function createBoardView(options: BoardViewOptions): BoardView {
  const wrap = document.createElement('div');
  wrap.className = 'board-wrap';
  const grid = document.createElement('div');
  grid.className = 'board';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', options.label);

  const headRow = document.createElement('div');
  headRow.setAttribute('role', 'row');
  headRow.append(header('presentation', ''));
  for (const letter of COLUMNS) {
    headRow.append(header('columnheader', letter));
  }
  grid.append(headRow);

  const buttons: HTMLButtonElement[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const rowEl = document.createElement('div');
    rowEl.setAttribute('role', 'row');
    rowEl.append(header('rowheader', String(row + 1)));
    const rowButtons: HTMLButtonElement[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      cell.append(button);
      rowEl.append(cell);
      rowButtons.push(button);
    }
    grid.append(rowEl);
    buttons.push(rowButtons);
  }

  let active: Coord = { row: 0, col: 0 };
  let interactive = true;

  const buttonAt = (c: Coord): HTMLButtonElement => buttons[c.row]![c.col]!;

  const coordOf = (target: EventTarget | null): Coord | null => {
    if (!(target instanceof HTMLButtonElement) || !grid.contains(target)) {
      return null;
    }
    return { row: Number(target.dataset.row), col: Number(target.dataset.col) };
  };

  const syncTabIndex = (): void => {
    for (const rowButtons of buttons) {
      for (const button of rowButtons) {
        button.tabIndex = -1;
      }
    }
    if (interactive) {
      buttonAt(active).tabIndex = 0;
    }
  };

  grid.addEventListener('click', (event) => {
    const c = coordOf(event.target);
    if (c && interactive) {
      options.onActivate(c);
    }
  });

  grid.addEventListener('keydown', (event) => {
    const c = coordOf(event.target);
    const move = MOVES[event.key];
    if (!c || !move || !interactive) {
      return;
    }
    event.preventDefault();
    const next = move(c);
    active = { row: clamp(next.row), col: clamp(next.col) };
    syncTabIndex();
    buttonAt(active).focus();
  });

  grid.addEventListener('focusin', (event) => {
    const c = coordOf(event.target);
    if (c) {
      active = c;
      syncTabIndex();
      if (
        interactive &&
        event.target instanceof HTMLButtonElement &&
        event.target.matches(':focus-visible')
      ) {
        options.onHover?.(c);
      }
    }
  });

  grid.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') {
      return;
    }
    const c = coordOf(event.target);
    if (c && interactive) {
      options.onHover?.(c);
    }
  });

  grid.addEventListener('pointerleave', () => options.onHover?.(null));
  grid.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && grid.contains(event.relatedTarget))) {
      options.onHover?.(null);
    }
  });

  const shipLayer = document.createElement('div');
  shipLayer.className = 'ship-layer';
  shipLayer.setAttribute('aria-hidden', 'true');
  const fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  fxLayer.setAttribute('aria-hidden', 'true');
  wrap.append(grid, shipLayer, fxLayer);

  let shipKey = '';
  const fxTimers = new Set<ReturnType<typeof setTimeout>>();
  let resetDrag: () => void = () => {};

  if (options.drag) {
    const handlers = options.drag;
    let pointerId: number | null = null;
    let startCell: Coord | null = null;
    let lastCell: Coord | null = null;
    let dragging = false;
    // Set briefly after a drop so the click that ends a drag can't also activate
    // a cell, while a later real tap still can.
    let suppressClick = false;

    grid.addEventListener(
      'click',
      (event) => {
        if (suppressClick) {
          event.stopPropagation();
        }
      },
      { capture: true },
    );

    const cellFromPoint = (x: number, y: number): Coord | null => {
      const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('.cell');
      if (!el || !grid.contains(el)) {
        return null;
      }
      return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
    };

    resetDrag = (): void => {
      pointerId = null;
      startCell = null;
      lastCell = null;
      dragging = false;
      grid.classList.remove('board--dragging');
    };

    grid.addEventListener('pointerdown', (event) => {
      if (!interactive || event.button !== 0 || event.isPrimary === false) {
        return;
      }
      const c = coordOf(event.target);
      if (!c || !handlers.canStart(c)) {
        return;
      }
      pointerId = event.pointerId;
      startCell = c;
      lastCell = c;
    });

    grid.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId || !startCell) {
        return;
      }
      const c = cellFromPoint(event.clientX, event.clientY);
      if (!dragging) {
        if (c && sameCoord(c, startCell)) {
          return;
        }
        dragging = true;
        grid.classList.add('board--dragging');
        grid.setPointerCapture?.(pointerId);
        handlers.onStart(startCell);
        handlers.onMove(c);
        lastCell = c;
        return;
      }
      if ((c === null) !== (lastCell === null) || (c && lastCell && !sameCoord(c, lastCell))) {
        lastCell = c;
        handlers.onMove(c);
      }
    });

    grid.addEventListener('pointerup', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }
      if (dragging) {
        handlers.onEnd(cellFromPoint(event.clientX, event.clientY));
        suppressClick = true;
        // The synthetic click lands in the same input task as this pointerup, so
        // the flag clears only after that click has had its chance to run.
        setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      resetDrag();
    });

    grid.addEventListener('pointercancel', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }
      if (dragging) {
        handlers.onCancel();
      }
      resetDrag();
    });
  }

  syncTabIndex();

  return {
    element: wrap,
    cancelDrag() {
      resetDrag();
    },
    update(cell) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const view = cell({ row, col });
          const button = buttonAt({ row, col });
          const className = ['cell', ...view.classes].join(' ');
          if (button.className !== className) {
            button.className = className;
          }
          if (button.getAttribute('aria-label') !== view.label) {
            button.setAttribute('aria-label', view.label);
          }
        }
      }
    },
    setShips(ships) {
      const key = ships
        .map((s) => `${s.type}:${s.origin.row},${s.origin.col}:${s.orientation}:${s.state}`)
        .join('|');
      if (key === shipKey) {
        return;
      }
      shipKey = key;
      shipLayer.replaceChildren(
        ...ships.map((s) => {
          const el = document.createElement('div');
          el.className = `ship-sprite ship-sprite--${s.type} ship-sprite--${s.state} ship-sprite--${s.orientation}`;
          el.style.setProperty('--row', String(s.origin.row));
          el.style.setProperty('--col', String(s.origin.col));
          el.style.setProperty('--len', String(s.length));
          el.innerHTML = shipSvg(s.type);
          return el;
        }),
      );
    },
    spawnEffect(kind, cells, particles) {
      const sparks = kind === 'hit' ? 6 : kind === 'sunk' ? 8 : 0;
      for (const c of cells) {
        const fx = document.createElement('span');
        fx.className = `fx fx--${kind}`;
        fx.style.setProperty('--row', String(c.row));
        fx.style.setProperty('--col', String(c.col));
        if (particles) {
          for (let k = 0; k < sparks; k++) {
            const spark = document.createElement('i');
            spark.className = 'spark';
            spark.style.setProperty('--i', String(k));
            fx.append(spark);
          }
        }
        fxLayer.append(fx);
        const timer = setTimeout(() => {
          fx.remove();
          fxTimers.delete(timer);
        }, FX_LIFETIME_MS);
        fxTimers.add(timer);
      }
    },
    clearEffects() {
      for (const timer of fxTimers) {
        clearTimeout(timer);
      }
      fxTimers.clear();
      fxLayer.replaceChildren();
    },
    setInteractive(on) {
      interactive = on;
      grid.classList.toggle('board--passive', !on);
      if (on) {
        grid.removeAttribute('aria-disabled');
      } else {
        grid.setAttribute('aria-disabled', 'true');
      }
      syncTabIndex();
    },
    focus() {
      buttonAt(active).focus();
    },
  };
}
