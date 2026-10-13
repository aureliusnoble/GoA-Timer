// src/components/LiveStatChips.tsx
// One-tap live stat logging on a timer-screen player card: each chip adds 1
// to this round's tally. Taps never reach the card (no accidental selection).
import React from 'react';
import { Swords, Skull, Users, Bot, Coins } from 'lucide-react';
import { CountStatKey, RoundStatValues, StatCategories } from '../shared/utils/gameStatLog';

export const LIVE_STAT_LABELS: Record<CountStatKey, string> = {
  kills: 'kill',
  deaths: 'death',
  assists: 'assist',
  minionKills: 'minion kill',
  goldEarned: 'gold',
};

/** Chip order: Kills · Deaths · Assists · Minions · Gold (the app's stat display order). */
const CHIP_ORDER: readonly CountStatKey[] = ['kills', 'deaths', 'assists', 'minionKills', 'goldEarned'];

const ICONS: Record<CountStatKey, React.ReactNode> = {
  kills: <Swords size={16} className="text-blue-300" />,
  deaths: <Skull size={16} className="text-red-300" />,
  assists: <Users size={16} className="text-green-300" />,
  minionKills: <Bot size={16} className="text-yellow-300" />,
  goldEarned: <Coins size={16} className="text-amber-300" />,
};

interface LiveStatChipsProps {
  playerName: string;
  categories: StatCategories;
  /** This round's tallies for the player. */
  roundValues?: RoundStatValues;
  onAdd: (stat: CountStatKey) => void;
}

const LiveStatChips: React.FC<LiveStatChipsProps> = ({ playerName, categories, roundValues, onAdd }) => {
  const stats = CHIP_ORDER.filter(key => categories[key]);
  if (stats.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <span className="text-xs text-gray-300 mr-1">This round</span>
      {stats.map(stat => (
        <button
          key={stat}
          type="button"
          aria-label={`Add ${LIVE_STAT_LABELS[stat]} for ${playerName}`}
          onClick={e => {
            e.stopPropagation();
            onAdd(stat);
          }}
          className="flex items-center justify-center gap-1 h-9 min-w-[44px] px-2 rounded-md bg-black/30 hover:bg-black/40 active:bg-black/60 text-sm font-semibold"
        >
          {ICONS[stat]}
          <span>{roundValues?.[stat] ?? 0}</span>
        </button>
      ))}
    </div>
  );
};

export default LiveStatChips;
