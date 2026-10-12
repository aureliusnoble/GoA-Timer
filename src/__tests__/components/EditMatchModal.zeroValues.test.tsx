// src/__tests__/components/EditMatchModal.zeroValues.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerEditCard } from '../../components/matches/EditMatchModal';
import { Team } from '../../types';

// EditMatchModal imports these at module level; mock them so the real
// DatabaseService (and its Supabase client) never loads.
vi.mock('../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));
vi.mock('../../services/DatabaseService', () => ({ default: {} }));

const noIssues = { isValid: true, errors: [], warnings: [] };

describe('PlayerEditCard', () => {
  it('shows a recorded zero as 0 and an untracked stat as an empty field', () => {
    render(
      <PlayerEditCard
        player={{
          id: 'mp1',
          matchId: 'm1',
          playerId: 'Alice',
          playerName: 'Alice',
          team: Team.Titans,
          heroId: 0,
          heroName: 'Arien',
          heroRoles: [],
          kills: 0,
          deaths: 3,
          assists: undefined,
        }}
        onHeroChange={() => {}}
        onFieldChange={() => {}}
        validation={noIssues}
      />
    );
    fireEvent.click(screen.getByText('Show Stats'));

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    // Order: kills, deaths, assists, gold, minions, level
    expect(inputs[0].value).toBe('0');
    expect(inputs[1].value).toBe('3');
    expect(inputs[2].value).toBe('');
  });
});
