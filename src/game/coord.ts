import { BOARD_SIZE, type Coord } from './types';

export function coordKey(c: Coord): string {
  return `${c.row},${c.col}`;
}

export function isInBounds(c: Coord): boolean {
  return c.row >= 0 && c.row < BOARD_SIZE && c.col >= 0 && c.col < BOARD_SIZE;
}

/** Every board cell in row-major order (100 cells). */
export function allCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      coords.push({ row, col });
    }
  }
  return coords;
}

/** Orthogonal neighbors, in-bounds only, ordered up, down, left, right. */
export function neighbors(c: Coord): Coord[] {
  const candidates: Coord[] = [
    { row: c.row - 1, col: c.col },
    { row: c.row + 1, col: c.col },
    { row: c.row, col: c.col - 1 },
    { row: c.row, col: c.col + 1 },
  ];
  return candidates.filter(isInBounds);
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}
