import { describe, it, expect } from 'vitest';
import {
  formatLocalDate,
  formatLocalTime,
  parseLocalDate,
  parseLocalDateTime,
  endOfLocalDay,
} from '../../../shared/utils/localDate';
import { withTimeZone } from '../../helpers/timeZone';

// UTC-12 .. UTC+14, a half-hour offset, DST zones in both hemispheres.
// januaryOffset = Date#getTimezoneOffset() on 1 Jan 2026 (minutes, positive = behind UTC).
const ZONES = [
  { zone: 'UTC', januaryOffset: 0 },
  { zone: 'America/Los_Angeles', januaryOffset: 480 },
  { zone: 'America/New_York', januaryOffset: 300 },
  { zone: 'Europe/London', januaryOffset: 0 },
  { zone: 'Asia/Kolkata', januaryOffset: -330 },
  { zone: 'Pacific/Auckland', januaryOffset: -780 },
  { zone: 'Pacific/Kiritimati', januaryOffset: -840 },
  { zone: 'Etc/GMT+12', januaryOffset: 720 },
];

describe.each(ZONES)('local date helpers in $zone', ({ zone, januaryOffset }) => {
  withTimeZone(zone);

  it('really runs in the requested zone', () => {
    expect(new Date(2026, 0, 1, 12).getTimezoneOffset()).toBe(januaryOffset);
  });

  it('formats the local calendar day at both ends of the day', () => {
    expect(formatLocalDate(new Date(2026, 9, 12, 0, 0, 0, 0))).toBe('2026-10-12');
    expect(formatLocalDate(new Date(2026, 9, 12, 0, 30))).toBe('2026-10-12');
    expect(formatLocalDate(new Date(2026, 9, 12, 22, 30))).toBe('2026-10-12');
    expect(formatLocalDate(new Date(2026, 9, 12, 23, 59, 59, 999))).toBe('2026-10-12');
    expect(formatLocalDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('formats local time as zero-padded HH:MM', () => {
    expect(formatLocalTime(new Date(2026, 9, 12, 7, 5))).toBe('07:05');
    expect(formatLocalTime(new Date(2026, 9, 12, 22, 30, 59))).toBe('22:30');
    expect(formatLocalTime(new Date(2026, 9, 12, 0, 0))).toBe('00:00');
  });

  it('returns empty strings for invalid dates', () => {
    expect(formatLocalDate(new Date(NaN))).toBe('');
    expect(formatLocalTime(new Date('not a date'))).toBe('');
  });

  it('parses date + time as local wall-clock time', () => {
    expect(parseLocalDateTime('2026-10-12', '22:30')?.getTime()).toBe(new Date(2026, 9, 12, 22, 30).getTime());
    expect(parseLocalDateTime('2026-10-12', '00:30')?.getTime()).toBe(new Date(2026, 9, 12, 0, 30).getTime());
    expect(parseLocalDateTime('2026-10-12', '23:59:59')?.getTime()).toBe(new Date(2026, 9, 12, 23, 59, 59).getTime());
    expect(parseLocalDateTime(' 2026-10-12 ', ' 08:15 ')?.getTime()).toBe(new Date(2026, 9, 12, 8, 15).getTime());
  });

  it('treats a missing or empty time as local midnight', () => {
    const midnight = new Date(2026, 9, 12).getTime();
    expect(parseLocalDateTime('2026-10-12')?.getTime()).toBe(midnight);
    expect(parseLocalDateTime('2026-10-12', '')?.getTime()).toBe(midnight);
    expect(parseLocalDate('2026-10-12')?.getTime()).toBe(midnight);
  });

  it('gives the last millisecond of the local day', () => {
    expect(endOfLocalDay('2026-10-12')?.getTime()).toBe(new Date(2026, 9, 12, 23, 59, 59, 999).getTime());
  });

  it('keeps years 0-99 as typed (a browser passes 0002, 0020, 0202 while a year is being typed)', () => {
    const cases: Array<[string, number]> = [
      ['0002-10-12', 2],
      ['0020-10-12', 20],
      ['0099-01-01', 99],
      ['0202-10-12', 202],
      ['2026-10-12', 2026],
    ];
    for (const [typed, year] of cases) {
      const day = parseLocalDate(typed);
      expect(day).not.toBeNull();
      expect(day!.getFullYear()).toBe(year);
      expect(formatLocalDate(day!)).toBe(typed);

      const withTime = parseLocalDateTime(typed, '22:30');
      expect(withTime).not.toBeNull();
      expect(formatLocalDate(withTime!)).toBe(typed);
      expect(formatLocalTime(withTime!)).toBe('22:30');

      expect(formatLocalDate(endOfLocalDay(typed)!)).toBe(typed);
    }
  });

  it('pads the formatted year to four digits', () => {
    const early = new Date(2000, 0, 1);
    early.setFullYear(7, 2, 4);
    expect(formatLocalDate(early)).toBe('0007-03-04');
  });

  it('rejects malformed or impossible input', () => {
    for (const bad of ['', '2026-10', '12/10/2026', '2026-13-01', '2026-00-10', '2026-02-30', '2026-10-32', 'abcd-ef-gh']) {
      expect(parseLocalDateTime(bad, '10:00')).toBeNull();
      expect(parseLocalDate(bad)).toBeNull();
      expect(endOfLocalDay(bad)).toBeNull();
    }
    for (const badTime of ['24:00', '12:60', '7:5', 'noon', '12:00:60']) {
      expect(parseLocalDateTime('2026-10-12', badTime)).toBeNull();
    }
  });

  it('round-trips instants across a whole year (incl. DST changes) through the input formats', () => {
    const start = new Date(2026, 0, 1).getTime();
    for (let t = start; t < start + 366 * 24 * 3600 * 1000; t += 5 * 3600 * 1000 + 17 * 60 * 1000) {
      const original = new Date(t);
      const parsed = parseLocalDateTime(formatLocalDate(original), formatLocalTime(original));
      expect(parsed).not.toBeNull();
      expect(formatLocalDate(parsed!)).toBe(formatLocalDate(original));
      expect(formatLocalTime(parsed!)).toBe(formatLocalTime(original));
    }
  });
});

describe('day boundaries that UTC-based code gets wrong', () => {
  describe('America/New_York (UTC-4 in October)', () => {
    withTimeZone('America/New_York');

    it('a 22:30 match on Oct 12 is on Oct 12, not Oct 13', () => {
      const match = new Date(Date.UTC(2026, 9, 13, 2, 30)); // 2026-10-12 22:30 local
      expect(formatLocalDate(match)).toBe('2026-10-12');
      expect(formatLocalTime(match)).toBe('22:30');
      expect(parseLocalDateTime('2026-10-12', '22:30')?.toISOString()).toBe('2026-10-13T02:30:00.000Z');
    });

    it('a time inside the spring-forward gap stays on the same day', () => {
      const parsed = parseLocalDateTime('2026-03-08', '02:30');
      expect(parsed).not.toBeNull();
      expect(formatLocalDate(parsed!)).toBe('2026-03-08');
    });
  });

  describe('Asia/Beirut (DST ends at local midnight on 2026-10-25)', () => {
    withTimeZone('Asia/Beirut');

    it('the end of 2026-10-24 is after its repeated 23:00 hour', () => {
      // 00:00 EEST on Oct 25 falls back to 23:00 EET on Oct 24, so 23:xx happens twice that day.
      expect(endOfLocalDay('2026-10-24')?.toISOString()).toBe('2026-10-24T21:59:59.999Z');
      expect(endOfLocalDay('2026-10-24')?.getTime()).toBe(parseLocalDate('2026-10-25')!.getTime() - 1);
    });
  });

  describe('America/Santiago (DST ends at local midnight on 2026-04-05)', () => {
    withTimeZone('America/Santiago');

    it('the end of 2026-04-04 is after its repeated 23:00 hour', () => {
      // 00:00 -03 on Apr 5 falls back to 23:00 -04 on Apr 4.
      expect(endOfLocalDay('2026-04-04')?.toISOString()).toBe('2026-04-05T03:59:59.999Z');
      expect(formatLocalDate(endOfLocalDay('2026-04-04')!)).toBe('2026-04-04');
    });
  });

  describe('Pacific/Auckland (UTC+13 in October)', () => {
    withTimeZone('Pacific/Auckland');

    it('a 00:30 match on Oct 12 is on Oct 12, not Oct 11', () => {
      const match = new Date(Date.UTC(2026, 9, 11, 11, 30)); // 2026-10-12 00:30 local
      expect(formatLocalDate(match)).toBe('2026-10-12');
      expect(parseLocalDate('2026-10-12')?.toISOString()).toBe('2026-10-11T11:00:00.000Z');
    });
  });
});
