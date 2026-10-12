import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditMatchModal from '../../../components/matches/EditMatchModal';
import { Team, GameLength } from '../../../types';
import { withTimeZone } from '../../helpers/timeZone';

vi.mock('../../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));
const mockDb = vi.hoisted(() => ({
  getEditableMatch: vi.fn(),
  canEditMatch: vi.fn(),
  validateMatchEdit: vi.fn(),
  editMatch: vi.fn(),
}));
vi.mock('../../../services/DatabaseService', () => ({ default: mockDb }));

async function openModal(matchDate: Date) {
  mockDb.getEditableMatch.mockResolvedValue({
    match: {
      id: 'm1',
      date: matchDate,
      winningTeam: Team.Titans,
      gameLength: GameLength.Quick,
      doubleLanes: false,
      titanPlayers: 1,
      atlanteanPlayers: 1,
      victoryType: 'throne',
    },
    players: [
      { id: 'mp1', matchId: 'm1', playerId: 'Alice', playerName: 'Alice', team: Team.Titans, heroId: 1, heroName: 'Brogan', heroRoles: [] },
      { id: 'mp2', matchId: 'm1', playerId: 'Bob', playerName: 'Bob', team: Team.Atlanteans, heroId: 2, heroName: 'Tigerclaw', heroRoles: [] },
    ],
  });
  mockDb.canEditMatch.mockResolvedValue({ canEdit: true });
  mockDb.validateMatchEdit.mockReturnValue({ isValid: true, errors: [], warnings: [] });
  mockDb.editMatch.mockResolvedValue(undefined);

  const { container } = render(
    <EditMatchModal isOpen matchId="m1" onClose={() => {}} onSaveComplete={() => {}} />
  );
  await waitFor(() => expect(container.querySelector('input[type="date"]')).not.toBeNull());
  return {
    dateInput: () => container.querySelector('input[type="date"]') as HTMLInputElement,
    timeInput: () => container.querySelector('input[type="time"]') as HTMLInputElement,
  };
}

async function saveAndGetDate(): Promise<Date> {
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(mockDb.editMatch).toHaveBeenCalledTimes(1));
  return mockDb.editMatch.mock.calls[0][1].date as Date;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('EditMatchModal date/time fields in America/New_York', () => {
  withTimeZone('America/New_York');

  it('shows the local day and time of a late-evening match', async () => {
    const { dateInput, timeInput } = await openModal(new Date(2026, 9, 12, 22, 30));
    expect(dateInput().value).toBe('2026-10-12');
    expect(timeInput().value).toBe('22:30');
  });

  it('editing only the time keeps the day', async () => {
    const { dateInput, timeInput } = await openModal(new Date(2026, 9, 12, 22, 30));
    fireEvent.change(timeInput(), { target: { value: '23:15' } });
    expect(dateInput().value).toBe('2026-10-12');
    expect((await saveAndGetDate()).getTime()).toBe(new Date(2026, 9, 12, 23, 15).getTime());
  });

  it('clearing the date field is ignored instead of saving an invalid date', async () => {
    const { dateInput, timeInput } = await openModal(new Date(2026, 9, 12, 22, 30));
    fireEvent.change(dateInput(), { target: { value: '' } });
    expect(dateInput().value).toBe('2026-10-12');
    expect(timeInput().value).toBe('22:30');
  });

  it('clearing the time field means 00:00 on the same day', async () => {
    const { dateInput, timeInput } = await openModal(new Date(2026, 9, 12, 22, 30));
    fireEvent.change(timeInput(), { target: { value: '' } });
    expect(dateInput().value).toBe('2026-10-12');
    expect(timeInput().value).toBe('00:00');
    expect((await saveAndGetDate()).getTime()).toBe(new Date(2026, 9, 12, 0, 0).getTime());
  });

  it('saving without touching date/time keeps the original timestamp exactly', async () => {
    // 01:30:45.123 EST: the second 01:30 of the DST-end night, with seconds and milliseconds.
    // Re-parsing the displayed "2026-11-01" + "01:30" would lose both and could land on the first 01:30 (EDT).
    const original = new Date('2026-11-01T06:30:45.123Z');
    const { dateInput, timeInput } = await openModal(original);
    expect(dateInput().value).toBe('2026-11-01');
    expect(timeInput().value).toBe('01:30');

    fireEvent.click(screen.getByRole('radio', { name: 'Atlanteans' }));
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(mockDb.editMatch).toHaveBeenCalledTimes(1));

    const matchUpdates = mockDb.editMatch.mock.calls[0][1];
    expect(matchUpdates).toEqual({ winningTeam: Team.Atlanteans });
    expect('date' in matchUpdates).toBe(false);
  });
});

describe('EditMatchModal date/time fields in Pacific/Auckland', () => {
  withTimeZone('Pacific/Auckland');

  it('moving an early-morning match to another day keeps its time', async () => {
    const { dateInput, timeInput } = await openModal(new Date(2026, 9, 12, 0, 30));
    expect(dateInput().value).toBe('2026-10-12');
    fireEvent.change(dateInput(), { target: { value: '2026-10-20' } });
    expect(dateInput().value).toBe('2026-10-20');
    expect(timeInput().value).toBe('00:30');
    expect((await saveAndGetDate()).getTime()).toBe(new Date(2026, 9, 20, 0, 30).getTime());
  });
});
