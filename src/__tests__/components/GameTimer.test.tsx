// src/__tests__/components/GameTimer.test.tsx
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GameTimer from '../../components/GameTimer';
import { GameLength, GameState, Hero, Lane, Player, Team } from '../../types';
import { applyStatChanges, createEmptyStatLog, GameStatLog } from '../../shared/utils/gameStatLog';
import { StatTrackingSettings, defaultStatTrackingSettings } from '../../shared/utils/statTrackingSettings';

const hero = (id: number, name: string): Hero => ({
  id, name, icon: '', complexity: 1, roles: [], expansion: 'base', description: '',
});

const PLAYERS: Player[] = [
  { id: 1, team: Team.Titans, hero: hero(10, 'Arien'), name: 'Ann' },
  { id: 2, team: Team.Titans, hero: hero(11, 'Brogan'), name: 'Bob' },
  { id: 3, team: Team.Atlanteans, hero: hero(12, 'Tigerclaw'), name: 'Cat' },
];

const gameState = (overrides: Partial<GameState> = {}): GameState => ({
  round: 2,
  turn: 2,
  gameLength: GameLength.Quick,
  waves: { [Lane.Single]: { currentWave: 1, totalWaves: 3 } },
  teamLives: { [Team.Titans]: 4, [Team.Atlanteans]: 4 },
  currentPhase: 'move',
  activeHeroIndex: -1,
  coinSide: Team.Titans,
  hasMultipleLanes: false,
  completedTurns: [],
  allPlayersMoved: false,
  ...overrides,
});

const tracking = (categories: Partial<StatTrackingSettings['categories']>, enabled = true): StatTrackingSettings => ({
  enabled,
  categories: { ...defaultStatTrackingSettings().categories, ...categories },
});

type Props = React.ComponentProps<typeof GameTimer>;

