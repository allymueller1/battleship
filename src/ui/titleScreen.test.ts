// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../game/rng';
import { mountApp } from './app';
import { BRIEFING_LINES, briefingDuration } from './titleScreen';

function setup(reducedMotion?: () => boolean): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  mountApp(root, createRng(7), reducedMotion ? { reducedMotion } : {});
  return root;
}

function ref<T extends HTMLElement>(root: HTMLElement, name: string): T {
  return root.querySelector<T>(`[data-ref="${name}"]`)!;
}

function briefingText(root: HTMLElement): string {
  return Array.from(root.querySelectorAll('.briefing-line'))
    .map((el) => el.textContent)
    .join(' ');
}

describe('title screen briefing', () => {
  let root: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    root?.remove();
  });

  it('finishes in under five seconds', () => {
    expect(briefingDuration()).toBeLessThan(5000);
  });

  it('types out every line, then reveals and focuses Launch', () => {
    root = setup();
    const launch = ref<HTMLButtonElement>(root, 'launch');
    expect(launch.hidden).toBe(true);

    vi.advanceTimersByTime(briefingDuration());
    expect(briefingText(root)).toBe(BRIEFING_LINES.join(' '));
    expect(launch.hidden).toBe(false);
    expect(document.activeElement).toBe(launch);
  });

  it('a keydown mid-typing shows every line at once', () => {
    root = setup();
    vi.advanceTimersByTime(500);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(briefingText(root)).toBe(BRIEFING_LINES.join(' '));
    expect(ref<HTMLButtonElement>(root, 'launch').hidden).toBe(false);
  });

  it('a click mid-typing does the same', () => {
    root = setup();
    vi.advanceTimersByTime(500);
    ref(root, 'title').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(briefingText(root)).toBe(BRIEFING_LINES.join(' '));
    expect(ref<HTMLButtonElement>(root, 'launch').hidden).toBe(false);
  });

  it('is done immediately with reduced motion', () => {
    root = setup(() => true);
    expect(briefingText(root)).toBe(BRIEFING_LINES.join(' '));
    expect(ref<HTMLButtonElement>(root, 'launch').hidden).toBe(false);
  });

  it('Launch shows the mission select', () => {
    root = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    ref<HTMLButtonElement>(root, 'launch').click();
    expect(root.dataset.screen).toBe('intro');
    expect(ref(root, 'intro').hidden).toBe(false);
    expect(ref(root, 'title').hidden).toBe(true);
  });
});
