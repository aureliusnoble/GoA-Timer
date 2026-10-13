// src/__tests__/components/VictoryScreen.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const { recordMatch } = vi.hoisted(() => ({ recordMatch: vi.fn() }));
vi.mock('../../services/DatabaseService', () => ({ default: { recordMatch } }));

import VictoryScreen from '../../components/VictoryScreen';
import { GameLength, Hero, Player, Team } from '../../types';
import { commitRound, createEmptyStatLog, GameStatLog } from '../../shared/utils/gameStatLog';
import { defaultStatTrackingSettings } from '../../shared/utils/statTrackingSettings';

const hero = (id: number, name: string): Hero => ({
  id, name, icon: '', complexity: 1, roles: ['Tank'], expansion: 'base', description: '',
});

const PLAYERS: Player[] = [
  { id: 1, team: Team.Titans, hero: hero(10, 'Arien'), name: 'Ann' },
  { id: 2, team: Team.Atlanteans, hero: hero(12, 'Tigerclaw'), name: 'Cat' },
];

type Props = React.ComponentProps<typeof VictoryScreen>;

function renderVictory(overrides: Partial<Props> = {}) {
  const props: Props = {
    winningTeam: Team.Titans,
    onReturnToSetup: vi.fn(),
    players: PLAYERS,
    gameLength: GameLength.Quick,
    doubleLanes: false,
    statLog: createEmptyStatLog(),
    finalRound: 3,
    finalRoundReviewed: false,
    statTrackingActive: false,
    trackingSettings: defaultStatTrackingSettings(),
    onUpdatePlayerStats: vi.fn(),
    onSaveRoundDraft: vi.fn(),
    onMatchSaved: vi.fn(),
    ...overrides,
  };
  const utils = render(<VictoryScreen {...props} />);
  // buttons appear after the 3 s victory animation
  act(() => { vi.advanceTimersByTime(3000); });
  return { props, ...utils };
}

async function clickAndFlush(element: HTMLElement) {
  await act(async () => { fireEvent.click(element); });
}

beforeEach(() => {
  vi.useFakeTimers();
  recordMatch.mockReset();
  recordMatch.mockResolvedValue('match-1');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VictoryScreen final-round stats (4.1)', () => {
  it('closing the final-round assistant with X does not count as recorded', () => {
    const { props } = renderVictory();
    fireEvent.click(screen.getByText('Record Final Round Stats'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Final round statistics recorded')).toBeNull();
    expect(screen.getByText('Record Final Round Stats')).toBeTruthy();
    expect(props.onUpdatePlayerStats).not.toHaveBeenCalled();
  });

  it('X keeps entered values as a draft for the final round', () => {
    const { props } = renderVictory({
      trackingSettings: { enabled: true, categories: { ...defaultStatTrackingSettings().categories, kills: true } },
    });
    fireEvent.click(screen.getByText('Record Final Round Stats'));
    fireEvent.click(screen.getAllByText('Got Kill')[0]);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onSaveRoundDraft).toHaveBeenCalledWith(3, { 1: { kills: 1 }, 2: { kills: 0 } });
  });

  it('category changes in the final-round assistant are saved for that round only (4.2)', () => {
    const { props } = renderVictory({
      trackingSettings: { enabled: true, categories: { ...defaultStatTrackingSettings().categories, kills: true } },
    });
    fireEvent.click(screen.getByText('Record Final Round Stats'));
    fireEvent.click(screen.getByRole('button', { name: 'Deaths' }));
    fireEvent.click(screen.getByText('Save Final Round Stats'));
    expect(props.onUpdatePlayerStats).toHaveBeenCalledWith(3, {
      1: { kills: 0, deaths: 0 },
      2: { kills: 0, deaths: 0 },
    });
  });

  it('hides "Record Final Round Stats" once the match is saved', async () => {
    const { props } = renderVictory();
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved Successfully')).toBeTruthy();
    expect(screen.queryByText('Record Final Round Stats')).toBeNull();
    expect(props.onMatchSaved).toHaveBeenCalledTimes(1);
  });

  it('asks before saving when tracking was on and the final round is unrecorded', async () => {
    renderVictory({ statTrackingActive: true });
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch).not.toHaveBeenCalled();
    expect(screen.getByText('Final round stats not recorded')).toBeTruthy();
    await clickAndFlush(screen.getByText('Save Without Them'));
    expect(recordMatch).toHaveBeenCalledTimes(1);
  });

  it('"Record Final Round" from the prompt opens the final-round assistant', async () => {
    renderVictory({ statTrackingActive: true });
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    fireEvent.click(screen.getByText('Record Final Round'));
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.queryByText('Final round stats not recorded')).toBeNull();
  });

  it('opens the assistant in final-round mode with the categories in use this game (4.2)', () => {
    // kills switched on now; deaths only logged in an earlier round
    const statLog = commitRound(createEmptyStatLog(), 2, { 1: { deaths: 1 }, 2: { deaths: 0 } });
    const { props } = renderVictory({
      statLog,
      trackingSettings: { enabled: true, categories: { ...defaultStatTrackingSettings().categories, kills: true } },
    });
    fireEvent.click(screen.getByText('Record Final Round Stats'));
    expect(screen.getByText('Final Round Stats')).toBeTruthy();
    expect(screen.queryByText('End of Round Checklist')).toBeNull();
    fireEvent.click(screen.getByText('Save Final Round Stats'));
    expect(props.onUpdatePlayerStats).toHaveBeenCalledWith(3, {
      1: { kills: 0, deaths: 0 },
      2: { kills: 0, deaths: 0 },
    });
  });

  it('does not ask when the final round was recorded', async () => {
    renderVictory({ statTrackingActive: true, finalRoundReviewed: true });
    expect(screen.getByText('Final round statistics recorded')).toBeTruthy();
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch).toHaveBeenCalledTimes(1);
  });
});

