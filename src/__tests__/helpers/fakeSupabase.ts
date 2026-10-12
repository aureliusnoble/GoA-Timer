// src/__tests__/helpers/fakeSupabase.ts
// Minimal stand-in for the Supabase client used by CloudSyncService tests.
// Every from(table) call is recorded; awaiting a query resolves through respondWith().
export type FakeError = { message: string };
export interface FakeResult {
  data?: unknown;
  error: FakeError | null;
}
export interface FakeFilter {
  method: 'eq' | 'neq' | 'in';
  column: string;
  value: unknown;
}
export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  payload?: unknown;
  options?: unknown;
  filters: FakeFilter[];
}
type Responder = (call: FakeCall) => FakeResult;
const defaultResponder: Responder = () => ({ data: [], error: null });

export function createFakeSupabase() {
  let calls: FakeCall[] = [];
  let userId: string | null = 'owner-1';
  let responder: Responder = defaultResponder;

  function from(table: string) {
    const call: FakeCall = { table, op: 'select', filters: [] };
    calls.push(call);
    const builder = {
      select(_columns?: string) { return builder; },
      insert(payload: unknown, options?: unknown) { call.op = 'insert'; call.payload = payload; call.options = options; return builder; },
      upsert(payload: unknown, options?: unknown) { call.op = 'upsert'; call.payload = payload; call.options = options; return builder; },
      update(payload: unknown) { call.op = 'update'; call.payload = payload; return builder; },
      delete() { call.op = 'delete'; return builder; },
      eq(column: string, value: unknown) { call.filters.push({ method: 'eq', column, value }); return builder; },
      neq(column: string, value: unknown) { call.filters.push({ method: 'neq', column, value }); return builder; },
      in(column: string, value: unknown) { call.filters.push({ method: 'in', column, value }); return builder; },
      then<TResult1 = FakeResult, TResult2 = never>(
        onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        return Promise.resolve(responder(call)).then(onfulfilled, onrejected);
      },
    };
    return builder;
  }

  return {
    client: {
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
      from,
    },
    get calls(): FakeCall[] { return calls; },
    callsTo(table: string, op?: FakeCall['op']): FakeCall[] {
      return calls.filter(c => c.table === table && (op === undefined || c.op === op));
    },
    setUser(id: string | null) { userId = id; },
    respondWith(fn: Responder) { responder = fn; },
    reset() { calls = []; userId = 'owner-1'; responder = defaultResponder; },
  };
}

export const fakeSupabase = createFakeSupabase();
