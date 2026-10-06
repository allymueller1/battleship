/** Same contract as Math.random: returns a value in [0, 1). */
export type Rng = () => number;

/**
 * Seedable PRNG (mulberry32). The returned function is a stateful closure by
 * design; everything else in the game layer is pure given its outputs.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, maxExclusive). */
export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function pickRandom<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty array');
  }
  return items[randomInt(rng, items.length)]!;
}
