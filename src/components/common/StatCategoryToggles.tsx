// src/components/common/StatCategoryToggles.tsx
// The six "track this stat" switches, shared by the end-of-round assistant and
// the timer screen's stats panel.
import React from 'react';
import { Swords, Skull, Users, Coins, Bot, Shield } from 'lucide-react';
import { StatCategories, StatKey } from '../../shared/utils/gameStatLog';

interface StatCategoryTogglesProps {
  categories: StatCategories;
  onToggle: (key: StatKey, enabled: boolean) => void;
}

const TOGGLES: { key: StatKey; label: string; icon: React.ReactNode }[] = [
  { key: 'kills', label: 'Kills', icon: <Swords size={16} /> },
  { key: 'deaths', label: 'Deaths', icon: <Skull size={16} /> },
  { key: 'assists', label: 'Assists', icon: <Users size={16} /> },
  { key: 'goldEarned', label: 'Gold Earned', icon: <Coins size={16} /> },
  { key: 'minionKills', label: 'Minion Kills', icon: <Bot size={16} /> },
  { key: 'level', label: 'Level', icon: <Shield size={16} /> },
];

const StatCategoryToggles: React.FC<StatCategoryTogglesProps> = ({ categories, onToggle }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {TOGGLES.map(({ key, label, icon }) => {
      const enabled = categories[key];
      return (
        <button
          key={key}
          type="button"
          aria-pressed={enabled}
          onClick={() => onToggle(key, !enabled)}
          className={`flex items-center p-2 rounded text-left transition-colors ${
            enabled ? 'bg-blue-900/30 border border-blue-500/50' : 'bg-gray-600 border border-gray-500'
          }`}
        >
          <span className={`mr-2 ${enabled ? 'text-blue-400' : 'text-gray-400'}`}>{icon}</span>
          <span className={`text-sm flex-grow ${enabled ? 'text-blue-200' : 'text-gray-400'}`}>{label}</span>
          <span className={`ml-auto w-4 h-4 rounded-full ${enabled ? 'bg-blue-500' : 'bg-gray-500'}`} />
        </button>
      );
    })}
  </div>
);

export default StatCategoryToggles;
