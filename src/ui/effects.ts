import type { Coord, ShotResult } from '../game/types';

export const FX_LIFETIME_MS = 1000;
export const SHAKE_MS = 400;
export const VICTORY_DELAY_MS = 2000;

export type EffectKind = 'miss' | 'hit' | 'sunk';

export interface ShotEffect {
  readonly kind: EffectKind;
  readonly cells: readonly Coord[];
}

/** Which cells get a visual effect for a shot: the sunk ship's cells, or the one cell hit. */
export function effectForShot(result: ShotResult): ShotEffect {
  switch (result.kind) {
    case 'sunk':
      return { kind: 'sunk', cells: result.ship.cells };
    case 'hit':
      return { kind: 'hit', cells: [result.coord] };
    case 'miss':
      return { kind: 'miss', cells: [result.coord] };
  }
}