describe('VictoryScreen keeps the finished game until saved (4.1)', () => {
  it('does not report the match as saved when saving fails', async () => {
    recordMatch.mockRejectedValueOnce(new Error('boom'));
    const { props } = renderVictory();
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(props.onMatchSaved).not.toHaveBeenCalled();
    expect(screen.getByText('Failed to save match data. Please try again.')).toBeTruthy();
    expect(screen.getByText('Record Final Round Stats')).toBeTruthy();
  });
});

describe('VictoryScreen victory type pre-select (4.6)', () => {
  it('saves the suggested type without the user picking one', async () => {
    renderVictory({ suggestedVictoryType: 'kills' });
    expect(screen.getByText('Pre-selected from the game state — change it if needed.')).toBeTruthy();
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch.mock.calls[0][0].victoryType).toBe('kills');
  });

  it('the user can still change it', async () => {
    renderVictory({ suggestedVictoryType: 'kills' });
    fireEvent.click(screen.getByText('Wave'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch.mock.calls[0][0].victoryType).toBe('wave');
  });

  it('still requires a choice when nothing is suggested', async () => {
    renderVictory();
    await clickAndFlush(screen.getByText('Save Match Data'));
    expect(recordMatch).not.toHaveBeenCalled();
    expect(screen.getByText('Please select how the match was won')).toBeTruthy();
  });
});

describe('VictoryScreen saves the round log (4.4 / 4.7)', () => {
  it('passes explicit-zero totals and roundStats to recordMatch', async () => {
    let statLog: GameStatLog = commitRound(createEmptyStatLog(), 1, { 1: { kills: 0 }, 2: { kills: 2 } });
    statLog = commitRound(statLog, 2, { 1: { kills: 1 }, 2: { kills: 0 } });
    const players = PLAYERS.map(p => ({ ...p, stats: { totalKills: p.id === 1 ? 1 : 2 } }));
    renderVictory({ statLog, players });
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    const playerData = recordMatch.mock.calls[0][1];
    expect(playerData[0]).toMatchObject({ id: 'Ann', kills: 1, roundStats: [{ round: 1, kills: 0 }, { round: 2, kills: 1 }] });
    expect(playerData[1]).toMatchObject({ id: 'Cat', kills: 2, roundStats: [{ round: 1, kills: 2 }, { round: 2, kills: 0 }] });
  });

  it('saves no round log for an untracked game', async () => {
    const statLog = commitRound(createEmptyStatLog(), 3, { 1: {}, 2: {} });
    renderVictory({ statLog });
    fireEvent.click(screen.getByText('Throne'));
    await clickAndFlush(screen.getByText('Save Match Data'));
    const playerData = recordMatch.mock.calls[0][1];
    expect(playerData[0].roundStats).toBeUndefined();
    expect(playerData[1].roundStats).toBeUndefined();
  });
});
