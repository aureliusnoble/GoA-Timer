// src/__tests__/shared/utils/heroIds.test.ts
import { describe, it, expect } from 'vitest';
import { NO_HERO_ID, isRealHeroId, countHeroesPlayed } from '../../../shared/utils/heroIds';

describe('isRealHeroId', () => {
  it('accepts Arien (id 0) and other non-negative integer ids', () => {
    expect(isRealHeroId(0)).toBe(true);
    expect(isRealHeroId(1)).toBe(true);
    expect(isRealHeroId(57)).toBe(true);
  });

  it('rejects the no-hero sentinel, null, undefined and non-integers', () => {
    expect(NO_HERO_ID).toBe(-1);
    expect(isRealHeroId(NO_HERO_ID)).toBe(false);
    expect(isRealHeroId(null)).toBe(false);
    expect(isRealHeroId(undefined)).toBe(false);
    expect(isRealHeroId(Number.NaN)).toBe(false);
    expect(isRealHeroId(1.5)).toBe(false);
  });
});

describe('countHeroesPlayed', () => {
  it('counts Arien (id 0), skips unknown heroes and sorts by count', () => {
    const result = countHeroesPlayed([
      { heroId: 1, heroName: 'Brogan' },
      { heroId: 0, heroName: 'Arien' },
      { heroId: NO_HERO_ID, heroName: 'Unknown Hero' },
      { heroId: 0, heroName: 'Arien' },
      { heroId: undefined, heroName: 'Broken row' },
    ]);
    expect(result).toEqual([
      { heroId: 0, heroName: 'Arien', count: 2 },
      { heroId: 1, heroName: 'Brogan', count: 1 },
    ]);
  });

  it('keeps first-seen order for ties and falls back to "Hero <id>" for a missing name', () => {
    const result = countHeroesPlayed([
      { heroId: 5, heroName: '' },
      { heroId: 0, heroName: 'Arien' },
    ]);
    expect(result).toEqual([
      { heroId: 5, heroName: 'Hero 5', count: 1 },
      { heroId: 0, heroName: 'Arien', count: 1 },
    ]);
  });

  it('returns an empty list when there are no records', () => {
    expect(countHeroesPlayed([])).toEqual([]);
  });
});
