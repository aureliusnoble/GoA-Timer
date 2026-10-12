// src/__tests__/components/ResumeGamePrompt.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResumeGamePrompt from '../../components/common/ResumeGamePrompt';
import { GameLength, GameState, Lane, Team } from '../../types';

const STATE: GameState = {
  round: 5, turn: 2, gameLength: GameLength.Quick,
  waves: { [Lane.Single]: { currentWave: 3, totalWaves: 3 } },
  teamLives: { [Team.Titans]: 2, [Team.Atlanteans]: 0 },
  currentPhase: 'move', activeHeroIndex: -1, coinSide: Team.Titans,
  hasMultipleLanes: false, completedTurns: [], allPlayersMoved: false,
};

describe('ResumeGamePrompt', () => {
  it('offers to go back to the victory screen for a finished, unsaved game', () => {
    render(<ResumeGamePrompt gameState={STATE} players={[]} onResume={vi.fn()} onDiscard={vi.fn()} savedTime="now" victorTeam={Team.Titans} />);
    expect(screen.getByText('Unsaved Match Result')).toBeTruthy();
    expect(screen.getByText('Back to Victory Screen')).toBeTruthy();
  });

  it('keeps the normal wording for an in-progress game', () => {
    render(<ResumeGamePrompt gameState={STATE} players={[]} onResume={vi.fn()} onDiscard={vi.fn()} savedTime="now" />);
    expect(screen.getByText('Resume Previous Game?')).toBeTruthy();
    expect(screen.getByText('Resume Game')).toBeTruthy();
  });
});