function renderTimer(overrides: Partial<Props> = {}) {
  const props: Props = {
    gameState: gameState(),
    players: PLAYERS,
    strategyTimeRemaining: 90,
    moveTimeRemaining: 30,
    strategyTimerActive: false,
    moveTimerActive: false,
    strategyTimerEnabled: true,
    moveTimerEnabled: true,
    onStartStrategyTimer: vi.fn(),
    onPauseStrategyTimer: vi.fn(),
    onResetStrategyTimer: vi.fn(),
    onEndStrategyPhase: vi.fn(),
    onStartMoveTimer: vi.fn(),
    onPauseMoveTimer: vi.fn(),
    onResetMoveTimer: vi.fn(),
    onSelectPlayer: vi.fn(),
    onCompletePlayerTurn: vi.fn(),
    onStartNextTurn: vi.fn(),
    onAdjustTeamLife: vi.fn(),
    onIncrementWave: vi.fn(),
    onDecrementWave: vi.fn(),
    onAdjustRound: vi.fn(),
    onAdjustTurn: vi.fn(),
    onDeclareVictory: vi.fn(),
    onFlipCoin: vi.fn(),
    statLog: createEmptyStatLog(),
    onSavePlayerStats: vi.fn(),
    onSaveRoundDraft: vi.fn(),
    trackingSettings: defaultStatTrackingSettings(),
    onTrackingSettingsChange: vi.fn(),
    onLiveStatChanges: vi.fn(),
    ...overrides,
  };
  const utils = render(<GameTimer {...props} />);
  return { props, ...utils };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('GameTimer end-of-round X (4.5)', () => {
  it('closing the assistant keeps the draft and does not start the next round', () => {
    const { props } = renderTimer({
      gameState: gameState({ turn: 4, currentPhase: 'turn-end' }),
      trackingSettings: tracking({ deaths: true }),
    });
    fireEvent.click(screen.getByText('End Round'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onStartNextTurn).not.toHaveBeenCalled();
    expect(props.onSaveRoundDraft).toHaveBeenCalledWith(2, { 1: { deaths: 0 }, 2: { deaths: 0 }, 3: { deaths: 0 } });
    expect(screen.getByText('End Round')).toBeTruthy();
  });

  it('saving the review commits the round and starts the next one', () => {
    const { props } = renderTimer({
      gameState: gameState({ turn: 4, currentPhase: 'turn-end' }),
      trackingSettings: tracking({ deaths: true }),
    });
    fireEvent.click(screen.getByText('End Round'));
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onSavePlayerStats).toHaveBeenCalledWith(2, { 1: { deaths: 0 }, 2: { deaths: 0 }, 3: { deaths: 0 } });
    expect(props.onStartNextTurn).toHaveBeenCalledTimes(1);
  });
});

describe('GameTimer live stat tracking (4.8)', () => {
  it('shows no quick-log when tracking is off', () => {
    renderTimer();
    expect(screen.queryByLabelText('Add kill for Arien')).toBeNull();
    expect(screen.getByText('Track stats')).toBeTruthy();
  });

  it('a chip logs +1 for this round without selecting the player', () => {
    const { props } = renderTimer({ trackingSettings: tracking({ minionKills: true }) });
    fireEvent.click(screen.getByLabelText('Add minion kill for Tigerclaw'));
    expect(props.onLiveStatChanges).toHaveBeenCalledWith(2, [{ playerId: 3, stat: 'minionKills', delta: 1 }]);
    expect(props.onSelectPlayer).not.toHaveBeenCalled();
  });

  it('a kill chip also gives teammates an assist when assists are tracked', () => {
    const { props } = renderTimer({ trackingSettings: tracking({ kills: true, assists: true }) });
    fireEvent.click(screen.getByLabelText('Add kill for Arien'));
    expect(props.onLiveStatChanges).toHaveBeenCalledWith(2, [
      { playerId: 1, stat: 'kills', delta: 1 },
      { playerId: 2, stat: 'assists', delta: 1 },
    ]);
  });

  it('chips show this round\'s tallies', () => {
    const statLog: GameStatLog = applyStatChanges(createEmptyStatLog(), 2, [{ playerId: 3, stat: 'deaths', delta: 2 }]);
    renderTimer({ statLog, trackingSettings: tracking({ deaths: true }) });
    expect(screen.getByLabelText('Add death for Tigerclaw').textContent).toBe('2');
  });

  it('undo reverts the last live action', () => {
    const { props } = renderTimer({ trackingSettings: tracking({ goldEarned: true }) });
    fireEvent.click(screen.getByLabelText('Add gold for Brogan'));
    expect(screen.getByText('+1 gold · Brogan')).toBeTruthy();
    fireEvent.click(screen.getByText('Undo'));
    expect(props.onLiveStatChanges).toHaveBeenLastCalledWith(2, [{ playerId: 2, stat: 'goldEarned', delta: -1 }]);
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('the undo bar hides itself after 5 seconds', () => {
    vi.useFakeTimers();
    renderTimer({ trackingSettings: tracking({ goldEarned: true }) });
    fireEvent.click(screen.getByLabelText('Add gold for Brogan'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('undo only covers the current round', () => {
    const { props, rerender } = renderTimer({ trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getByLabelText('Add kill for Arien'));
    expect(screen.getByText('Undo')).toBeTruthy();
    rerender(<GameTimer {...props} gameState={gameState({ round: 3, turn: 1, currentPhase: 'strategy' })} />);
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('keeps the player cards visible at turn end so the last action can be logged', () => {
    renderTimer({ gameState: gameState({ currentPhase: 'turn-end', turn: 2 }), trackingSettings: tracking({ kills: true }) });
    expect(screen.getByLabelText('Add kill for Arien')).toBeTruthy();
  });

  it('never calls a timer callback when logging', () => {
    const { props } = renderTimer({ moveTimerActive: true, trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getByLabelText('Add kill for Arien'));
    fireEvent.click(screen.getByText('Undo'));
    expect(props.onPauseMoveTimer).not.toHaveBeenCalled();
    expect(props.onPauseStrategyTimer).not.toHaveBeenCalled();
    expect(props.onResetMoveTimer).not.toHaveBeenCalled();
  });

  it('the Track stats panel switches tracking on', () => {
    const { props } = renderTimer();
    fireEvent.click(screen.getByText('Track stats'));
    fireEvent.click(screen.getByLabelText('Log player stats'));
    expect(props.onTrackingSettingsChange).toHaveBeenCalledWith({ ...defaultStatTrackingSettings(), enabled: true });
  });

  it('chips follow the order Kills, Deaths, Assists, Minions, Gold (no level chip)', () => {
    renderTimer({
      trackingSettings: tracking({ kills: true, deaths: true, assists: true, goldEarned: true, minionKills: true, level: true }),
    });
    const labels = screen.getAllByLabelText(/ for Arien$/).map(chip => chip.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Add kill for Arien', 'Add death for Arien', 'Add assist for Arien', 'Add minion kill for Arien', 'Add gold for Arien',
    ]);
  });

  it('repeated undo walks back through this round\'s actions, naming the assists a kill gave', () => {
    const { props } = renderTimer({ trackingSettings: tracking({ kills: true, assists: true, goldEarned: true }) });
    fireEvent.click(screen.getByLabelText('Add gold for Brogan'));
    fireEvent.click(screen.getByLabelText('Add kill for Arien'));
    expect(screen.getByText('+1 kill · Arien (+1 assist)')).toBeTruthy();
    fireEvent.click(screen.getByText('Undo'));
    expect(props.onLiveStatChanges).toHaveBeenLastCalledWith(2, [
      { playerId: 1, stat: 'kills', delta: -1 },
      { playerId: 2, stat: 'assists', delta: -1 },
    ]);
    expect(screen.getByText('+1 gold · Brogan')).toBeTruthy();
    fireEvent.click(screen.getByText('Undo'));
    expect(props.onLiveStatChanges).toHaveBeenLastCalledWith(2, [{ playerId: 2, stat: 'goldEarned', delta: -1 }]);
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('the stats panel and chips cannot be used while the end-of-round review is open', () => {
    renderTimer({ gameState: gameState({ turn: 4, currentPhase: 'turn-end' }), trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getByText('Stats'));
    expect(screen.getByLabelText('Log player stats')).toBeTruthy();
    fireEvent.click(screen.getByText('End Round'));
    expect(screen.queryByLabelText('Log player stats')).toBeNull();
    expect(screen.queryByLabelText('Add kill for Arien')).toBeNull();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.getByLabelText('Log player stats')).toBeTruthy();
    expect(screen.getByLabelText('Add kill for Arien')).toBeTruthy();
  });

  it('opening the end-of-round review ends live undo (the review is the place to correct)', () => {
    renderTimer({ gameState: gameState({ turn: 4, currentPhase: 'turn-end' }), trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getByLabelText('Add kill for Arien'));
    expect(screen.getByText('Undo')).toBeTruthy();
    fireEvent.click(screen.getByText('End Round'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('the review notes when it was pre-filled from live tallies', () => {
    const endOfRound = { gameState: gameState({ turn: 4, currentPhase: 'turn-end' as const }), trackingSettings: tracking({ kills: true }) };
    const first = renderTimer(endOfRound);
    fireEvent.click(screen.getByText('End Round'));
    expect(screen.queryByText(/Pre-filled with the stats logged live/)).toBeNull();
    first.unmount();

    const statLog = applyStatChanges(createEmptyStatLog(), 2, [{ playerId: 1, stat: 'kills', delta: 1 }]);
    renderTimer({ ...endOfRound, statLog });
    fireEvent.click(screen.getByText('End Round'));
    expect(screen.getByText(/Pre-filled with the stats logged live/)).toBeTruthy();
  });
});

describe('GameTimer player card totals', () => {
  it('shows tracked zeros as 0 and keeps untracked stats hidden', () => {
    const players: Player[] = [
      { ...PLAYERS[0], stats: { totalKills: 2, totalDeaths: 0 } },
      { ...PLAYERS[1], stats: { totalKills: 0, totalDeaths: 0 } },
      PLAYERS[2], // nothing logged for this player yet (e.g. only live taps for others)
    ];
    renderTimer({ players });
    expect(screen.getAllByTitle('Kills').map(el => el.textContent)).toEqual(['2', '0', '0']);
    expect(screen.getAllByTitle('Deaths').map(el => el.textContent)).toEqual(['0', '0', '0']);
    expect(screen.queryByTitle('Assists')).toBeNull();
    expect(screen.queryByTitle('Total Gold Earned')).toBeNull();
  });
});
