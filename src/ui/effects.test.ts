// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard, placeShip } from '../game/board';
import { effectForShot, FX_LIFETIME_MS } from './effects';
import { createBoardView } from './boardView';

const destroyer = placeShip(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal').ships[0]!;

describe('effectForShot', () => {
  it('maps each result kind to its cells', () => {
    const at = { row: 3, col: 4 };
    expect(effectForShot({ kind: 'miss', coord: at })).toEqual({ kind: 'miss', cells: [at] });
    expect(effectForShot({ kind: 'hit', coord: at, shipType: 'cruiser' })).toEqual({
      kind: 'hit',
      cells: [at],
    });
    expect(effectForShot({ kind: 'sunk', coord: at, ship: destroyer })).toEqual({
      kind: 'sunk',
      cells: destroyer.cells,
    });
  });
});

describe('spawnEffect', () => {
  let view: ReturnType<typeof createBoardView>;
  beforeEach(() => {
    vi.useFakeTimers();
    view = createBoardView({ label: 'test', onActivate: () => {} });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fx(): NodeListOf<HTMLElement> {
    return view.element.querySelectorAll<HTMLElement>('.fx-layer .fx');
  }

  it('adds an .fx element per cell and removes it after FX_LIFETIME_MS', () => {
    view.spawnEffect('miss', [{ row: 1, col: 2 }], true);
    expect(fx()).toHaveLength(1);
    const el = fx()[0]!;
    expect(el.className).toContain('fx--miss');
    expect(el.style.getPropertyValue('--row')).toBe('1');
    expect(el.style.getPropertyValue('--col')).toBe('2');
    expect(el.querySelectorAll('.spark')).toHaveLength(0);

    vi.advanceTimersByTime(FX_LIFETIME_MS - 1);
    expect(fx()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(fx()).toHaveLength(0);
  });

  it('gives a hit six sparks and a sunk shot eight per cell', () => {
    view.spawnEffect('hit', [{ row: 0, col: 0 }], true);
    view.spawnEffect('sunk', destroyer.cells, true);
    const els = Array.from(fx());
    const hit = els.find((e) => e.className.includes('fx--hit'))!;
    const sunk = els.filter((e) => e.className.includes('fx--sunk'));
    expect(hit.querySelectorAll('.spark')).toHaveLength(6);
    expect(sunk).toHaveLength(destroyer.cells.length);
    expect(sunk[0]!.querySelectorAll('.spark')).toHaveLength(8);
  });

  it('adds no sparks when particles is false', () => {
    view.spawnEffect('sunk', destroyer.cells, false);
    for (const el of fx()) {
      expect(el.querySelectorAll('.spark')).toHaveLength(0);
    }
  });
});
