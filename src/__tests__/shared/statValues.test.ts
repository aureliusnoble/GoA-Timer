// src/__tests__/shared/statValues.test.ts
import { describe, it, expect } from 'vitest';
import { clampHeroLevel, isTrackedStat, isValidHeroLevel } from '../../shared/utils/statValues';
import { HERO_LEVEL_MAX, HERO_LEVEL_MIN } from '../../shared/constants/game';

describe('hero level range', () => {
  it('is 1 to 8 for Guards of Atlantis II', () => {
    expect(HERO_LEVEL_MIN).toBe(1);
    expect(HERO_LEVEL_MAX).toBe(8);
  });
});

describe('isTrackedStat', () => {
  it('treats 0 and other finite numbers as tracked', () => {
    expect(isTrackedStat(0)).toBe(true);
    expect(isTrackedStat(12)).toBe(true);
  });
  it('treats undefined, null and NaN as not tracked', () => {
    expect(isTrackedStat(undefined)).toBe(false);
    expect(isTrackedStat(null)).toBe(false);
    expect(isTrackedStat(Number.NaN)).toBe(false);
  });
});

describe('isValidHeroLevel', () => {
  it('accepts whole levels inside the range', () => {
    expect(isValidHeroLevel(1)).toBe(true);
    expect(isValidHeroLevel(8)).toBe(true);
  });
  it('rejects levels outside the range, fractions and missing values', () => {
    expect(isValidHeroLevel(0)).toBe(false);
    expect(isValidHeroLevel(9)).toBe(false);
    expect(isValidHeroLevel(2.5)).toBe(false);
    expect(isValidHeroLevel(null)).toBe(false);
    expect(isValidHeroLevel(undefined)).toBe(false);
  });
});

describe('clampHeroLevel', () => {
  it('keeps levels inside the range', () => {
    expect(clampHeroLevel(0)).toBe(1);
    expect(clampHeroLevel(5)).toBe(5);
    expect(clampHeroLevel(10)).toBe(8);
  });
});
