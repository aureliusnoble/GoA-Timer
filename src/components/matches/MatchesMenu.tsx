// src/components/matches/MatchesMenu.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, History, Shuffle, Download, Upload, Trash2, Info } from 'lucide-react';
import EnhancedTooltip from '../common/EnhancedTooltip';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';

export type MatchesView = 'menu' | 'player-stats' | 'match-history' | 'match-maker';

interface MatchesMenuProps {
  onBack: () => void;
  onNavigate: (view: MatchesView) => void;
}

const MatchesMenu: React.FC<MatchesMenuProps> = ({ onBack, onNavigate }) => {
  const { playSound } = useSound();
  const [hasData, setHasData] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // Check if we have any match data on component mount
  useEffect(() => {
    const checkData = async () => {
      const hasMatchData = await dbService.hasMatchData();
      setHasData(hasMatchData);
    };
    
    checkData();
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
  
  // Handle importing match data
  const handleImportData = () => {
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
        
        // Import the data
        const success = await dbService.importData(data);
        
        if (success) {
          playSound('phaseChange');
          setHasData(true);
          setImportError(null);
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
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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
            Generate balanced teams based on player ELO ratings for fair matches.
          </p>
          
          {!hasData && (
            <div className="mt-3 text-yellow-400 text-sm flex items-center">
              <Info size={16} className="mr-1" />
              <span>No match data available</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Data Management Section */}
      <div className="mt-8 border-t border-gray-700 pt-6">
        <h3 className="text-xl font-bold mb-4">Data Management</h3>
        
        <div className="flex flex-wrap gap-4">
          {/* Export Data Button */}
          <EnhancedTooltip text="Export match statistics data to a file">
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
          <EnhancedTooltip text="Import match statistics data from a file (will overwrite existing data)">
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
        
        {/* Import Error Message */}
        {importError && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {importError}
          </div>
        )}
        
        {/* Data Location Information */}
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
          <p className="flex items-center">
            <Info size={16} className="mr-2 text-blue-400" />
            Match data is stored locally on this device using your browser's storage. It will not sync between devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MatchesMenu;