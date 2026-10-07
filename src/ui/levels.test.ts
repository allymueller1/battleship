import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../game/ai';
import { LEVELS, levelName } from './levels';

describe('LEVELS', () => {
  it('lists every difficulty exactly once, in the same order', () => {
    expect(LEVELS.map((l) => l.level)).toEqual(DIFFICULTIES);
  });

  it('has strictly decreasing average shots', () => {
    const shots = LEVELS.map((l) => l.averageShots);
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]!).toBeLessThan(shots[i - 1]!);
    }
  });
});

describe('levelName', () => {
  it('names each difficulty', () => {
    expect(levelName('easy')).toBe('Easy');
    expect(levelName('normal')).toBe('Normal');
    expect(levelName('hard')).toBe('Hard');
  });
});
