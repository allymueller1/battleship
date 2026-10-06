import { BOARD_SIZE, type Coord } from '../game/types';

export interface CellView {
  readonly classes: readonly string[];
  readonly label: string;
}

export interface BoardViewOptions {
  readonly label: string;
  readonly onActivate: (coord: Coord) => void;
  readonly onHover?: (coord: Coord | null) => void;
}

export interface BoardView {
  readonly element: HTMLElement;
  update(cell: (coord: Coord) => CellView): void;
  setInteractive(interactive: boolean): void;
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
      if (interactive) {
        options.onHover?.(c);
      }
    }
  });

  grid.addEventListener('mouseover', (event) => {
    const c = coordOf(event.target);
    if (c && interactive) {
      options.onHover?.(c);
    }
  });

  grid.addEventListener('mouseleave', () => options.onHover?.(null));
  grid.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && grid.contains(event.relatedTarget))) {
      options.onHover?.(null);
    }
  });

  syncTabIndex();

  return {
    element: grid,
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
