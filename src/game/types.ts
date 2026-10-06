export const BOARD_SIZE = 10;

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export type Orientation = 'horizontal' | 'vertical';

export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface ShipSpec {
  readonly type: ShipType;
  readonly name: string;
  readonly length: number;
}

export interface PlacedShip {
  readonly type: ShipType;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly cells: readonly Coord[];
}

export type ShotMark = 'hit' | 'miss';

export interface Board {
  readonly ships: readonly PlacedShip[];
  readonly shots: ReadonlyMap<string, ShotMark>;
}

export type ShotResult =
  | { readonly kind: 'miss'; readonly coord: Coord }
  | { readonly kind: 'hit'; readonly coord: Coord; readonly shipType: ShipType }
  | { readonly kind: 'sunk'; readonly coord: Coord; readonly ship: PlacedShip };

/** What a shooter legitimately knows about the enemy board (no hidden ship positions). */
export interface TargetView {
  readonly shots: ReadonlyMap<string, ShotMark>;
  readonly sunkShips: readonly PlacedShip[];
  readonly remainingShips: readonly ShipSpec[];
}
