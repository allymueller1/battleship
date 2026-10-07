// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../game/rng';
import { COMPUTER_DELAY_MS, mountApp } from './app';

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
});
