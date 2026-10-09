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
