// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../game/rng';
import { COMPUTER_DELAY_MS, END_SCREEN_DELAY_MS, mountApp } from './app';

// jsdom lacks HTMLDialogElement.showModal/close — stub them to track `open`.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.open = false;
};

function setup(): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  mountApp(root, createRng(7));

  // intro -> placement -> battle
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
  return text.includes('You win!') || text.includes('You lose');
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
    expect(statusText(root)).toContain('You fired at A1');

    vi.advanceTimersByTime(COMPUTER_DELAY_MS);
    expect(statusText(root)).toContain('You fired at A1');
    expect(playerResult.textContent).toMatch(/^You fired at A1/);
    expect(computerResult.textContent).toMatch(/^The computer fired at/);
  });

  it('a rejection note does not replace the last shot result', () => {
    enemyCell(root, 0, 0).click();
    vi.advanceTimersByTime(COMPUTER_DELAY_MS);
    const before = ref(root, 'playerResult').textContent;

    enemyCell(root, 0, 0).click();
    expect(statusText(root)).toContain('You fired at A1');
    expect(ref(root, 'playerResult').textContent).toBe(before);
    expect(ref(root, 'statusTurn').textContent).toContain('You already fired at A1');
  });

  it('pauses before opening the end screen', () => {
    playUntilOver(root);
    expect(isOver(root)).toBe(true);

    const dialog = ref<HTMLDialogElement>(root, 'endDialog');
    expect(dialog.open).toBe(false);
    vi.advanceTimersByTime(END_SCREEN_DELAY_MS - 1);
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
});
