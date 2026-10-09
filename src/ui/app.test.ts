// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../game/rng';
import { COMPUTER_DELAY_MS, END_SCREEN_DELAY_MS, mountApp, type MountOptions } from './app';
import { SHAKE_MS, VICTORY_DELAY_MS } from './effects';

// jsdom lacks HTMLDialogElement.showModal/close — stub them to track `open`.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.open = false;
};

function setup(options: MountOptions = {}): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  mountApp(root, createRng(7), options);

  // title -> mission select -> placement -> battle
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
  root.querySelector<HTMLButtonElement>('[data-ref="launch"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-ref="introStart"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-ref="randomize"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-ref="start"]')!.click();
  return root;
}

function ref<T extends HTMLElement>(root: HTMLElement, name: string): T {
  return root.querySelector<T>(`[data-ref="${name}"]`)!;
}

function statusText(root: HTMLElement): string {
  return ref(root, 'status').textContent ?? '';
}

function enemyCell(root: HTMLElement, row: number, col: number): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(
    `[data-ref="enemyBoard"] .cell[data-row="${row}"][data-col="${col}"]`,
  )!;
}

function isOver(root: HTMLElement): boolean {
  const text = statusText(root);
  return text.includes('Victory!') || text.includes('Defeat');
}

function endDelay(root: HTMLElement): number {
  return statusText(root).includes('Victory!') ? VICTORY_DELAY_MS : END_SCREEN_DELAY_MS;
}

function playUntilOver(root: HTMLElement): void {
  outer: for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      enemyCell(root, row, col).click();
      if (isOver(root)) {
        break outer;
      }
      vi.advanceTimersByTime(COMPUTER_DELAY_MS);
      if (isOver(root)) {
        break outer;
      }
    }
  }
}

describe('status lines', () => {
  let root: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    root = setup();
  });
  afterEach(() => {
    vi.useRealTimers();
    root.remove();
  });

  it("keeps the player's shot result after the computer answers", () => {
    enemyCell(root, 0, 0).click();
    const playerResult = ref(root, 'playerResult');
    const computerResult = ref(root, 'computerResult');
    expect(statusText(root)).toContain('Your strike at A1');

    vi.advanceTimersByTime(COMPUTER_DELAY_MS);
    expect(statusText(root)).toContain('Your strike at A1');
    expect(playerResult.textContent).toMatch(/^Your strike at A1/);
    expect(computerResult.textContent).toMatch(/^Enemy strike at/);
  });

  it('a rejection note does not replace the last shot result', () => {
    enemyCell(root, 0, 0).click();
    vi.advanceTimersByTime(COMPUTER_DELAY_MS);
    const before = ref(root, 'playerResult').textContent;

    enemyCell(root, 0, 0).click();
    expect(statusText(root)).toContain('Your strike at A1');
    expect(ref(root, 'playerResult').textContent).toBe(before);
    expect(ref(root, 'statusTurn').textContent).toContain('You already struck A1');
  });

  it('pauses before opening the end screen', () => {
    playUntilOver(root);
    expect(isOver(root)).toBe(true);

    const dialog = ref<HTMLDialogElement>(root, 'endDialog');
    expect(dialog.open).toBe(false);
    vi.advanceTimersByTime(endDelay(root) - 1);
    expect(dialog.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(dialog.open).toBe(true);
  });

  it('New game during the end pause keeps the dialog closed', () => {
    playUntilOver(root);
    expect(isOver(root)).toBe(true);

    ref<HTMLButtonElement>(root, 'newGame').click();
    vi.advanceTimersByTime(2000);
    expect(ref<HTMLDialogElement>(root, 'endDialog').open).toBe(false);
    expect(root.dataset.screen).toBe('placing');
  });

  it('a destroyed ship shakes the board, unless reduced motion is on', () => {
    const strikeUntilDestroyed = () => {
      outer: for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          enemyCell(root, row, col).click();
          if (ref(root, 'playerResult').textContent?.includes('destroyed')) {
            break outer;
          }
          vi.advanceTimersByTime(COMPUTER_DELAY_MS);
        }
      }
    };

    strikeUntilDestroyed();
    expect(ref(root, 'playerResult').textContent).toContain('destroyed');
    expect(root.classList.contains('shake')).toBe(true);
    vi.advanceTimersByTime(SHAKE_MS);
    expect(root.classList.contains('shake')).toBe(false);
  });

  it('marks the end of the game with a victory or defeat class', () => {
    playUntilOver(root);
    const won = statusText(root).includes('Victory!');
    expect(root.classList.contains(won ? 'fx-victory' : 'fx-defeat')).toBe(true);

    ref<HTMLButtonElement>(root, 'newGame').click();
    expect(root.classList.contains('fx-victory')).toBe(false);
    expect(root.classList.contains('fx-defeat')).toBe(false);
  });
});

