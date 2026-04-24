import React from 'react';
import { Crown, Flag, Skull } from 'lucide-react';
import { VictoryType } from '../../../types';

interface HeroMatchEntry {
  date: Date;
  won: boolean;
  team: string;
  victoryType?: VictoryType;
}

interface MatchHistoryTabProps {
  matches: HeroMatchEntry[];
  heroName: string;
}

export const MatchHistoryTab: React.FC<MatchHistoryTabProps> = ({
  matches,
  heroName: _heroName,
}) => {
  if (matches.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg px-6 py-8 text-center text-gray-300">
        No recorded matches
      </div>
    );
  }

  // Sort matches by date descending (most recent first)
  const sortedMatches = [...matches].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const getVictoryTypeIcon = (victoryType?: VictoryType) => {
    switch (victoryType) {
      case 'throne':
        return (
          <div className="flex items-center gap-2 text-yellow-400">
            <Crown size={16} />
            <span className="text-sm">Throne</span>
          </div>
        );
      case 'wave':
        return (
          <div className="flex items-center gap-2 text-blue-400">
            <Flag size={16} />
            <span className="text-sm">Wave</span>
          </div>
        );
      case 'kills':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <Skull size={16} />
            <span className="text-sm">Kills</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      {/* Header Row */}
      <div className="flex gap-4 bg-gray-800 px-6 py-3 text-xs font-semibold text-gray-400 divide-x divide-gray-600">
        <div className="flex-1">Date</div>
        <div className="flex-1 pl-4">Result</div>
        <div className="flex-1 pl-4">Team</div>
        <div className="flex-1 pl-4">Victory Type</div>
      </div>

      {/* Match Rows */}
      <div className="divide-y divide-gray-600">
        {sortedMatches.map((match, index) => (
          <div
            key={index}
            className="flex gap-4 px-6 py-3 items-center divide-x divide-gray-600"
          >
            <div className="flex-1 text-sm text-gray-300">
              {match.date.toLocaleDateString()}
            </div>
            <div className="flex-1 pl-4">
              <span
                className={`font-bold text-sm ${
                  match.won ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {match.won ? 'W' : 'L'}
              </span>
            </div>
            <div className="flex-1 pl-4 text-sm text-gray-300 capitalize">
              {match.team}
            </div>
            <div className="flex-1 pl-4">
              {getVictoryTypeIcon(match.victoryType)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
