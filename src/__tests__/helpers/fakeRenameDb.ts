// src/__tests__/helpers/fakeRenameDb.ts
//
// In-memory stand-in for the slice of IndexedDB used by DatabaseService.renamePlayer:
// transaction() over `players` and `matchPlayers`, getAll(), index(name).getAll(key),
// put(), delete() and abort(). Requests run one at a time in the order they were made.
// Writes are staged and only become visible through snapshot() when the transaction
// completes; an abort (or a failing put) discards them, like a real rollback.
import type { DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';

type Row = { id: string } & Record<string, unknown>;
type Handler = ((event: unknown) => void) | null;
type StoreName = 'players' | 'matchPlayers';

interface FakeRequest {
  result: unknown;
  error: unknown;
  onsuccess: Handler;
  onerror: Handler;
}

export function createFakeRenameDb(
  seed: { players: DBPlayer[]; matchPlayers: DBMatchPlayer[] },
  options: { failPutOf?: string } = {}
) {
  let committed: Record<StoreName, Map<string, Row>> = {
    players: new Map(seed.players.map(p => [p.id, { ...p } as unknown as Row])),
    matchPlayers: new Map(seed.matchPlayers.map(mp => [mp.id, { ...mp } as unknown as Row])),
  };

  function transaction() {
    const staged: Record<StoreName, Map<string, Row>> = {
      players: new Map(committed.players),
      matchPlayers: new Map(committed.matchPlayers),
    };
    const queue: Array<() => void> = [];
    let state: 'active' | 'aborted' | 'done' = 'active';

    const tx = {
      error: null as unknown,
      oncomplete: null as Handler,
      onabort: null as Handler,
      onerror: null as Handler,
      objectStore: (name: StoreName) => store(name),
      abort: () => {
        if (state !== 'active') return;
        state = 'aborted';
        queue.length = 0;
        setTimeout(() => tx.onabort?.({}));
      },
    };

    function request(run: () => unknown): FakeRequest {
      const req: FakeRequest = { result: undefined, error: null, onsuccess: null, onerror: null };
      queue.push(() => {
        try {
          req.result = run();
          req.onsuccess?.({ target: req });
        } catch (error) {
          req.error = error;
          tx.error = error;
          req.onerror?.({ target: req });
          tx.onerror?.({ target: req });
          tx.abort();
        }
      });
      return req;
    }

    function store(name: StoreName) {
      const rows = staged[name];
      return {
        getAll: () => request(() => [...rows.values()]),
        index: (field: string) => ({
          getAll: (key: string) => request(() => [...rows.values()].filter(row => row[field] === key)),
        }),
        put: (value: Row) => request(() => {
          if (value.id === options.failPutOf) throw new Error(`put failed for ${value.id}`);
          rows.set(value.id, { ...value });
          return value.id;
        }),
        delete: (key: string) => request(() => {
          rows.delete(key);
          return undefined;
        }),
      };
    }

    function pump() {
      if (state !== 'active') return;
      const next = queue.shift();
      if (next) {
        next();
        setTimeout(pump);
        return;
      }
      state = 'done';
      committed = staged;
      tx.oncomplete?.({});
    }

    setTimeout(pump);
    return tx;
  }

  return {
    db: { transaction },
    snapshot: () => ({
      players: [...committed.players.values()] as unknown as DBPlayer[],
      matchPlayers: [...committed.matchPlayers.values()] as unknown as DBMatchPlayer[],
    }),
  };
}