describe('effects with reduced motion', () => {
  it('does not shake on a destroyed ship', () => {
    vi.useFakeTimers();
    const reduced = setup({ reducedMotion: () => true });
    outer: for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        enemyCell(reduced, row, col).click();
        if (ref(reduced, 'playerResult').textContent?.includes('destroyed')) {
          break outer;
        }
        vi.advanceTimersByTime(COMPUTER_DELAY_MS);
      }
    }
    expect(ref(reduced, 'playerResult').textContent).toContain('destroyed');
    expect(reduced.classList.contains('shake')).toBe(false);
    vi.useRealTimers();
    reduced.remove();
  });
});

describe('dragging a placed ship', () => {
  function setupPlacing(): HTMLElement {
    const root = document.createElement('div');
    document.body.append(root);
    mountApp(root, createRng(7));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    root.querySelector<HTMLButtonElement>('[data-ref="launch"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-ref="introStart"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-ref="randomize"]')!.click();
    return root;
  }

  interface C {
    row: number;
    col: number;
  }

  const key = (c: C) => `${c.row},${c.col}`;

  function playerCell(root: HTMLElement, row: number, col: number): HTMLButtonElement {
    return root.querySelector<HTMLButtonElement>(
      `[data-ref="playerBoard"] .cell[data-row="${row}"][data-col="${col}"]`,
    )!;
  }

  interface ShipSprite {
    type: string;
    origin: C;
    horizontal: boolean;
    length: number;
  }

  /** Every placed ship, read from the rendered ship-sprite overlays. */
  function placedShips(root: HTMLElement): ShipSprite[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>('[data-ref="playerBoard"] .ship-sprite'),
    ).map((el) => ({
      type: Array.from(el.classList)
        .find(
          (c) =>
            c.startsWith('ship-sprite--') &&
            c !== 'ship-sprite--horizontal' &&
            c !== 'ship-sprite--vertical',
        )!
        .replace('ship-sprite--', ''),
      origin: {
        row: Number(el.style.getPropertyValue('--row')),
        col: Number(el.style.getPropertyValue('--col')),
      },
      horizontal: el.classList.contains('ship-sprite--horizontal'),
      length: Number(el.style.getPropertyValue('--len')),
    }));
  }

  function spriteCells(ship: ShipSprite, origin: C = ship.origin): C[] {
    return Array.from({ length: ship.length }, (_, i) =>
      ship.horizontal
        ? { row: origin.row, col: origin.col + i }
        : { row: origin.row + i, col: origin.col },
    );
  }

  function pointer(type: string, x: number, y: number): MouseEvent {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    Object.defineProperty(e, 'isPrimary', { value: true });
    return e;
  }

  function dragShip(root: HTMLElement, from: C, to: C): void {
    const grid = root.querySelector('[data-ref="playerBoard"] [role="grid"]')!;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => playerCell(root, to.row, to.col);
    try {
      playerCell(root, from.row, from.col).dispatchEvent(pointer('pointerdown', 0, 0));
      grid.dispatchEvent(pointer('pointermove', 10, 10));
      grid.dispatchEvent(pointer('pointerup', 10, 10));
    } finally {
      document.elementFromPoint = original;
    }
  }

  it('moves a ship to a valid spot and snaps back onto an overlap', () => {
    vi.useFakeTimers();
    const root = setupPlacing();
    try {
      const ship = placedShips(root)[0]!;
      const occupied = new Set(
        placedShips(root)
          .flatMap((s) => spriteCells(s))
          .map(key),
      );

      // Find an empty origin the ship fits at.
      let dest: C | null = null;
      outer: for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const target = spriteCells(ship, { row, col });
          if (target.every((c) => c.row < 10 && c.col < 10 && !occupied.has(key(c)))) {
            dest = { row, col };
            break outer;
          }
        }
      }
      expect(dest).not.toBeNull();

      // Grab the origin cell (grab index 0) and drag it to the new origin.
      dragShip(root, ship.origin, dest!);
      for (const c of spriteCells(ship, dest!)) {
        expect(playerCell(root, c.row, c.col).className).toContain('ship');
      }

      // Drag it onto another ship: it snaps back and a note explains why.
      const moved = placedShips(root).find((s) => s.type === ship.type)!;
      const other = placedShips(root).find((s) => s.type !== ship.type)!;
      dragShip(root, moved.origin, other.origin);
      for (const c of spriteCells(ship, dest!)) {
        expect(playerCell(root, c.row, c.col).className).toContain('ship');
      }
      expect(root.querySelector('[data-ref="statusTurn"]')!.textContent).toContain(
        "didn't fit there, so it went back",
      );
    } finally {
      vi.useRealTimers();
      root.remove();
    }
  });
});

