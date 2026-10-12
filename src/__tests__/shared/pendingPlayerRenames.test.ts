// src/__tests__/shared/pendingPlayerRenames.test.ts
import { describe, it, expect } from 'vitest';
import {
  appendPendingRename,
  nextPendingRenameFor,
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

  it('keeps the owner of an entry and drops entries with a malformed owner', () => {
    const owned = { ...a, ownerId: 'owner-1' };
    const raw = JSON.stringify([owned, { ...b, ownerId: '' }, { ...b, ownerId: 5 }]);
    expect(parsePendingRenames(raw)).toEqual([owned]);
  });
});

describe('nextPendingRenameFor', () => {
  const mine = { ...b, ownerId: 'owner-1' };
  const theirs = { ...a, ownerId: 'owner-2' };

  it("returns the oldest entry that is the owner's own or was queued while signed out", () => {
    expect(nextPendingRenameFor([theirs, a, mine], 'owner-1')).toEqual(a);
    expect(nextPendingRenameFor([theirs, mine], 'owner-1')).toEqual(mine);
  });

  it("returns nothing when only other accounts' renames are queued", () => {
    expect(nextPendingRenameFor([theirs], 'owner-1')).toBeUndefined();
    expect(nextPendingRenameFor([], 'owner-1')).toBeUndefined();
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
  it('does not remove the same rename queued by another account', () => {
    const theirs = { ...a, ownerId: 'owner-2' };
    expect(removePendingRename([theirs], { ...a, ownerId: 'owner-1' })).toEqual([theirs]);
  });
});
