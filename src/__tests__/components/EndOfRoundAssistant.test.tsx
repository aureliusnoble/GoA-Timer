// src/__tests__/components/EndOfRoundAssistant.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EndOfRoundAssistant from '../../components/EndOfRoundAssistant';
import { Hero, Player, Team } from '../../types';
import { buildReviewValues, createEmptyStatLog, RoundValues } from '../../shared/utils/gameStatLog';
import { StatTrackingSettings, defaultStatTrackingSettings } from '../../shared/utils/statTrackingSettings';

const hero = (id: number, name: string): Hero => ({
  id, name, icon: '', complexity: 1, roles: [], expansion: 'base', description: '',
});

const PLAYERS: Player[] = [
  { id: 1, team: Team.Titans, hero: hero(10, 'Arien'), name: 'Ann' },
  { id: 2, team: Team.Titans, hero: hero(11, 'Brogan'), name: 'Bob' },
  { id: 3, team: Team.Atlanteans, hero: hero(12, 'Tigerclaw'), name: 'Cat' },
];

const tracking = (categories: Partial<StatTrackingSettings['categories']>, enabled = true): StatTrackingSettings => ({
  enabled,
  categories: { ...defaultStatTrackingSettings().categories, ...categories },
});

type Props = React.ComponentProps<typeof EndOfRoundAssistant>;

function renderAssistant(overrides: Partial<Props> = {}) {
  const props: Props = {
    players: PLAYERS,
    isVisible: true,
    round: 1,
    initialValues: buildReviewValues(createEmptyStatLog(), 1, PLAYERS),
    trackingSettings: defaultStatTrackingSettings(),
    onTrackingSettingsChange: vi.fn(),
    onComplete: vi.fn(),
    onDismiss: vi.fn(),
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

describe('EndOfRoundAssistant - remembered settings (4.3)', () => {
  it('opens with the remembered settings and reports changes', () => {
    const { props } = renderAssistant({ trackingSettings: tracking({ deaths: true }) });
    expect((screen.getByLabelText('Log Player Stats (Optional)') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Record player deaths.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minion Kills' }));
    expect(props.onTrackingSettingsChange).toHaveBeenLastCalledWith(tracking({ deaths: true, minionKills: true }));
  });
});

describe('EndOfRoundAssistant - X keeps the entered stats (4.1 / 4.5)', () => {
  it('hands the entered values to onDismiss and does not complete', () => {
    const { props } = renderAssistant({ trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getAllByText('Got Kill')[0]);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onDismiss).toHaveBeenCalledWith({ 1: { kills: 1 }, 2: { kills: 0 }, 3: { kills: 0 } });
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('passes no draft when logging is off', () => {
    const { props } = renderAssistant();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onDismiss).toHaveBeenCalledWith(undefined);
  });
});

describe('EndOfRoundAssistant - assists (4.5)', () => {
  it('"Got Kill" gives teammates assists and "-" takes exactly those back', () => {
    const { props } = renderAssistant({ trackingSettings: tracking({ kills: true, assists: true }) });
    fireEvent.click(screen.getAllByText('Got Kill')[0]); // Ann (Titans)
    fireEvent.click(screen.getByLabelText('Remove kill from Ann'));
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onComplete).toHaveBeenCalledWith({
      1: { kills: 0, assists: 0 }, 2: { kills: 0, assists: 0 }, 3: { kills: 0, assists: 0 },
    });
  });

  it('assists can be entered without kills tracking', () => {
    const { props } = renderAssistant({ trackingSettings: tracking({ assists: true }) });
    fireEvent.click(screen.getByLabelText('Add assist for Cat'));
    fireEvent.click(screen.getByLabelText('Add assist for Cat'));
    fireEvent.click(screen.getByLabelText('Remove assist from Cat'));
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onComplete).toHaveBeenCalledWith({ 1: { assists: 0 }, 2: { assists: 0 }, 3: { assists: 1 } });
  });

  it('no assists are granted when assists are not tracked', () => {
    const { props } = renderAssistant({ trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getAllByText('Got Kill')[0]);
    fireEvent.click(screen.getByText('Save Stats & Continue'));
    expect(props.onComplete).toHaveBeenCalledWith({ 1: { kills: 1 }, 2: { kills: 0 }, 3: { kills: 0 } });
  });
});

describe('EndOfRoundAssistant - final-round mode (4.2)', () => {
  it('hides the checklist, has logging on and the in-use categories selected', () => {
    const { props } = renderAssistant({ mode: 'finalRound', trackingSettings: tracking({ kills: true }, false) });
    expect(screen.queryByText('End of Round Checklist')).toBeNull();
    expect(screen.queryByLabelText('Log Player Stats (Optional)')).toBeNull();
    expect(screen.getByText('Final Round Stats')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Got Kill')[2]);
    fireEvent.click(screen.getByText('Save Final Round Stats'));
    expect(props.onComplete).toHaveBeenCalledWith({ 1: { kills: 0 }, 2: { kills: 0 }, 3: { kills: 1 } });
  });

  it('category changes apply to this review only and are not remembered', () => {
    const { props } = renderAssistant({ mode: 'finalRound', trackingSettings: tracking({ kills: true }) });
    fireEvent.click(screen.getByRole('button', { name: 'Deaths' }));
    fireEvent.click(screen.getByText('Save Final Round Stats'));
    expect(props.onTrackingSettingsChange).not.toHaveBeenCalled();
    expect(props.onComplete).toHaveBeenCalledWith({
      1: { kills: 0, deaths: 0 }, 2: { kills: 0, deaths: 0 }, 3: { kills: 0, deaths: 0 },
    });
  });

  it('end-of-round mode still shows the checklist', () => {
    renderAssistant();
    expect(screen.getByText('End of Round Checklist')).toBeTruthy();
  });
});
