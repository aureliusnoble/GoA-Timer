// src/components/matches/RenamePlayerDialog.tsx
import React, { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import dbService from '../../services/DatabaseService';
import { gameStorageService } from '../../services/GameStorageService';
import { describeRenameError, playerListHasBoth, RenamePlan } from '../../shared/utils/playerRename';

interface RenamePlayerDialogProps {
  playerId: string;
  /** Players on the setup screen (App's current list). */
  setupPlayers?: readonly { name: string }[];
  onClose: () => void;
  /** Called after the rename/merge has been committed locally. */
  onRenamed: (oldId: string, newId: string) => void;
}

const NO_PLAYERS: readonly { name: string }[] = [];

const matchCount = (n: number) => `${n} match${n === 1 ? '' : 'es'}`;

/**
 * Both names in the setup list, or both in the saved in-progress game: renaming
 * one to the other would give that game two players with one name, and
 * recording it would then lose the match.
 */
async function bothInCurrentGame(
  oldId: string,
  newId: string,
  setupPlayers: readonly { name: string }[]
): Promise<boolean> {
  if (playerListHasBoth(setupPlayers, oldId, newId)) return true;
  const saved = await gameStorageService.loadGame();
  return !!saved && Array.isArray(saved.players) && playerListHasBoth(saved.players, oldId, newId);
}

const RenamePlayerDialog: React.FC<RenamePlayerDialogProps> = ({
  playerId,
  setupPlayers = NO_PLAYERS,
  onClose,
  onRenamed,
}) => {
  const { playSound } = useSound();
  const [newName, setNewName] = useState(playerId);
  const [plan, setPlan] = useState<RenamePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('buttonClick');
    setError(null);
    setBusy(true);
    try {
      const result = await dbService.previewPlayerRename(playerId, newName);
      if (!result.ok) {
        setError(describeRenameError(result.error));
        return;
      }
      const { kind, oldId, newId } = result.plan;
      if (await bothInCurrentGame(oldId, newId, setupPlayers)) {
        const action = kind === 'merge' ? 'merging them' : `renaming “${oldId}” to “${newId}”`;
        setError(`“${oldId}” and “${newId}” are both in the current game. Finish or discard that game before ${action}.`);
        return;
      }
      setPlan(result.plan);
    } catch (err) {
      console.error('Error checking player rename:', err);
      setError('Could not check that name. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!plan) return;
    playSound('buttonClick');
    setError(null);
    setBusy(true);
    try {
      const result = await dbService.renamePlayer(playerId, plan.newId, plan.kind);
      if (result.ok) {
        playSound('phaseChange');
        onRenamed(result.plan.oldId, result.plan.newId);
        return;
      }
      setPlan(null);
      setError(describeRenameError(result.error));
    } catch (err) {
      console.error('Error renaming player:', err);
      setError('Rename failed. No data was changed.');
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => {
    playSound('buttonClick');
    setPlan(null);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-player-title"
    >
      <div className="w-full max-w-md bg-gray-800 rounded-lg border border-gray-600 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="rename-player-title" className="text-lg font-bold">Rename player</h3>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-white p-2" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!plan ? (
          <form onSubmit={handleNext}>
            <label htmlFor="rename-player-input" className="block text-sm text-gray-300 mb-1">
              New name for “{playerId}”
            </label>
            <input
              id="rename-player-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p className="mt-3 text-sm text-red-300 flex items-start">
                <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center">
                {busy && <Loader2 size={16} className="mr-2 animate-spin" />}
                Next
              </button>
            </div>
          </form>
        ) : (
          <div>
            {plan.kind === 'rename' ? (
              <p className="text-gray-200">
                Rename “{plan.oldId}” to “{plan.newId}”? {matchCount(plan.matchIds.length)} will be updated.
              </p>
            ) : (
              <div className="bg-amber-900/30 border border-amber-600 p-3 rounded-lg text-amber-200 text-sm">
                <p className="font-semibold mb-1">“{plan.newId}” already exists.</p>
                <p>
                  Merge “{plan.oldId}” into “{plan.newId}”? {matchCount(plan.matchIds.length)} move to “{plan.newId}”
                  and “{plan.oldId}” is removed. This cannot be undone.
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Ratings are recalculated afterwards. If you use cloud sync on other devices, rename the player there too.
            </p>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={handleBack} disabled={busy} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                  plan.kind === 'merge' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {busy && <Loader2 size={16} className="mr-2 animate-spin" />}
                {plan.kind === 'merge' ? `Merge into “${plan.newId}”` : 'Rename'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RenamePlayerDialog;
