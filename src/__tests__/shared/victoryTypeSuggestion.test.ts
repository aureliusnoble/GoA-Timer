// src/__tests__/shared/victoryTypeSuggestion.test.ts
import { describe, it, expect } from 'vitest';
import { suggestVictoryType } from '../../shared/utils/victoryTypeSuggestion';
import { Lane, Team } from '../../types';

const lives = (titans: number, atlanteans: number) => ({ [Team.Titans]: titans, [Team.Atlanteans]: atlanteans });

describe('suggestVictoryType', () => {
  it('suggests kills when the losing team has no lives left', () => {
    expect(suggestVictoryType({ teamLives: lives(3, 0), waves: { [Lane.Single]: { currentWave: 1, totalWaves: 3 } } }, Team.Titans))
      .toEqual({ type: 'kills', reason: 'no-lives' });
  });

  it('kills wins over an exhausted wave counter', () => {
    expect(suggestVictoryType({ teamLives: lives(0, 2), waves: { [Lane.Single]: { currentWave: 3, totalWaves: 3 } } }, Team.Atlanteans))
      .toEqual({ type: 'kills', reason: 'no-lives' });
  });

  it('ignores the WINNING team having no lives', () => {
    expect(suggestVictoryType({ teamLives: lives(0, 2), waves: { [Lane.Single]: { currentWave: 1, totalWaves: 3 } } }, Team.Titans)).toBeUndefined();
  });

  it('suggests wave when the single-lane wave counter is on its last wave', () => {
    expect(suggestVictoryType({ teamLives: lives(2, 2), waves: { [Lane.Single]: { currentWave: 5, totalWaves: 5 } } }, Team.Titans))
      .toEqual({ type: 'wave', reason: 'final-wave' });
  });

  it('suggests wave when either lane of a double-lane game is exhausted', () => {
    expect(suggestVictoryType({
      teamLives: lives(2, 2),
      waves: { [Lane.Top]: { currentWave: 7, totalWaves: 7 }, [Lane.Bottom]: { currentWave: 3, totalWaves: 7 } },
    }, Team.Atlanteans)).toEqual({ type: 'wave', reason: 'final-wave' });
  });

  it('suggests nothing without evidence (throne is never guessed)', () => {
    expect(suggestVictoryType({ teamLives: lives(2, 2), waves: { [Lane.Single]: { currentWave: 2, totalWaves: 3 } } }, Team.Titans)).toBeUndefined();
  });
});
