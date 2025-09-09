// src/components/matches/EditMatchModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Save, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { Team, GameLength } from '../../types';
import { useSound } from '../../context/SoundContext';
import dbService, { DBMatch, DBMatchPlayer, ValidationResult } from '../../services/DatabaseService';
import { heroes } from '../../data/heroes';
import HeroSelector from './HeroSelector';
import EnhancedTooltip from '../common/EnhancedTooltip';

interface EditMatchModalProps {
  isOpen: boolean;
  matchId: string;
  onClose: () => void;
  onSaveComplete: () => void;
}

interface EditableMatchData {
  match: DBMatch;
  players: (DBMatchPlayer & { playerName: string })[];
}

const EditMatchModal: React.FC<EditMatchModalProps> = ({
  isOpen,
  matchId,
  onClose,
  onSaveComplete
}) => {
  const { playSound } = useSound();
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Data state
  const [originalData, setOriginalData] = useState<EditableMatchData | null>(null);
  const [matchData, setMatchData] = useState<DBMatch | null>(null);
  const [playersData, setPlayersData] = useState<(DBMatchPlayer & { playerName: string })[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load match data when modal opens
  useEffect(() => {
    if (isOpen && matchId) {
      loadMatchData();
    } else {
      resetState();
    }
  }, [isOpen, matchId]);

  // Validate data whenever it changes
  useEffect(() => {
    if (matchData && playersData.length > 0) {
      validateData();
      checkForUnsavedChanges();
    }
  }, [matchData, playersData]);

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen]);

  const resetState = () => {
    setOriginalData(null);
    setMatchData(null);
    setPlayersData([]);
    setLoading(false);
    setSaving(false);
    setError(null);
    setValidation({ isValid: true, errors: [], warnings: [] });
    setHasUnsavedChanges(false);
  };

  const loadMatchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await dbService.getEditableMatch(matchId);
      
      if (!data) {
        throw new Error('Match not found');
      }

      // Check if match can be edited
      const canEdit = await dbService.canEditMatch(matchId);
      if (!canEdit.canEdit) {
        throw new Error(canEdit.reason || 'Cannot edit this match');
      }

      // Store original data for reset functionality
      setOriginalData(data);
      setMatchData({ ...data.match });
      setPlayersData(data.players.map(p => ({ ...p })));
      
    } catch (err) {
      console.error('Error loading match data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const validateData = () => {
    if (!matchData || !playersData) return;
    
    const validationResult = dbService.validateMatchEdit(matchData, playersData);
    setValidation(validationResult);
  };

  const checkForUnsavedChanges = () => {
    if (!originalData || !matchData) {
      setHasUnsavedChanges(false);
      return;
    }

    // Check if match data changed
    const matchChanged = JSON.stringify(originalData.match) !== JSON.stringify(matchData);
    
    // Check if any player data changed
    const playersChanged = JSON.stringify(originalData.players) !== JSON.stringify(playersData);
    
    setHasUnsavedChanges(matchChanged || playersChanged);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        return;
      }
    }
    
    playSound('buttonClick');
    onClose();
  };

  const handleSave = async () => {
    if (!matchData || !playersData || !validation.isValid) return;

    setSaving(true);
    setError(null);

    try {
      // Prepare match updates
      const matchUpdates: Partial<DBMatch> = {};
      
      if (originalData) {
        Object.keys(matchData).forEach(key => {
          const matchKey = key as keyof DBMatch;
          if (originalData.match[matchKey] !== matchData[matchKey]) {
            (matchUpdates as any)[matchKey] = matchData[matchKey];
          }
        });
      }

      // Prepare player updates
      const playerUpdates = playersData
        .filter(player => {
          const original = originalData?.players.find(p => p.id === player.id);
          return original && JSON.stringify(original) !== JSON.stringify(player);
        })
        .map(player => ({
          id: player.id,
          updates: {
            heroId: player.heroId,
            heroName: player.heroName,
            heroRoles: player.heroRoles,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            goldEarned: player.goldEarned,
            minionKills: player.minionKills,
            level: player.level,
            team: player.team
          }
        }));

      // Only proceed if there are actual changes
      if (Object.keys(matchUpdates).length === 0 && playerUpdates.length === 0) {
        playSound('buttonClick');
        onSaveComplete();
        return;
      }

      await dbService.editMatch(matchId, matchUpdates, playerUpdates);
      
      playSound('phaseChange'); // Success sound
      onSaveComplete();
      
    } catch (err) {
      console.error('Error saving match:', err);
      setError(err instanceof Error ? err.message : 'Failed to save match');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalData) return;
    
    if (window.confirm('Reset all changes to original values?')) {
      playSound('buttonClick');
      setMatchData({ ...originalData.match });
      setPlayersData(originalData.players.map(p => ({ ...p })));
    }
  };

  const updateMatchField = (field: keyof DBMatch, value: any) => {
    if (!matchData) return;
    
    setMatchData({
      ...matchData,
      [field]: value
    });
  };

  const updatePlayerField = (playerId: string, field: string, value: any) => {
    setPlayersData(prev => 
      prev.map(player => 
        player.id === playerId 
          ? { ...player, [field]: value }
          : player
      )
    );
  };

  const updatePlayerHero = (playerId: string, heroId: number) => {
    const hero = heroes.find(h => h.id === heroId);
    if (!hero) return;

    setPlayersData(prev => 
      prev.map(player => 
        player.id === playerId 
          ? { 
              ...player, 
              heroId: hero.id,
              heroName: hero.name,
              heroRoles: [...hero.roles, ...(hero.additionalRoles || [])]
            }
          : player
      )
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const updateDateTime = (dateStr: string, timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const newDate = new Date(dateStr);
    newDate.setHours(parseInt(hours), parseInt(minutes));
    updateMatchField('date', newDate);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="max-w-6xl w-full max-h-[90vh] bg-gray-800 rounded-lg border border-gray-600 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold flex items-center">
              📝 Edit Match
              {matchData && (
                <span className="ml-3 text-base text-gray-400">
                  {new Date(matchData.date).toLocaleDateString()}
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Changes will recalculate all player ratings from this match forward
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
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center">
                <Loader2 size={24} className="animate-spin mr-3" />
                <span className="text-gray-400">Loading match data...</span>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-900/30 border border-red-600 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle size={20} className="mr-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-300">Error Loading Match</h3>
                    <p className="text-red-200 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : matchData && playersData ? (
            <div className="p-6">
              {/* Validation Errors */}
              {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="mb-6">
                  {validation.errors.length > 0 && (
                    <div className="bg-red-900/30 border border-red-600 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold text-red-300 mb-2 flex items-center">
                        <AlertTriangle size={18} className="mr-2" />
                        Validation Errors
                      </h3>
                      <ul className="text-red-200 text-sm space-y-1">
                        {validation.errors.map((error, index) => (
                          <li key={index}>• {error.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validation.warnings.length > 0 && (
                    <div className="bg-amber-900/30 border border-amber-600 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold text-amber-300 mb-2 flex items-center">
                        <AlertTriangle size={18} className="mr-2" />
                        Warnings
                      </h3>
                      <ul className="text-amber-200 text-sm space-y-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Match Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">Match Details</h3>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={formatDate(matchData.date)}
                        onChange={(e) => updateDateTime(e.target.value, formatTime(matchData.date))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Time</label>
                      <input
                        type="time"
                        value={formatTime(matchData.date)}
                        onChange={(e) => updateDateTime(formatDate(matchData.date), e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Winner */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Winner</label>
                      <div className="flex space-x-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="winner"
                            checked={matchData.winningTeam === Team.Titans}
                            onChange={() => updateMatchField('winningTeam', Team.Titans)}
                            className="mr-2"
                          />
                          <span className="text-blue-400">Titans</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="winner"
                            checked={matchData.winningTeam === Team.Atlanteans}
                            onChange={() => updateMatchField('winningTeam', Team.Atlanteans)}
                            className="mr-2"
                          />
                          <span className="text-red-400">Atlanteans</span>
                        </label>
                      </div>
                    </div>

                    {/* Game Length */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Length</label>
                      <div className="flex space-x-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="gameLength"
                            checked={matchData.gameLength === GameLength.Quick}
                            onChange={() => updateMatchField('gameLength', GameLength.Quick)}
                            className="mr-2"
                          />
                          <span>Quick</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="gameLength"
                            checked={matchData.gameLength === GameLength.Long}
                            onChange={() => updateMatchField('gameLength', GameLength.Long)}
                            className="mr-2"
                          />
                          <span>Long</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Double Lanes */}
                  <div className="mt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={matchData.doubleLanes}
                        onChange={(e) => updateMatchField('doubleLanes', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-gray-300">Double Lanes</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Teams */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-200">Teams</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Titans */}
                  <div>
                    <h4 className="font-medium mb-3 text-blue-400 flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                      Titans ({playersData.filter(p => p.team === Team.Titans).length} players)
                    </h4>
                    <div className="space-y-4">
                      {playersData
                        .filter(p => p.team === Team.Titans)
                        .map(player => (
                          <PlayerEditCard
                            key={player.id}
                            player={player}
                            onHeroChange={(heroId) => updatePlayerHero(player.id, heroId)}
                            onFieldChange={(field, value) => updatePlayerField(player.id, field, value)}
                            validation={validation}
                          />
                        ))}
                    </div>
                  </div>

                  {/* Atlanteans */}
                  <div>
                    <h4 className="font-medium mb-3 text-red-400 flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                      Atlanteans ({playersData.filter(p => p.team === Team.Atlanteans).length} players)
                    </h4>
                    <div className="space-y-4">
                      {playersData
                        .filter(p => p.team === Team.Atlanteans)
                        .map(player => (
                          <PlayerEditCard
                            key={player.id}
                            player={player}
                            onHeroChange={(heroId) => updatePlayerHero(player.id, heroId)}
                            onFieldChange={(field, value) => updatePlayerField(player.id, field, value)}
                            validation={validation}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="flex items-center space-x-4">
            {hasUnsavedChanges && (
              <div className="flex items-center text-amber-400 text-sm">
                <AlertTriangle size={16} className="mr-1" />
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <EnhancedTooltip text="Reset all changes to original values">
              <button
                onClick={handleReset}
                disabled={saving || !hasUnsavedChanges}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  hasUnsavedChanges 
                    ? 'bg-gray-600 hover:bg-gray-500' 
                    : 'bg-gray-700 cursor-not-allowed opacity-50'
                }`}
              >
                <RotateCcw size={18} className="mr-2" />
                Reset
              </button>
            </EnhancedTooltip>

            <button
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
            >
              Cancel
            </button>

            <EnhancedTooltip 
              text={
                !validation.isValid 
                  ? "Fix validation errors before saving"
                  : !hasUnsavedChanges
                    ? "No changes to save"
                    : "Save all changes and recalculate ratings"
              }
            >
              <button
                onClick={handleSave}
                disabled={saving || !validation.isValid || !hasUnsavedChanges}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  validation.isValid && hasUnsavedChanges
                    ? 'bg-blue-600 hover:bg-blue-500' 
                    : 'bg-gray-700 cursor-not-allowed opacity-50'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </EnhancedTooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

// Player Edit Card Component
interface PlayerEditCardProps {
  player: DBMatchPlayer & { playerName: string };
  onHeroChange: (heroId: number) => void;
  onFieldChange: (field: string, value: any) => void;
  validation: ValidationResult;
}

const PlayerEditCard: React.FC<PlayerEditCardProps> = ({
  player,
  onHeroChange,
  onFieldChange,
  validation
}) => {
  const [showStats, setShowStats] = useState(false);

  // Check for field-specific errors
  const getFieldError = (field: string) => {
    return validation.errors.find(error => 
      error.field === field && error.playerId === player.playerId
    );
  };

  const getFieldWarning = (field: string) => {
    return validation.warnings.find(warning => 
      warning.field === field && warning.playerId === player.playerId
    );
  };

  const renderNumberInput = (field: string, label: string, value?: number) => {
    const error = getFieldError(field);
    const warning = getFieldWarning(field);
    const hasIssue = error || warning;

    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={(e) => onFieldChange(field, e.target.value ? parseInt(e.target.value) : undefined)}
          className={`w-full px-2 py-1 text-sm bg-gray-800 border rounded focus:outline-none focus:ring-1 ${
            error 
              ? 'border-red-500 focus:ring-red-500' 
              : warning
                ? 'border-amber-500 focus:ring-amber-500'
                : 'border-gray-600 focus:ring-blue-500'
          }`}
        />
        {hasIssue && (
          <div className={`text-xs mt-1 ${error ? 'text-red-400' : 'text-amber-400'}`}>
            {(error || warning)?.message}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
      {/* Player Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="mr-3 bg-gray-800 p-2 rounded-full">
            🛡️
          </div>
          <div>
            <h5 className="font-medium">{player.playerName}</h5>
            <p className="text-xs text-gray-400">Player ID: {player.playerId}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowStats(!showStats)}
          className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
        >
          {showStats ? 'Hide Stats' : 'Show Stats'}
        </button>
      </div>

      {/* Hero Selection */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-300 mb-2">Hero</label>
        <HeroSelector
          selectedHeroId={player.heroId}
          onHeroChange={onHeroChange}
          className="w-full"
        />
        {getFieldError('hero') && (
          <div className="text-xs text-red-400 mt-1">
            {getFieldError('hero')?.message}
          </div>
        )}
      </div>

      {/* Statistics */}
      {showStats && (
        <div className="bg-gray-800/50 p-3 rounded">
          <h6 className="text-sm font-medium text-gray-300 mb-3">Statistics (Optional)</h6>
          <div className="grid grid-cols-3 gap-3">
            {renderNumberInput('kills', 'Kills', player.kills)}
            {renderNumberInput('deaths', 'Deaths', player.deaths)}
            {renderNumberInput('assists', 'Assists', player.assists)}
            {renderNumberInput('goldEarned', 'Gold', player.goldEarned)}
            {renderNumberInput('minionKills', 'Minions', player.minionKills)}
            {renderNumberInput('level', 'Level', player.level)}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditMatchModal;