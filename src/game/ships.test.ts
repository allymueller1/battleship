import { describe, expect, it } from 'vitest';
import { FLEET, getShipSpec } from './ships';

describe('FLEET', () => {
  it('lists the five classic ships in order with lengths totaling 17', () => {
    expect(FLEET.map((s) => s.type)).toEqual([
      'carrier',
      'battleship',
      'cruiser',
      'submarine',
      'destroyer',
    ]);
    expect(FLEET.map((s) => s.length)).toEqual([5, 4, 3, 3, 2]);
    expect(FLEET.reduce((sum, s) => sum + s.length, 0)).toBe(17);
  });
});

describe('getShipSpec', () => {
  it('returns the spec for each fleet type', () => {
    for (const spec of FLEET) {
      expect(getShipSpec(spec.type)).toBe(spec);
    }
  });

  it('throws for an unknown type', () => {
    // @ts-expect-error deliberately invalid type
    expect(() => getShipSpec('dinghy')).toThrow();
  });
});
