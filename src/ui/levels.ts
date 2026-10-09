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
    name: 'Cadet',
    description: 'Fires at random and finds you by luck.',
    averageShots: 96,
  },
  {
    level: 'normal',
    name: 'Captain',
    description: 'Sweeps the sector, then hunts down any ship it hits.',
    averageShots: 52,
  },
  {
    level: 'hard',
    name: 'Admiral',
    description: 'Calculates where your ships most likely are before every strike.',
    averageShots: 43,
  },
];

export function levelName(level: Difficulty): string {
  return LEVELS.find((l) => l.level === level)?.name ?? level;
}
