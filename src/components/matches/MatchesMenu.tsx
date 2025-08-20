// src/components/matches/MatchesMenu.tsx - Updated to include Hero Info
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, History, Shield, Download, Upload, Trash2, Info, AlertTriangle, Shuffle, FileText, Share2, Wifi, File, Book } from 'lucide-react';
import EnhancedTooltip from '../common/EnhancedTooltip';
import { ConnectionModal } from '../common/ConnectionModal';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import { useConnection } from '../../context/ConnectionContext';
export type MatchesView = 'menu' | 'player-stats' | 'detailed-player-stats' | 'hero-stats' | 'match-history' | 'match-maker' | 'record-match' | 'hero-info' | 'skill-over-time';
interface MatchesMenuProps {
  onBack: () => void;
  onNavigate: (view: MatchesView) => void;
}

const MatchesMenu: React.FC<MatchesMenuProps> = ({ onBack, onNavigate }) => {
  const { playSound } = useSound();
  const { connectionState } = useConnection();
  const [hasData, setHasData] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // State for P2P connection modal
  const [showConnectionModal, setShowConnectionModal] = useState<boolean>(false);
  
  // State for import options
  const [showImportOptions, setShowImportOptions] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  
  
  // Check if we have any match data
  const checkForMatchData = async () => {
    const hasMatchData = await dbService.hasMatchData();
    setHasData(hasMatchData);
  };
  
  // Check if we have any match data on component mount
  useEffect(() => {
    checkForMatchData();
  }, []);
  
  // Handle menu navigation with sound
  const handleNavigate = (view: MatchesView) => {
    playSound('buttonClick');
    onNavigate(view);
  };
  
  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  // Handle opening P2P connection modal
  const handleOpenConnectionModal = () => {
    playSound('buttonClick');
    setShowConnectionModal(true);
  };
  
  // Handle closing P2P connection modal
  const handleCloseConnectionModal = () => {
    setShowConnectionModal(false);
  };
  
  // Handle P2P data received - refresh the hasData state
  const handleDataReceived = () => {
    console.log("Data received, refreshing match data status");
    checkForMatchData();
  };
  
  // Handle exporting match data
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      playSound('buttonClick');
      
      // Get all data from the database
      const data = await dbService.exportData();
      
      // Convert to JSON string
      const jsonData = JSON.stringify(data, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `guards-of-atlantis-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExporting(false);
      }, 100);
    } catch (error) {
      console.error('Error exporting data:', error);
      setIsExporting(false);
    }
  };
  
  // Handle importing match data - updated with import options
  const handleImportData = () => {
    // If options aren't showing yet, display them first
    if (!showImportOptions) {
      playSound('buttonClick');
      setShowImportOptions(true);
      return;
    }
    
    playSound('buttonClick');
    
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    // Handle file selection
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        // Read the file
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate the data structure
        if (!data.players || !data.matches || !data.matchPlayers) {
          setImportError('Invalid data format');
          return;
        }
        
        // Import the data with selected mode (replace or merge)
        const success = await dbService.importData(data, importMode);
        
        if (success) {
          playSound('phaseChange');
          // Check for data after import
          await checkForMatchData();
          setImportError(null);
          setShowImportOptions(false); // Hide options after successful import
        } else {
          setImportError('Failed to import data');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        setImportError('Error importing data');
      }
    };
    
    // Trigger file selection
    input.click();
  };
  
  // Handle canceling import options
  const handleCancelImport = () => {
    playSound('buttonClick');
    setShowImportOptions(false);
  };
  
  // Handle deleting all match data
  const handleDeleteData = async () => {
    if (!showDeleteConfirm) {
      // First click - show confirmation
      setShowDeleteConfirm(true);
      playSound('buttonClick');
      return;
    }
    
    // Second click - confirm deletion
    try {
      playSound('buttonClick');
      const success = await dbService.clearAllData();
      
      if (success) {
        setHasData(false);
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Error deleting data:', error);
    }
  };
  
  // Define detailed tooltips for import modes
  const importTooltips = {
    replace: "This will delete all your existing match history and player statistics and replace them with the imported data. Use this when setting up a new device or completely refreshing your data.",
    merge: "This will add new matches from the imported file while preserving your existing data. Any new match records will be added to your match records. Use this to synchronize data between devices."
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Setup</span>
        </button>
        <h2 className="text-2xl font-bold">Match Statistics</h2>
      </div>
      
      {/* Updated grid layout to include Hero Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* Player Stats */}
        <div 
          className={`bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors ${
            !hasData ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => hasData && handleNavigate('player-stats')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <Users size={24} className="mr-3 text-blue-400" />
            <span>Player Stats</span>
          </div>
          <p className="text-gray-300">
            View detailed player performance statistics, favorite heroes, and ELO ratings.
          </p>
          
          {!hasData && (
            <div className="mt-3 text-yellow-400 text-sm flex items-center">
              <Info size={16} className="mr-1" />
              <span>No match data available</span>
            </div>
          )}
        </div>
        
        {/* Hero Stats */}
        <div 
          className={`bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors ${
            !hasData ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => hasData && handleNavigate('hero-stats')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <Shield size={24} className="mr-3 text-purple-400" />
            <span>Hero Stats</span>
          </div>
          <p className="text-gray-300">
            Analyze hero win rates, synergies, and counters based on your match history.
          </p>
          
          {!hasData && (
            <div className="mt-3 text-yellow-400 text-sm flex items-center">
              <Info size={16} className="mr-1" />
              <span>No match data available</span>
            </div>
          )}
        </div>
        
        {/* Match History */}
        <div 
          className={`bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors ${
            !hasData ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => hasData && handleNavigate('match-history')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <History size={24} className="mr-3 text-green-400" />
            <span>Match History</span>
          </div>
          <p className="text-gray-300">
            Browse past matches, view details, and manage your match history.
          </p>
          
          {!hasData && (
            <div className="mt-3 text-yellow-400 text-sm flex items-center">
              <Info size={16} className="mr-1" />
              <span>No match data available</span>
            </div>
          )}
        </div>
        
        {/* Record Match */}
        <div 
          className="bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors"
          onClick={() => handleNavigate('record-match')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <FileText size={24} className="mr-3 text-orange-400" />
            <span>Record Match</span>
          </div>
          <p className="text-gray-300">
            Manually log match results for games played outside the application.
          </p>
          
        </div>
        
        {/* Match Maker */}
        <div 
          className={`bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors ${
            !hasData ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => hasData && handleNavigate('match-maker')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <Shuffle size={24} className="mr-3 text-purple-400" />
            <span>Match Maker</span>
          </div>
          <p className="text-gray-300">
            Generate balanced teams based on player rankings or experience for fair matches.
          </p>
          
          {!hasData && (
            <div className="mt-3 text-yellow-400 text-sm flex items-center">
              <Info size={16} className="mr-1" />
              <span>No match data available</span>
            </div>
          )}
        </div>
        
        {/* NEW COMPONENT: Hero Info */}
        <div 
          className="bg-gray-700 hover:bg-gray-600 rounded-lg p-6 cursor-pointer transition-colors"
          onClick={() => handleNavigate('hero-info')}
        >
          <div className="flex items-center text-xl font-semibold mb-4">
            <Book size={24} className="mr-3 text-teal-400" />
            <span>Hero Guide</span>
          </div>
          <p className="text-gray-300">
            Browse complete information about all heroes, including stats, roles, and abilities.
          </p>
          
      
        </div>
      </div>
      
      {/* Data Management Section */}
      <div className="mt-8 border-t border-gray-700 pt-6">
        <div className="flex items-center mb-4">
          <h3 className="text-xl font-bold">Data Management</h3>
          <EnhancedTooltip 
            text="Share, import, and export features allow you to transfer your match data between devices or merge game records from different devices."
            position="right"
            maxWidth="max-w-md"
          >
            <Info size={16} className="ml-2 text-blue-400 cursor-help" />
          </EnhancedTooltip>
        </div>
        
        {/* P2P Sync Call-to-Action */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="mr-3 p-2 bg-blue-800 rounded-full flex-shrink-0">
              <Share2 size={24} className="text-blue-300" />
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-lg text-blue-300 mb-1">Direct Data Sharing</h4>
              <p className="text-sm text-gray-300 mb-3">
                Share game data directly between devices with a simple connection code.
              </p>
              <button
                onClick={handleOpenConnectionModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center"
              >
                {connectionState.isConnected ? (
                  <>
                    <Wifi size={16} className="mr-2 text-green-300" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <Share2 size={16} className="mr-2" />
                    <span>Connect and Share</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Manual Data Sharing Call-to-Action */}
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="mr-3 p-2 bg-green-800 rounded-full flex-shrink-0">
              <File size={24} className="text-green-300" />
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-lg text-green-300 mb-1">Manual Data Sharing</h4>
              <p className="text-sm text-gray-300 mb-3">
                Manually import or export data files to share data between devices.
              </p>
              
              {/* Import Options Panel - Show when showImportOptions is true */}
              {showImportOptions ? (
                <div className="bg-gray-800 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-base mb-3">Import Options</h4>
                  
                  <div className="mb-4 space-y-3">
                    {/* Replace Option */}
                    <div className="flex items-start">
                      <input
                        type="radio"
                        id="replaceMode"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <label htmlFor="replaceMode" className="flex items-center font-medium cursor-pointer">
                          Replace all data
                          <EnhancedTooltip text={importTooltips.replace} position="right" maxWidth="max-w-md">
                            <Info size={16} className="ml-2 text-blue-400 cursor-help" />
                          </EnhancedTooltip>
                        </label>
                        <p className="text-sm text-gray-400 mt-1">
                          Delete all existing data and replace with imported data.
                        </p>
                      </div>
                    </div>
                    
                    {/* Merge Option */}
                    <div className="flex items-start">
                      <input
                        type="radio"
                        id="mergeMode"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <label htmlFor="mergeMode" className="flex items-center font-medium cursor-pointer">
                          Merge with existing data
                          <EnhancedTooltip text={importTooltips.merge} position="right" maxWidth="max-w-md">
                            <Info size={16} className="ml-2 text-blue-400 cursor-help" />
                          </EnhancedTooltip>
                        </label>
                        <p className="text-sm text-gray-400 mt-1">
                          Add new data while preserving existing records.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Warning based on selected mode */}
                  <div className="bg-amber-900/30 border border-amber-600 p-3 rounded-lg mb-4">
                    <div className="flex items-start">
                      <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0 text-amber-400" />
                      <div>
                        {importMode === 'replace' ? (
                          <>
                            <span className="font-semibold text-amber-400">Warning: All existing data will be deleted!</span>
                            <p className="mt-1 text-sm">This action will permanently delete all your match history and player statistics and replace them with the imported data.</p>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-amber-400">Merge Information:</span>
                            <p className="mt-1 text-sm">Player stats will be combined (wins, losses, ELO), and new matches will be added to your history. Matches with the same ID will be skipped to avoid duplicates.</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleImportData}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center"
                    >
                      <Upload size={18} className="mr-2" />
                      <span>Proceed with Import</span>
                    </button>
                    
                    <button
                      onClick={handleCancelImport}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {/* Export Data Button */}
                  <EnhancedTooltip text="Export match statistics data to a file. Use this to backup your data or transfer it to another device.">
                    <button
                      onClick={handleExportData}
                      disabled={!hasData || isExporting}
                      className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center ${
                        (!hasData || isExporting) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Download size={18} className="mr-2" />
                      <span>{isExporting ? 'Exporting...' : 'Export Data'}</span>
                    </button>
                  </EnhancedTooltip>
                  
                  {/* Import Data Button */}
                  <EnhancedTooltip text="Import match statistics data from a previously exported file.">
                    <button
                      onClick={handleImportData}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center"
                    >
                      <Upload size={18} className="mr-2" />
                      <span>Import Data</span>
                    </button>
                  </EnhancedTooltip>
                  
                  {/* Delete Data Button */}
                  <EnhancedTooltip text="Delete all match statistics data permanently">
                    <button
                      onClick={handleDeleteData}
                      disabled={!hasData}
                      className={`px-4 py-2 ${
                        showDeleteConfirm ? 'bg-red-500 hover:bg-red-400' : 'bg-red-700 hover:bg-red-600'
                      } rounded-lg flex items-center ${
                        !hasData ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Trash2 size={18} className="mr-2" />
                      <span>{showDeleteConfirm ? 'Confirm Delete' : 'Delete All Data'}</span>
                    </button>
                  </EnhancedTooltip>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Import Error Message */}
        {importError && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {importError}
          </div>
        )}
        
        {/* Data Location Information */}
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
          <div className="flex items-start">
            <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="mb-2">
                Match data is stored locally on this device using your browser's storage. It is recommended you back up your data locally with Export Data (in case your browser's storage gets cleared).
              </p>
              <p>
                Use direct data sharing, or manually import and export data to transfer
                match records between devices or merge records from different devices (e.g. with friends).
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* P2P Connection Modal */}
      <ConnectionModal 
        isOpen={showConnectionModal}
        onClose={handleCloseConnectionModal}
        onDataReceived={handleDataReceived}
      />
      
    </div>
  );
};

export default MatchesMenu;