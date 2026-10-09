import { describe, expect, it } from 'vitest';
import { FLEET } from '../game/ships';
import { shipSvg } from './shipArt';
import { shipDisplayName } from './theme';

describe('shipDisplayName', () => {
  it('gives every fleet ship a non-empty, distinct name', () => {
    const names = FLEET.map((spec) => shipDisplayName(spec.type));
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(FLEET.length);
  });
});

describe('shipSvg', () => {
  it('returns an <svg> for each ship type', () => {
    for (const spec of FLEET) {
      expect(shipSvg(spec.type)).toMatch(/^<svg/);
    }
  });
});
