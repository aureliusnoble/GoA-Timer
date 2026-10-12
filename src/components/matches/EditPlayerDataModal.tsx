// src/components/matches/EditPlayerDataModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2, ChevronDown, ChevronRight, Users, Pencil } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import dbService, { DBPlayer } from '../../services/DatabaseService';
import EnhancedTooltip from '../common/EnhancedTooltip';
import RenamePlayerDialog from './RenamePlayerDialog';

interface EditPlayerDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerDeleted: () => void; // Refresh parent state
  onPlayerRenamed?: (oldId: string, newId: string) => void;
  /** Players on the setup screen; renaming one to another's name is refused. */
  setupPlayers?: readonly { name: string }[];
}

interface PlayerCardProps {
  player: DBPlayer;
  onDelete: (playerId: string) => void;
  onRename: (playerId: string) => void;
  isDeleting: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, onDelete, onRename, isDeleting }) => {
  const { playSound } = useSound();
  const [showJSON, setShowJSON] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleJSON = () => {
    playSound('buttonClick');
    setShowJSON(!showJSON);
  };

  const handleDeleteClick = () => {
    playSound('buttonClick');
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    // Confirm deletion
    onDelete(player.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    playSound('buttonClick');
    setShowDeleteConfirm(false);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Users size={20} className="mr-2 text-blue-400" />
          <div>
            <h4 className="font-semibold text-lg">{player.name}</h4>
            <p className="text-sm text-gray-400">
              Created: {formatDate(player.dateCreated)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Rename / merge Button */}
          <button
            onClick={() => { playSound('buttonClick'); onRename(player.id); }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center"
          >
            <Pencil size={16} className="mr-1" />
            Rename
          </button>

          {/* JSON Toggle Button */}
          <EnhancedTooltip text="View player data in JSON format">
            <button
              onClick={handleToggleJSON}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm flex items-center"
            >
              {showJSON ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="ml-1">JSON</span>
            </button>
          </EnhancedTooltip>

          {/* Delete Button - only for players with no recorded matches */}
          {player.totalGames > 0 ? null : !showDeleteConfirm ? (
            <EnhancedTooltip text="Delete this player (only available for players with no matches)">
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={`px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm flex items-center ${
                  isDeleting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Trash2 size={16} className="mr-1" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </EnhancedTooltip>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="px-3 py-1 bg-red-500 hover:bg-red-400 rounded text-sm"
              >
                Confirm
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Player Details */}
      <div className="text-sm text-gray-300 mb-2">
        <div className="grid grid-cols-2 gap-2">
          <span>Games: <strong>{player.totalGames}</strong></span>
          <span>ELO: <strong>{player.elo}</strong></span>
          <span>Device ID: <strong>{player.deviceId || 'N/A'}</strong></span>
          <span>Level: <strong>{player.level || 1}</strong></span>
        </div>
      </div>

      {/* Confirmation Warning */}
      {showDeleteConfirm && (
        <div className="bg-red-900/30 border border-red-600 p-3 rounded-lg mt-3">
          <p className="text-red-300 text-sm">
            <strong>Warning:</strong> This will permanently delete "{player.name}" from your player database. 
            This action cannot be undone.
          </p>
        </div>
      )}

      {/* JSON Data Viewer */}
      {showJSON && (
        <div className="mt-3 bg-gray-800 rounded-lg p-3">
          <pre className="text-xs text-gray-300 overflow-x-auto">
            {JSON.stringify(player, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export const EditPlayerDataModal: React.FC<EditPlayerDataModalProps> = ({ 
  isOpen, 
  onClose,
  onPlayerDeleted,
  onPlayerRenamed,
  setupPlayers
}) => {
  const { playSound } = useSound();
  const modalRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<DBPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlayerIds, setDeletingPlayerIds] = useState<Set<string>>(new Set());
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null);
  
  // Load all players when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPlayers();
    }
  }, [isOpen]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const allPlayers = await dbService.getAllPlayers();
      setPlayers([...allPlayers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
    } catch (err) {
      console.error('Error loading players:', err);
      setError('Failed to load player data');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerRenamed = async (oldId: string, newId: string) => {
    setRenamingPlayerId(null);
    await loadPlayers();
    onPlayerRenamed?.(oldId, newId);
  };

  const handlePlayerDelete = async (playerId: string) => {
    try {
      setDeletingPlayerIds(prev => new Set([...prev, playerId]));
      
      const success = await dbService.deletePlayer(playerId);
      
      if (success) {
        // Remove player from local state
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        onPlayerDeleted(); // Notify parent to refresh
        playSound('phaseChange'); // Success sound
      } else {
        setError(`Failed to delete player "${playerId}". They may have recorded matches.`);
      }
    } catch (err) {
      console.error('Error deleting player:', err);
      setError(`Error deleting player "${playerId}"`);
    } finally {
      setDeletingPlayerIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
    }
  };
  
  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };
  
  // Handle closing the modal
  const handleClose = () => {
    playSound('buttonClick');
    onClose();
  };
  
  // Trap focus inside modal and add ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !renamingPlayerId) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, renamingPlayerId]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={renamingPlayerId ? undefined : handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="max-w-4xl w-full max-h-[80vh] bg-gray-800 rounded-lg border border-gray-600 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold">Edit Player Database</h2>
            <p className="text-gray-400 text-sm">
              Rename or merge players ({players.length} found)
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading players...</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {!loading && players.length === 0 && !error && (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No players found</p>
            </div>
          )}

          {!loading && players.length > 0 && (
            <div className="space-y-4">
              <div className="bg-amber-900/30 border border-amber-600 p-3 rounded-lg mb-4">
                <p className="text-amber-300 text-sm">
                  <strong>Note:</strong> Rename fixes a typo in a player's name everywhere. Renaming to an
                  existing player's name merges the two. Only players with no recorded matches can be deleted.
                </p>
              </div>

              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onDelete={handlePlayerDelete}
                  onRename={setRenamingPlayerId}
                  isDeleting={deletingPlayerIds.has(player.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {renamingPlayerId && (
        <RenamePlayerDialog
          playerId={renamingPlayerId}
          setupPlayers={setupPlayers}
          onClose={() => setRenamingPlayerId(null)}
          onRenamed={handlePlayerRenamed}
        />
      )}
    </div>
  );
};