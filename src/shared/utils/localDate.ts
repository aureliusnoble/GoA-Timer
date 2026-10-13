// src/shared/utils/localDate.ts
//
// Local-calendar date helpers for anything the user sees as a calendar day: <input type="date">
// and <input type="time"> values, form defaults, "per day" chart grouping, date-range filters.
//
// Never use `date.toISOString().split('T')[0]` (that is the UTC day) or `new Date('YYYY-MM-DD')`
// (that parses as UTC midnight) for these - both shift the day by one for most of the world.

const pad2 = (n: number): string => String(n).padStart(2, '0');

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

/** Local calendar day of `date` as "YYYY-MM-DD" (the format of <input type="date">). '' if `date` is invalid. */
export function formatLocalDate(date: Date): string {
  if (!isValidDate(date)) return '';
  const year = String(date.getFullYear()).padStart(4, '0');
  return `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local wall-clock time of `date` as "HH:MM", 24h (the format of <input type="time">). '' if `date` is invalid. */
export function formatLocalTime(date: Date): string {
  if (!isValidDate(date)) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Parse "YYYY-MM-DD" plus an optional "HH:MM" / "HH:MM:SS" as LOCAL time.
 * An empty or omitted time means 00:00. Returns null for malformed or impossible input
 * (e.g. "", "2026-02-30", "12/10/2026", "24:00").
 */
export function parseLocalDateTime(dateStr: string, timeStr: string = ''): Date | null {
  const dateMatch = DATE_PATTERN.exec(dateStr.trim());
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  const time = timeStr.trim();
  if (time) {
    const timeMatch = TIME_PATTERN.exec(time);
    if (!timeMatch) return null;
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    seconds = timeMatch[3] ? Number(timeMatch[3]) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
  }

  // Not `new Date(year, ...)`: that maps years 0-99 to 1900-1999, and browsers pass "0002", "0020",
  // "0202" to onChange while a year is being typed into <input type="date">.
  const result = new Date(2000, 0, 1);
  result.setFullYear(year, month - 1, day);
  result.setHours(hours, minutes, seconds, 0);
  // Reject values the Date setters silently roll over (month 13, Feb 30, ...)
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
    return null;
  }
  return result;
}

/** Start (local 00:00:00.000) of the calendar day "YYYY-MM-DD"; null if malformed. */
export function parseLocalDate(dateStr: string): Date | null {
  return parseLocalDateTime(dateStr);
}

/**
 * End (last millisecond, normally local 23:59:59.999) of the calendar day "YYYY-MM-DD"; null if malformed.
 * Computed as the start of the next local day minus 1 ms, so a day whose last hour repeats
 * (DST ending at local midnight) still ends after its second 23:59:59.999.
 */
export function endOfLocalDay(dateStr: string): Date | null {
  const date = parseLocalDate(dateStr);
  if (!date) return null;
  const next = new Date(2000, 0, 1);
  next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return new Date(next.getTime() - 1);
}
