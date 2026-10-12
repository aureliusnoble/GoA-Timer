// src/__tests__/shared/mergeFill.test.ts
import { describe, it, expect } from 'vitest';
import { fillMissingFields } from '../../shared/utils/mergeFill';

interface Row {
  id: string;
  kills?: number;
  deaths?: number;
  victoryType?: string;
}

describe('fillMissingFields', () => {
  it('fills undefined local fields from the incoming copy', () => {
    const { merged, filledKeys } = fillMissingFields<Row>({ id: 'a' }, { id: 'a', kills: 4, victoryType: 'wave' });
    expect(merged).toEqual({ id: 'a', kills: 4, victoryType: 'wave' });
    expect(filledKeys.sort()).toEqual(['kills', 'victoryType']);
  });

  it('never overwrites a value the local copy already has, including 0', () => {
    const { merged, filledKeys } = fillMissingFields<Row>({ id: 'a', kills: 0 }, { id: 'b', kills: 7 });
    expect(merged).toEqual({ id: 'a', kills: 0 });
    expect(filledKeys).toEqual([]);
  });

  it('treats a legacy null on the local copy as missing', () => {
    const local = { id: 'a', deaths: null } as unknown as Row;
    expect(fillMissingFields<Row>(local, { deaths: 2 }).merged.deaths).toBe(2);
  });

  it('never copies undefined or null from the incoming copy', () => {
    const incoming = { kills: undefined, deaths: null } as unknown as Partial<Row>;
    const { merged, filledKeys } = fillMissingFields<Row>({ id: 'a' }, incoming);
    expect(merged).toEqual({ id: 'a' });
    expect(filledKeys).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const local: Row = { id: 'a' };
    fillMissingFields<Row>(local, { kills: 1 });
    expect(local).toEqual({ id: 'a' });
  });
});
