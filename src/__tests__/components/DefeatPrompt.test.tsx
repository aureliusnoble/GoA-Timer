// src/__tests__/components/DefeatPrompt.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DefeatPrompt from '../../components/DefeatPrompt';
import { Hero, Player, Team } from '../../types';
import { defaultStatTrackingSettings } from '../../shared/utils/statTrackingSettings';

const hero = (id: number, name: string): Hero => ({
  id, name, icon: '', complexity: 1, roles: [], expansion: 'base', description: '',
});
const PLAYERS: Player[] = [
  { id: 1, team: Team.Titans, hero: hero(10, 'Arien'), name: 'Ann' },
  { id: 3, team: Team.Atlanteans, hero: hero(12, 'Tigerclaw'), name: 'Cat' },
];
const categories = (c: Partial<ReturnType<typeof defaultStatTrackingSettings>['categories']>) => ({
  ...defaultStatTrackingSettings().categories, ...c,
});

describe('DefeatPrompt', () => {
  it('logs on a single tap when only deaths are tracked', () => {
    const onLog = vi.fn();
    render(<DefeatPrompt team={Team.Titans} pending={1} players={PLAYERS} categories={categories({ deaths: true })} onLog={onLog} onSkip={vi.fn()} />);
    expect(screen.queryByText('Defeated by')).toBeNull();
    fireEvent.click(screen.getByText('Arien'));
    expect(onLog).toHaveBeenCalledWith(1, undefined);
  });

  it('"Other" credits no hero', () => {
    const onLog = vi.fn();
    render(<DefeatPrompt team={Team.Titans} pending={2} players={PLAYERS} categories={categories({ kills: true })} onLog={onLog} onSkip={vi.fn()} />);
    expect(screen.getByText('Log defeat (2 pending)')).toBeTruthy();
    fireEvent.click(screen.getByText('Other'));
    expect(onLog).toHaveBeenCalledWith(undefined, undefined);
  });

  it('waits for both answers when kills and deaths are tracked', () => {
    const onLog = vi.fn();
    render(<DefeatPrompt team={Team.Titans} pending={1} players={PLAYERS} categories={categories({ kills: true, deaths: true })} onLog={onLog} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText('Tigerclaw'));
    expect(onLog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Arien'));
    expect(onLog).toHaveBeenCalledWith(1, 3);
  });

  it('labels the skip button for the one pending defeat', () => {
    const onSkip = vi.fn();
    render(<DefeatPrompt team={Team.Titans} pending={1} players={PLAYERS} categories={categories({ deaths: true })} onLog={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByLabelText('Skip logging this defeat'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('labels the skip button for all pending defeats when there are several', () => {
    render(<DefeatPrompt team={Team.Titans} pending={3} players={PLAYERS} categories={categories({ deaths: true })} onLog={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByLabelText('Skip logging these defeats')).toBeTruthy();
    expect(screen.queryByLabelText('Skip logging this defeat')).toBeNull();
  });

  it('gives the skip button and the hero chips at least a 44px touch target', () => {
    render(<DefeatPrompt team={Team.Titans} pending={1} players={PLAYERS} categories={categories({ kills: true, deaths: true })} onLog={vi.fn()} onSkip={vi.fn()} />);
    const skip = screen.getByLabelText('Skip logging this defeat');
    expect(skip.className).toContain('min-w-[44px]');
    expect(skip.className).toContain('min-h-[44px]');
    for (const chip of ['Arien', 'Tigerclaw', 'Other']) {
      expect(screen.getByText(chip).className, chip).toContain('min-w-[44px]');
    }
  });
});
