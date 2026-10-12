// src/__tests__/services/GameStorageService.rename.test.ts
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

type Handler = ((event: unknown) => void) | null;
type Row = { id: string } & Record<string, unknown>;

// In-memory stand-in for the single 'game-state' store: get() and put() run in
// order after the caller has attached its handlers, then the transaction completes.
let rows = new Map<string, Row>();

const fakeDb = {
  transaction() {
    const queue: Array<() => void> = [];
    const tx = {
      error: null as unknown,
      oncomplete: null as Handler,
      onerror: null as Handler,
      onabort: null as Handler,
      objectStore: () => ({
        get: (key: string) => {
          const request = { result: undefined as unknown, onsuccess: null as Handler };
          queue.push(() => {
            const row = rows.get(key);
            request.result = row ? { ...row } : undefined;
            request.onsuccess?.({ target: request });
          });
          return request;
        },
        put: (value: Row) => {
          queue.push(() => rows.set(value.id, { ...value }));
          return {};
        },
      }),
    };
    const pump = () => {
      const next = queue.shift();
      if (next) {
        next();
        setTimeout(pump);
      } else {
        tx.oncomplete?.({});
      }
    };
    setTimeout(pump);
    return tx;
  },
};

const openRequest: { onsuccess: Handler; onerror: Handler; onupgradeneeded: Handler } = {
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
};

let gameStorageService: typeof import('../../services/GameStorageService').gameStorageService;

beforeAll(async () => {
  vi.stubGlobal('indexedDB', { open: vi.fn(() => openRequest) });
  ({ gameStorageService } = await import('../../services/GameStorageService'));
  openRequest.onsuccess?.({ target: { result: fakeDb } });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const gameState = { round: 2, turn: 3, currentPhase: 'strategy' };

function saveCurrent(playerNames: string[]) {
  rows.set('current', {
    id: 'current',
    gameState,
    players: playerNames.map((name, index) => ({ id: index + 1, name, team: 'titans', hero: null })),
    timestamp: 1234,
    strategyTime: 75,
    moveTime: 25,
    strategyTimeRemaining: 40,
    moveTimeRemaining: 10,
    strategyTimerActive: false,
    moveTimerActive: true,
    strategyTimerEnabled: true,
    moveTimerEnabled: false,
  });
}

describe('gameStorageService.renamePlayerInSavedGame', () => {
  beforeEach(() => {
    rows = new Map();
    vi.restoreAllMocks();
  });

  it('renames the player and keeps every other saved field', async () => {
    saveCurrent(['Jhon', 'Alice']);
    const before = rows.get('current')!;

    await expect(gameStorageService.renamePlayerInSavedGame('Jhon', 'John')).resolves.toBe(true);

    const after = rows.get('current')!;
    expect(after.players).toEqual([
      { id: 1, name: 'John', team: 'titans', hero: null },
      { id: 2, name: 'Alice', team: 'titans', hero: null },
    ]);
    const { players: _beforePlayers, ...restBefore } = before;
    const { players: _afterPlayers, ...restAfter } = after;
    expect(restAfter).toEqual(restBefore);
    expect(restAfter).toMatchObject({ strategyTime: 75, moveTime: 25, timestamp: 1234 });
  });

  it('changes nothing when the player is not in the saved game', async () => {
    saveCurrent(['Alice']);
    const before = rows.get('current');

    await expect(gameStorageService.renamePlayerInSavedGame('Jhon', 'John')).resolves.toBe(false);
    expect(rows.get('current')).toBe(before);
  });

  it('changes nothing when there is no saved game', async () => {
    await expect(gameStorageService.renamePlayerInSavedGame('Jhon', 'John')).resolves.toBe(false);
    expect(rows.size).toBe(0);
  });

  it('never creates two players with one name, and logs instead', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveCurrent(['Jhon', 'John']);
    const before = rows.get('current');

    await expect(gameStorageService.renamePlayerInSavedGame('Jhon', 'John')).resolves.toBe(false);

    expect(rows.get('current')).toBe(before);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
