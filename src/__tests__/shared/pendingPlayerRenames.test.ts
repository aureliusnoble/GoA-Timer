// src/__tests__/shared/pendingPlayerRenames.test.ts
import { describe, it, expect } from 'vitest';
import {
  appendPendingRename,
  parsePendingRenames,
  removePendingRename,
  PendingPlayerRename,
} from '../../shared/utils/pendingPlayerRenames';

const a: PendingPlayerRename = { oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z' };
const b: PendingPlayerRename = { oldId: 'John', newId: 'Johnny', queuedAt: '2026-10-12T10:05:00.000Z' };

describe('parsePendingRenames', () => {
  it('returns an empty queue for missing or corrupt storage', () => {
    expect(parsePendingRenames(null)).toEqual([]);
    expect(parsePendingRenames('not json')).toEqual([]);
    expect(parsePendingRenames('{"oldId":"x"}')).toEqual([]);
  });

  it('keeps valid entries and drops malformed ones', () => {
    const raw = JSON.stringify([a, { oldId: '', newId: 'x', queuedAt: 'y' }, { foo: 1 }, b]);
    expect(parsePendingRenames(raw)).toEqual([a, b]);
  });
});

describe('appendPendingRename', () => {
  it('appends in order', () => {
    expect(appendPendingRename([a], b)).toEqual([a, b]);
  });
  it('ignores a no-op rename', () => {
    expect(appendPendingRename([a], { ...b, newId: b.oldId })).toEqual([a]);
  });
});

describe('removePendingRename', () => {
  it('removes only the matching entry and keeps entries queued later', () => {
    expect(removePendingRename([a, b], a)).toEqual([b]);
  });
  it('leaves the queue alone when the entry is not there', () => {
    expect(removePendingRename([b], a)).toEqual([b]);
  });
});
