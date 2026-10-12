import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import GameSetup from '../../components/GameSetup';
import { GameLength } from '../../types';

vi.mock('../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));
vi.mock('../../services/DatabaseService', () => ({
  default: {
    hasMatchData: vi.fn().mockResolvedValue(false),
    getAllPlayers: vi.fn().mockResolvedValue([]),
  },
}));

describe('GameSetup timer durations', () => {
  it('keeps the durations it is given instead of resetting them to 90s / 30s', async () => {
    const onStrategyTimeChange = vi.fn();
    const onMoveTimeChange = vi.fn();
    render(
      <GameSetup
        strategyTime={120}
        moveTime={40}
        gameLength={GameLength.Quick}
        onStrategyTimeChange={onStrategyTimeChange}
        onMoveTimeChange={onMoveTimeChange}
        onGameLengthChange={vi.fn()}
        players={[]}
        onAddPlayer={vi.fn()}
        onRemovePlayer={vi.fn()}
        onDraftHeroes={vi.fn()}
        selectedExpansions={[]}
        onToggleExpansion={vi.fn()}
        onPlayerNameChange={vi.fn()}
        duplicateNames={[]}
        canStartDrafting={false}
        heroCount={0}
        maxComplexity={4}
        onMaxComplexityChange={vi.fn()}
        strategyTimerEnabled
        moveTimerEnabled
        onStrategyTimerEnabledChange={vi.fn()}
        onMoveTimerEnabledChange={vi.fn()}
        useDoubleLaneFor6Players={false}
        onUseDoubleLaneFor6PlayersChange={vi.fn()}
        onViewMatches={vi.fn()}
      />
    );
    await act(async () => {}); // let the mount effect's mocked DB promises settle
    expect(onStrategyTimeChange).not.toHaveBeenCalled();
    expect(onMoveTimeChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('2:00')).toBeTruthy();
    expect(screen.getByDisplayValue('0:40')).toBeTruthy();
  });
});
