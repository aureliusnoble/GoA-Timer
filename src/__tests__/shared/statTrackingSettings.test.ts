// src/__tests__/shared/statTrackingSettings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseStatTrackingSettings,
  serializeStatTrackingSettings,
  loadStatTrackingSettings,
  saveStatTrackingSettings,
  defaultStatTrackingSettings,
  getCategoriesInUse,
  isStatTrackingInUse,
  STAT_TRACKING_STORAGE_KEY,
  StatTrackingSettings,
} from '../../shared/utils/statTrackingSettings';
import { commitRound, createEmptyStatLog } from '../../shared/utils/gameStatLog';

const KILLS_ON: StatTrackingSettings = {
  enabled: true,
  categories: { kills: true, deaths: false, assists: false, goldEarned: false, minionKills: false, level: false },
};

describe('parse / serialize', () => {
  it('round-trips settings', () => {
    expect(parseStatTrackingSettings(serializeStatTrackingSettings(KILLS_ON))).toEqual(KILLS_ON);
  });

  it('falls back to all-off for missing or malformed data', () => {
    expect(parseStatTrackingSettings(null)).toEqual(defaultStatTrackingSettings());
    expect(parseStatTrackingSettings('not json')).toEqual(defaultStatTrackingSettings());
    expect(parseStatTrackingSettings('42')).toEqual(defaultStatTrackingSettings());
  });

  it('ignores unknown keys and non-boolean values', () => {
    const parsed = parseStatTrackingSettings('{"enabled":"yes","categories":{"kills":true,"deaths":1,"bogus":true}}');
    expect(parsed.enabled).toBe(false);
    expect(parsed.categories.kills).toBe(true);
    expect(parsed.categories.deaths).toBe(false);
    expect('bogus' in parsed.categories).toBe(false);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => localStorage.clear());

  it('saves and loads under the goa-stat-tracking key', () => {
    saveStatTrackingSettings(KILLS_ON);
    expect(localStorage.getItem(STAT_TRACKING_STORAGE_KEY)).not.toBeNull();
    expect(loadStatTrackingSettings()).toEqual(KILLS_ON);
  });

  it('loads defaults when nothing is stored', () => {
    expect(loadStatTrackingSettings()).toEqual(defaultStatTrackingSettings());
  });
});

describe('categories in use', () => {
  it('uses the switched-on categories only while logging is on', () => {
    expect(getCategoriesInUse(createEmptyStatLog(), KILLS_ON).kills).toBe(true);
    expect(getCategoriesInUse(createEmptyStatLog(), { ...KILLS_ON, enabled: false }).kills).toBe(false);
  });

  it('adds categories that already have values in the round log', () => {
    const log = commitRound(createEmptyStatLog(), 1, { 1: { deaths: 0 } });
    const inUse = getCategoriesInUse(log, defaultStatTrackingSettings());
    expect(inUse.deaths).toBe(true);
    expect(inUse.kills).toBe(false);
    expect(isStatTrackingInUse(log, defaultStatTrackingSettings())).toBe(true);
    expect(isStatTrackingInUse(createEmptyStatLog(), defaultStatTrackingSettings())).toBe(false);
  });
});
