import { describe, expect, it } from 'vitest';
import {
  addScore,
  clearLeaderboard,
  emptyLeaderboard,
  LEADERBOARD_KEY,
  loadLeaderboard,
  localDateString,
  MAX_ENTRIES,
  rankMessage,
  saveLeaderboard,
  type ScoreStore,
} from './leaderboard';

function fakeStore(initial: string | null = null): ScoreStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== null) {
    data.set(LEADERBOARD_KEY, initial);
  }
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('addScore', () => {
  const entry = (strikes: number, date = '2026-10-10') => ({ strikes, date });

  it('keeps entries sorted by fewest strikes', () => {
    let board = emptyLeaderboard();
    for (const strikes of [50, 30, 40]) {
      board = addScore(board, 'normal', entry(strikes)).board;
    }
    expect(board.normal.map((e) => e.strikes)).toEqual([30, 40, 50]);
  });

  it('returns the 1-based rank and inserts after equal strikes', () => {
    const board = addScore(emptyLeaderboard(), 'easy', entry(20, '2026-01-01')).board;
    const { board: next, rank } = addScore(board, 'easy', entry(20, '2026-02-02'));
    expect(rank).toBe(2);
    expect(next.easy.map((e) => e.date)).toEqual(['2026-01-01', '2026-02-02']);
  });

  it('caps each level at the top five and reports null rank past it', () => {
    let board = emptyLeaderboard();
    for (const strikes of [17, 18, 19, 20, 21]) {
      board = addScore(board, 'hard', entry(strikes)).board;
    }
    const { board: next, rank } = addScore(board, 'hard', entry(22));
    expect(rank).toBeNull();
    expect(next.hard).toHaveLength(MAX_ENTRIES);
    expect(next.hard.map((e) => e.strikes)).toEqual([17, 18, 19, 20, 21]);
  });

  it('ranks a better score inside the top five', () => {
    let board = emptyLeaderboard();
    for (const strikes of [17, 18, 19, 20, 21]) {
      board = addScore(board, 'hard', entry(strikes)).board;
    }
    const { board: next, rank } = addScore(board, 'hard', entry(18));
    expect(rank).toBe(3); // ties go after existing entries
    expect(next.hard.map((e) => e.strikes)).toEqual([17, 18, 18, 19, 20]);
  });
});

describe('loadLeaderboard', () => {
  it('returns the empty leaderboard for a null store', () => {
    expect(loadLeaderboard(null)).toEqual(emptyLeaderboard());
  });

  it('returns the empty leaderboard for bad JSON and the wrong shape', () => {
    expect(loadLeaderboard(fakeStore('not json'))).toEqual(emptyLeaderboard());
    expect(loadLeaderboard(fakeStore('"a string"'))).toEqual(emptyLeaderboard());
    expect(loadLeaderboard(fakeStore('{"easy":"nope"}'))).toEqual(emptyLeaderboard());
  });

  it('drops invalid entries and sorts and caps the rest', () => {
    const store = fakeStore(
      JSON.stringify({
        normal: [
          { strikes: 40, date: '2026-01-02' },
          { strikes: 16, date: '2026-01-01' }, // below minimum
          { strikes: 30.5, date: '2026-01-01' }, // not an integer
          { strikes: 30, date: '10 Jan 2026' }, // wrong date format
          { strikes: 30, date: '2026-01-03' },
          'garbage',
          { strikes: 35, date: '2026-01-04' },
          { strikes: 36, date: '2026-01-05' },
          { strikes: 37, date: '2026-01-06' },
          { strikes: 38, date: '2026-01-07' },
        ],
      }),
    );
    expect(loadLeaderboard(store).normal.map((e) => e.strikes)).toEqual([30, 35, 36, 37, 38]);
  });

  it('does not throw when getItem throws', () => {
    const store: ScoreStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadLeaderboard(store)).toEqual(emptyLeaderboard());
  });
});

describe('saveLeaderboard and clearLeaderboard', () => {
  it('round-trips through storage', () => {
    const store = fakeStore();
    const { board } = addScore(emptyLeaderboard(), 'easy', { strikes: 42, date: '2026-10-10' });
    saveLeaderboard(store, board);
    expect(loadLeaderboard(store)).toEqual(board);
  });

  it('clears stored scores', () => {
    const store = fakeStore(JSON.stringify({ easy: [{ strikes: 42, date: '2026-10-10' }] }));
    expect(clearLeaderboard(store)).toBe(true);
    expect(loadLeaderboard(store)).toEqual(emptyLeaderboard());
  });

  it('reports false when removeItem throws and true with no store', () => {
    const store: ScoreStore = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(clearLeaderboard(store)).toBe(false);
    expect(clearLeaderboard(null)).toBe(true);
  });

  it('does not throw when setItem or removeItem throw', () => {
    const store: ScoreStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveLeaderboard(store, emptyLeaderboard())).not.toThrow();
    expect(() => clearLeaderboard(store)).not.toThrow();
  });
});

describe('rankMessage', () => {
  it('celebrates a new best', () => {
    expect(rankMessage(1, 'Cadet')).toBe('New best on Cadet!');
  });

  it('reports other top-five ranks', () => {
    expect(rankMessage(3, 'Admiral')).toBe('#3 on your Admiral leaderboard.');
  });

  it('is empty when the score did not rank', () => {
    expect(rankMessage(null, 'Captain')).toBe('');
  });
});

describe('localDateString', () => {
  it('formats the date in local time, not UTC', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
