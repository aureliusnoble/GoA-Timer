// src/__tests__/shared/roundStatEditing.test.ts
import { describe, it, expect } from 'vitest';
import { adjustCount, recordKill, undoKill } from '../../shared/utils/roundStatEditing';

const PLAYERS = [
  { id: 1, team: 'titans' },
  { id: 2, team: 'titans' },
  { id: 3, team: 'titans' },
  { id: 4, team: 'atlanteans' },
];

describe('adjustCount', () => {
  it('adds and never goes below 0', () => {
    expect(adjustCount({}, 1, 'assists', 1)).toEqual({ 1: { assists: 1 } });
    expect(adjustCount({ 1: { assists: 0 } }, 1, 'assists', -1)).toEqual({ 1: { assists: 0 } });
  });
});

describe('recordKill / undoKill', () => {
  it('gives every teammate an assist when assists are tracked', () => {
    const { values, events } = recordKill({}, [], PLAYERS, 1, true);
    expect(values).toEqual({ 1: { kills: 1 }, 2: { assists: 1 }, 3: { assists: 1 } });
    expect(events).toEqual([{ killerId: 1, assistIds: [2, 3] }]);
  });

  it('gives no assists when assists are not tracked', () => {
    const { values } = recordKill({}, [], PLAYERS, 4, false);
    expect(values).toEqual({ 4: { kills: 1 } });
  });

  it('"-" removes the kill and exactly the assists that kill granted', () => {
    let state = recordKill({}, [], PLAYERS, 1, true);
    state = recordKill(state.values, state.events, PLAYERS, 2, true);
    state = undoKill(state.values, state.events, 1);
    expect(state.values).toEqual({ 1: { kills: 0, assists: 1 }, 2: { kills: 1, assists: 0 }, 3: { assists: 1 } });
    expect(state.events).toEqual([{ killerId: 2, assistIds: [1, 3] }]);
  });

  it('a pre-filled kill (no event) only loses the kill', () => {
    const state = undoKill({ 1: { kills: 1 }, 2: { assists: 1 } }, [], 1);
    expect(state.values).toEqual({ 1: { kills: 0 }, 2: { assists: 1 } });
  });

  it('does nothing when the player has no kills', () => {
    const before = { 1: { kills: 0 } };
    expect(undoKill(before, [], 1).values).toBe(before);
  });
});
