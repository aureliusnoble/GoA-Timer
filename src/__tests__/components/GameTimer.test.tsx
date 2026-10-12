// src/__tests__/components/GameTimer.test.tsx
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameTimer from '../../components/GameTimer';
import { GameLength, GameState, Hero, Lane, Player, Team } from '../../types';
import { createEmptyStatLog } from '../../shared/utils/gameStatLog';
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
