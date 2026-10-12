// src/__tests__/components/EndOfRoundAssistant.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EndOfRoundAssistant from '../../components/EndOfRoundAssistant';
import { Hero, Player, Team } from '../../types';
import { buildReviewValues, createEmptyStatLog, RoundValues } from '../../shared/utils/gameStatLog';

const hero = (id: number, name: string): Hero => ({
  id, name, icon: '', complexity: 1, roles: [], expansion: 'base', description: '',
});

const PLAYERS: Player[] = [
  { id: 1, team: Team.Titans, hero: hero(10, 'Arien'), name: 'Ann' },
  { id: 2, team: Team.Titans, hero: hero(11, 'Brogan'), name: 'Bob' },
  { id: 3, team: Team.Atlanteans, hero: hero(12, 'Tigerclaw'), name: 'Cat' },
];

type Props = React.ComponentProps<typeof EndOfRoundAssistant>;

function renderAssistant(overrides: Partial<Props> = {}) {
  const props: Props = {
    players: PLAYERS,
    isVisible: true,
    round: 1,
    initialValues: buildReviewValues(createEmptyStatLog(), 1, PLAYERS),
    onComplete: vi.fn(),
    ...overrides,
  };
  const utils = render(<EndOfRoundAssistant {...props} />);
  return { props, ...utils };
}

describe('EndOfRoundAssistant - explicit zeros (4.4)', () => {
  it('saves 0 for every player in a tracked category when nothing happened', () => {
    const { props } = renderAssistant();
    fireEvent.click(screen.getByLabelText('Log Player Stats (Optional)'));
    fireEvent.click(screen.getByText('Kills'));
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onComplete).toHaveBeenCalledWith({ 1: { kills: 0 }, 2: { kills: 0 }, 3: { kills: 0 } });
  });

  it('pre-fills from initialValues and does not reset while open', () => {
    const initialValues: RoundValues = { 1: { kills: 2 }, 2: {}, 3: {} };
    const { props, rerender } = renderAssistant({ initialValues });
    fireEvent.click(screen.getByLabelText('Log Player Stats (Optional)'));
    fireEvent.click(screen.getByText('Kills'));
    fireEvent.click(screen.getAllByText('Got Kill')[2]); // Cat
    // a parent re-render with a NEW initialValues object must not wipe what was entered
    rerender(<EndOfRoundAssistant {...props} initialValues={{ ...initialValues }} />);
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onComplete).toHaveBeenCalledWith({ 1: { kills: 2 }, 2: { kills: 0 }, 3: { kills: 1 } });
  });
});
