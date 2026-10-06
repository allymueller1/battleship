import { pickRandom, type Rng } from '../rng';
import type { Coord, TargetView } from '../types';
import { untriedCoords } from './view';

/** Picks a uniformly random untried cell — no targeting at all. */
export function chooseEasyShot(view: TargetView, rng: Rng): Coord {
  return pickRandom(rng, untriedCoords(view));
}
