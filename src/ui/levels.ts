import type { Difficulty } from '../game/ai';

export interface LevelInfo {
  readonly level: Difficulty;
  readonly name: string;
  readonly description: string;
  readonly averageShots: number;
}

export const LEVELS: readonly LevelInfo[] = [
  {
    level: 'easy',
    name: 'Easy',
    description: 'Fires at random and finds your ships by luck.',
    averageShots: 96,
  },
  {
    level: 'normal',
    name: 'Normal',
    description:
      'Plays like a sensible human. Sweeps the board in a checkerboard pattern, then hunts down any ship it hits.',
    averageShots: 52,
  },
  {
    level: 'hard',
    name: 'Hard',
    description: 'Calculates where your ships most likely are before every shot.',
    averageShots: 43,
  },
];

export function levelName(level: Difficulty): string {
  return LEVELS.find((l) => l.level === level)?.name ?? level;
}
