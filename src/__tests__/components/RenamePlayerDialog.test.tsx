// src/__tests__/components/RenamePlayerDialog.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DBPlayer } from '../../services/DatabaseService';
import type { RenamePlan } from '../../shared/utils/playerRename';

const db = vi.hoisted(() => ({
  previewPlayerRename: vi.fn(),
  renamePlayer: vi.fn(),
}));
vi.mock('../../services/DatabaseService', () => ({ default: db, dbService: db }));
vi.mock('../../context/SoundContext', () => ({ useSound: () => ({ playSound: vi.fn() }) }));

const storage = vi.hoisted(() => ({ loadGame: vi.fn() }));
vi.mock('../../services/GameStorageService', () => ({ gameStorageService: storage }));

import RenamePlayerDialog from '../../components/matches/RenamePlayerDialog';

const john: DBPlayer = {
  id: 'John', name: 'John', totalGames: 3, wins: 2, losses: 1, elo: 1200,
  lastPlayed: new Date(), dateCreated: new Date(),
};

function plan(kind: 'rename' | 'merge'): RenamePlan {
  return { kind, oldId: 'Jhon', newId: 'John', player: john, matchPlayers: [], matchIds: ['m-1', 'm-2'] };
}

function typeNameAndContinue(name: string) {
  fireEvent.change(screen.getByLabelText(/New name for/), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

function savedGameWith(...names: string[]) {
  return { players: names.map((name, index) => ({ id: index + 1, name })), strategyTime: 90, moveTime: 30 };
}

const BOTH_IN_GAME = '“Jhon” and “John” are both in the current game. Finish or discard that game before merging them.';

describe('RenamePlayerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadGame.mockResolvedValue(null);
  });

  it('renames after confirmation', async () => {
    db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('rename') });
    db.renamePlayer.mockResolvedValue({ ok: true, plan: plan('rename') });
    const onRenamed = vi.fn();
    render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={onRenamed} />);

    typeNameAndContinue('John');
    expect(await screen.findByText(/Rename “Jhon” to “John”\? 2 matches will be updated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('Jhon', 'John'));
    expect(db.previewPlayerRename).toHaveBeenCalledWith('Jhon', 'John');
    expect(db.renamePlayer).toHaveBeenCalledWith('Jhon', 'John', 'rename');
  });

  it('offers a merge when the name already exists', async () => {
    db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('merge') });
    db.renamePlayer.mockResolvedValue({ ok: true, plan: plan('merge') });
    const onRenamed = vi.fn();
    render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={onRenamed} />);

    typeNameAndContinue('John');
    expect(await screen.findByText('“John” already exists.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Merge into “John”' }));

    await waitFor(() => expect(db.renamePlayer).toHaveBeenCalledWith('Jhon', 'John', 'merge'));
    expect(onRenamed).toHaveBeenCalledWith('Jhon', 'John');
  });

  it('shows why a merge is refused and writes nothing', async () => {
    db.previewPlayerRename.mockResolvedValue({ ok: false, error: { code: 'PLAYERS_SHARE_MATCHES', matchIds: ['m-1'] } });
    render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={vi.fn()} />);

    typeNameAndContinue('John');

    expect(await screen.findByText("Can't merge: both players are in the same match.")).toBeInTheDocument();
    expect(db.renamePlayer).not.toHaveBeenCalled();
  });

  it('reports a failed rename without calling onRenamed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('rename') });
    db.renamePlayer.mockRejectedValue(new Error('disk full'));
    const onRenamed = vi.fn();
    render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={onRenamed} />);

    typeNameAndContinue('John');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));

    expect(await screen.findByText('Rename failed. No data was changed.')).toBeInTheDocument();
    expect(onRenamed).not.toHaveBeenCalled();
  });

  describe('players in the current game', () => {
    it('refuses a merge when both players are in the saved in-progress game', async () => {
      db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('merge') });
      storage.loadGame.mockResolvedValue(savedGameWith('Alice', 'Jhon', 'John'));
      render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={vi.fn()} />);

      typeNameAndContinue('John');

      expect(await screen.findByText(BOTH_IN_GAME)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Merge into “John”' })).not.toBeInTheDocument();
      expect(db.renamePlayer).not.toHaveBeenCalled();
    });

    it('refuses a merge when both players are in the setup list', async () => {
      db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('merge') });
      render(
        <RenamePlayerDialog
          playerId="Jhon"
          setupPlayers={[{ name: 'John' }, { name: 'Bob' }, { name: 'Jhon' }]}
          onClose={vi.fn()}
          onRenamed={vi.fn()}
        />
      );

      typeNameAndContinue('John');

      expect(await screen.findByText(BOTH_IN_GAME)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Merge into “John”' })).not.toBeInTheDocument();
      expect(db.renamePlayer).not.toHaveBeenCalled();
    });

    it('refuses a rename to a name that is already in the current game', async () => {
      // "John" has no recorded matches yet (so it is a plain rename in the database),
      // but both entries are in the game: renaming would give it two "John"s.
      db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('rename') });
      storage.loadGame.mockResolvedValue(savedGameWith('Jhon', 'John'));
      render(<RenamePlayerDialog playerId="Jhon" onClose={vi.fn()} onRenamed={vi.fn()} />);

      typeNameAndContinue('John');

      expect(await screen.findByText(BOTH_IN_GAME)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
      expect(db.renamePlayer).not.toHaveBeenCalled();
    });

    it('still allows a plain rename when only the old name is in the game', async () => {
      db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('rename') });
      db.renamePlayer.mockResolvedValue({ ok: true, plan: plan('rename') });
      storage.loadGame.mockResolvedValue(savedGameWith('Jhon', 'Alice'));
      const onRenamed = vi.fn();
      render(
        <RenamePlayerDialog playerId="Jhon" setupPlayers={[{ name: 'Jhon' }]} onClose={vi.fn()} onRenamed={onRenamed} />
      );

      typeNameAndContinue('John');
      fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));

      await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('Jhon', 'John'));
      expect(db.renamePlayer).toHaveBeenCalledWith('Jhon', 'John', 'rename');
      expect(screen.queryByText(BOTH_IN_GAME)).not.toBeInTheDocument();
    });

    it('allows a merge when only one of the two players is in each list', async () => {
      db.previewPlayerRename.mockResolvedValue({ ok: true, plan: plan('merge') });
      db.renamePlayer.mockResolvedValue({ ok: true, plan: plan('merge') });
      storage.loadGame.mockResolvedValue(savedGameWith('John', 'Alice'));
      const onRenamed = vi.fn();
      render(
        <RenamePlayerDialog playerId="Jhon" setupPlayers={[{ name: 'Jhon' }, { name: 'Bob' }]} onClose={vi.fn()} onRenamed={onRenamed} />
      );

      typeNameAndContinue('John');
      fireEvent.click(await screen.findByRole('button', { name: 'Merge into “John”' }));

      await waitFor(() => expect(db.renamePlayer).toHaveBeenCalledWith('Jhon', 'John', 'merge'));
      expect(onRenamed).toHaveBeenCalledWith('Jhon', 'John');
    });
  });
});
