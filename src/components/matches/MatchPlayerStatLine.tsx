// src/components/matches/MatchPlayerStatLine.tsx
import React from 'react';
import { Swords, Skull, Users, Crosshair, Coins, TrendingUp } from 'lucide-react';
import { StatRecord, TrackedStatKey } from '../../shared/utils/trackedStats';
import { formatStatValue } from '../../shared/utils/matchStatDisplay';

const STAT_META: Record<TrackedStatKey, { label: string; icon: React.ReactNode }> = {
  kills: { label: 'Kills', icon: <Swords size={12} className="text-blue-400 mr-1" /> },
  deaths: { label: 'Deaths', icon: <Skull size={12} className="text-red-400 mr-1" /> },
  assists: { label: 'Assists', icon: <Users size={12} className="text-green-400 mr-1" /> },
  minionKills: { label: 'Minion kills', icon: <Crosshair size={12} className="text-orange-400 mr-1" /> },
  goldEarned: { label: 'Gold', icon: <Coins size={12} className="text-yellow-400 mr-1" /> },
  level: { label: 'Level', icon: <TrendingUp size={12} className="text-purple-400 mr-1" /> },
};

const KDA_KEYS: readonly TrackedStatKey[] = ['kills', 'deaths', 'assists'];

interface MatchPlayerStatLineProps {
  /** The player's recorded stats in this match. */
  player: StatRecord;
  /** Stats tracked for anyone in the match (getTrackedStatKeys); the same columns for every row. */
  statKeys: readonly TrackedStatKey[];
}

/**
 * Compact stat badge for one player in an expanded Match History row. Shows 0 for a tracked
 * zero and an en dash when this player has no value for a stat someone else tracked.
 */
const MatchPlayerStatLine: React.FC<MatchPlayerStatLineProps> = ({ player, statKeys }) => {
  if (statKeys.length === 0) return null;

  const kdaKeys = statKeys.filter(key => KDA_KEYS.includes(key));
  const otherKeys = statKeys.filter(key => !KDA_KEYS.includes(key));

  const renderStat = (key: TrackedStatKey) => {
    const value = formatStatValue(player[key]);
    return (
      <span
        key={key}
        className="flex items-center"
        title={STAT_META[key].label}
        aria-label={`${STAT_META[key].label}: ${value}`}
      >
        {STAT_META[key].icon}
        {value}
      </span>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs bg-gray-800 px-2 py-1 rounded">
      {kdaKeys.length > 0 && (
        <div className="flex items-center space-x-1">
          {kdaKeys.map((key, index) => (
            <React.Fragment key={key}>
              {index > 0 && <span>/</span>}
              {renderStat(key)}
            </React.Fragment>
          ))}
        </div>
      )}
      {otherKeys.map(renderStat)}
    </div>
  );
};

export default MatchPlayerStatLine;
