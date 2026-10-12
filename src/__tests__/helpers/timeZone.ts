// src/__tests__/helpers/timeZone.ts
import { beforeAll, afterAll } from 'vitest';

// The app's tsconfig has no Node typings; declare only the part of `process` used here.
declare const process: { env: Record<string, string | undefined> };

/**
 * Call inside a `describe` block: its tests run with the process time zone set to `timeZone`
 * (an IANA name such as 'America/New_York'); the previous value is restored afterwards.
 * Node re-reads process.env.TZ on assignment and Vitest runs each test file in its own process,
 * so results do not depend on the machine's time zone.
 */
export function withTimeZone(timeZone: string): void {
  let original: string | undefined;
  beforeAll(() => {
    original = process.env.TZ;
    process.env.TZ = timeZone;
  });
  afterAll(() => {
    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  });
}
