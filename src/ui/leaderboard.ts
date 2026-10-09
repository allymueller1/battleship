import type { Difficulty } from '../game/ai';

export const LEADERBOARD_KEY = 'nebula-strike:leaderboard:v1';
export const MAX_ENTRIES = 5;

export interface ScoreEntry {
  readonly strikes: number;
  readonly date: string; // 'YYYY-MM-DD'
}

export type Leaderboard = Readonly<Record<Difficulty, readonly ScoreEntry[]>>;

/** The sliver of Web Storage the leaderboard needs, injectable for tests. */
export type ScoreStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage, or null where it is unavailable or throws (private mode). */
export function browserStore(): ScoreStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function emptyLeaderboard(): Leaderboard {
  return { easy: [], normal: [], hard: [] };
}

function isValidEntry(entry: unknown): entry is ScoreEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const { strikes, date } = entry as Record<string, unknown>;
  return (
    Number.isInteger(strikes) &&
    (strikes as number) >= 17 &&
    (strikes as number) <= 100 &&
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
  );
}

/** Reads stored scores, tolerating absent or corrupt data. Never throws. */
export function loadLeaderboard(store: ScoreStore | null): Leaderboard {
  const board = { easy: [] as ScoreEntry[], normal: [] as ScoreEntry[], hard: [] as ScoreEntry[] };
  if (!store) {
    return board;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(store.getItem(LEADERBOARD_KEY) ?? 'null');
  } catch {
    return board;
  }
  if (typeof raw !== 'object' || raw === null) {
    return board;
  }
  for (const level of Object.keys(board) as Difficulty[]) {
    const entries = (raw as Record<string, unknown>)[level];
    if (!Array.isArray(entries)) {
      continue;
    }
    board[level] = entries
      .filter(isValidEntry)
      .sort((a, b) => a.strikes - b.strikes)
      .slice(0, MAX_ENTRIES);
  }
  return board;
}

/**
 * Adds a score sorted by fewest strikes, after any entries with equal strikes.
 * Returns the kept leaderboard and the 1-based rank, or null when the entry
 * didn't make the top five.
 */
export function addScore(
  board: Leaderboard,
  level: Difficulty,
  entry: ScoreEntry,
): { board: Leaderboard; rank: number | null } {
  const entries = [...board[level]];
  let index = entries.length;
  while (index > 0 && entries[index - 1]!.strikes > entry.strikes) {
    index -= 1;
  }
  entries.splice(index, 0, entry);
  const kept = entries.slice(0, MAX_ENTRIES);
  return {
    board: { ...board, [level]: kept },
    rank: index < MAX_ENTRIES ? index + 1 : null,
  };
}

/** Persists the leaderboard; storage failures are ignored. */
export function saveLeaderboard(store: ScoreStore | null, board: Leaderboard): void {
  try {
    store?.setItem(LEADERBOARD_KEY, JSON.stringify(board));
  } catch {
    // Ignore quota and security errors: scores are nice-to-have.
  }
}

/** Wipes stored scores; storage failures are ignored. */
export function clearLeaderboard(store: ScoreStore | null): void {
  try {
    store?.removeItem(LEADERBOARD_KEY);
  } catch {
    // As above.
  }
}

/** The end-screen line for a saved score, or '' when it earned none. */
export function rankMessage(rank: number | null, name: string): string {
  if (rank === null) {
    return '';
  }
  return rank === 1 ? `New best on ${name}!` : `#${rank} on your ${name} leaderboard.`;
}
