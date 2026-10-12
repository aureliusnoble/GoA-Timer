// src/__tests__/shared/utils/matchStatDisplay.test.ts
import { describe, it, expect } from 'vitest';
import {
  getTrackedStatKeys,
  formatStatValue,
  formatMatchStatLine,
} from '../../../shared/utils/matchStatDisplay';

describe('getTrackedStatKeys', () => {
  it('returns keys tracked by any player, in display order', () => {
    expect(
      getTrackedStatKeys([
        { level: 5, kills: undefined },
        { minionKills: 0, kills: 2 },
        { goldEarned: null },
      ])
    ).toEqual(['kills', 'minionKills', 'level']);
  });

  it('includes stats whose only values are zero', () => {
    expect(getTrackedStatKeys([{ kills: 0, deaths: 0, assists: 0 }])).toEqual(['kills', 'deaths', 'assists']);
  });

  it('returns an empty list when nothing was tracked', () => {
    expect(getTrackedStatKeys([{}, { kills: null }])).toEqual([]);
  });
});

describe('formatStatValue', () => {
  it('shows zero as 0 and untracked values as an en dash', () => {
    expect(formatStatValue(0)).toBe('0');
    expect(formatStatValue(12)).toBe('12');
    expect(formatStatValue(undefined)).toBe('–');
    expect(formatStatValue(null)).toBe('–');
  });
});

describe('formatMatchStatLine', () => {
  it('lists KDA, minions, gold and level with legitimate zeros', () => {
    expect(
      formatMatchStatLine({ kills: 2, deaths: 0, assists: undefined, minionKills: 0, goldEarned: 9, level: 6 })
    ).toBe('KDA 2/0/– • 0 minions • 9 gold • Level 6');
  });

  it('shows a match with only minion and level data', () => {
    expect(formatMatchStatLine({ minionKills: 14, level: 3 })).toBe('14 minions • Level 3');
  });

  it('returns null when nothing was tracked', () => {
    expect(formatMatchStatLine({ kills: null, goldEarned: undefined })).toBeNull();
  });
});
