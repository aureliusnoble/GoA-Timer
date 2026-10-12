import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import RecordMatch from '../../../components/matches/RecordMatch';
import { withTimeZone } from '../../helpers/timeZone';

vi.mock('../../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));
vi.mock('../../../services/DatabaseService', () => ({
  default: {
    getAllPlayers: vi.fn().mockResolvedValue([]),
    recordMatch: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Render the form with "now" frozen at `instant`; return the default date and time fields. */
async function renderAt(instant: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(instant);
  const { container } = render(<RecordMatch onBack={() => {}} />);
  await act(async () => {});
  return {
    date: (container.querySelector('input[type="date"]') as HTMLInputElement).value,
    time: (container.querySelector('input[type="time"]') as HTMLInputElement).value,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RecordMatch default date in America/New_York', () => {
  withTimeZone('America/New_York');

  it('late in the evening defaults to today, not tomorrow', async () => {
    expect(await renderAt(new Date('2026-10-13T02:30:00Z'))).toEqual({ date: '2026-10-12', time: '22:30' });
  });
});

describe('RecordMatch default date in Pacific/Auckland', () => {
  withTimeZone('Pacific/Auckland');

  it('just after midnight defaults to today, not yesterday', async () => {
    expect(await renderAt(new Date('2026-10-11T11:30:00Z'))).toEqual({ date: '2026-10-12', time: '00:30' });
  });
});