describe('the local leaderboard', () => {
  function fakeStore(initial: string | null = null) {
    const data = new Map<string, string>();
    if (initial !== null) {
      data.set('nebula-strike:leaderboard:v1', initial);
    }
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, String(value)),
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
  }

  function toIntro(root: HTMLElement, store: ReturnType<typeof fakeStore>): void {
    mountApp(root, createRng(7), { storage: store });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    root.querySelector<HTMLButtonElement>('[data-ref="launch"]')!.click();
  }

  it('saves a win and shows its rank in the end screen', () => {
    vi.useFakeTimers();
    const store = fakeStore();
    const root = document.createElement('div');
    document.body.append(root);
    try {
      toIntro(root, store);
      const cadet = root.querySelector<HTMLInputElement>('input[value="easy"]')!;
      cadet.checked = true;
      cadet.dispatchEvent(new Event('change'));
      root.querySelector<HTMLButtonElement>('[data-ref="introStart"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-ref="randomize"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-ref="start"]')!.click();

      // Sweep every enemy cell until the player wins.
      for (let row = 0; row < 10 && !statusText(root).includes('Victory!'); row++) {
        for (let col = 0; col < 10 && !statusText(root).includes('Victory!'); col++) {
          enemyCell(root, row, col).click();
          if (isOver(root)) {
            break;
          }
          vi.advanceTimersByTime(COMPUTER_DELAY_MS);
          if (isOver(root)) {
            break;
          }
        }
      }
      expect(statusText(root)).toContain('Victory!');

      vi.advanceTimersByTime(VICTORY_DELAY_MS);
      const rank = ref(root, 'endRank');
      expect(rank.hidden).toBe(false);
      expect(rank.textContent).toBe('New best on Cadet!');

      const saved = JSON.parse(store.data.get('nebula-strike:leaderboard:v1')!);
      expect(saved.easy).toHaveLength(1);
      expect(saved.easy[0].strikes).toBeGreaterThanOrEqual(17);
      expect(saved.easy[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    } finally {
      vi.useRealTimers();
      root.remove();
    }
  });

  it('renders stored wins per level and "No wins yet" for empty ones', () => {
    vi.useFakeTimers();
    const store = fakeStore(JSON.stringify({ easy: [{ strikes: 25, date: '2026-10-09' }] }));
    const root = document.createElement('div');
    document.body.append(root);
    try {
      toIntro(root, store);
      const levels = Array.from(
        root.querySelectorAll<HTMLElement>('[data-ref="leaderboardLevels"] .leaderboard-level'),
      );
      expect(levels.map((l) => l.querySelector('h3')!.textContent)).toEqual([
        'Cadet',
        'Captain',
        'Admiral',
      ]);
      expect(levels[0]!.querySelector('.lb-strikes')!.textContent).toBe('25 strikes');
      expect(levels[0]!.querySelector('.lb-date')!.textContent).toContain('2026');
      expect(levels[1]!.querySelector('.lb-empty')!.textContent).toBe('No wins yet');
      expect(ref<HTMLButtonElement>(root, 'clearScores').hidden).toBe(false);
    } finally {
      vi.useRealTimers();
      root.remove();
    }
  });

  it('clears all scores after confirmation', () => {
    vi.useFakeTimers();
    const store = fakeStore(JSON.stringify({ easy: [{ strikes: 25, date: '2026-10-09' }] }));
    const root = document.createElement('div');
    document.body.append(root);
    try {
      toIntro(root, store);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      ref<HTMLButtonElement>(root, 'clearScores').click();
      expect(store.data.has('nebula-strike:leaderboard:v1')).toBe(false);
      expect(root.querySelectorAll('.lb-empty')).toHaveLength(3);
      expect(ref<HTMLButtonElement>(root, 'clearScores').hidden).toBe(true);
    } finally {
      vi.useRealTimers();
      root.remove();
    }
  });

  it('shows empty lists for corrupt stored data without throwing', () => {
    vi.useFakeTimers();
    const store = fakeStore('{{{corrupt');
    const root = document.createElement('div');
    document.body.append(root);
    try {
      toIntro(root, store);
      expect(root.querySelectorAll('.lb-empty')).toHaveLength(3);
      expect(ref<HTMLButtonElement>(root, 'clearScores').hidden).toBe(true);
    } finally {
      vi.useRealTimers();
      root.remove();
    }
  });
});
