// src/components/matches/RoundLogTable.tsx
// Collapsible round-by-round table for one match in Match History.
// Renders nothing when no player in the match has a round log.
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ListOrdered } from 'lucide-react';
import { Team } from '../../types';
import { buildRoundLog, RoundLogPlayer, RoundStatField } from '../../shared/utils/roundStats';
import { formatStatValue } from '../../shared/utils/matchStatDisplay';

const COLUMN_LABELS: Record<RoundStatField, { short: string; title: string }> = {
  kills: { short: 'K', title: 'Kills' },
  deaths: { short: 'D', title: 'Deaths' },
  assists: { short: 'A', title: 'Assists' },
  goldEarned: { short: 'Gold', title: 'Gold earned' },
  minionKills: { short: 'Min', title: 'Minion kills' },
  level: { short: 'Lvl', title: 'Level at end of round' },
};

interface RoundLogTableProps {
  players: ReadonlyArray<RoundLogPlayer>;
}

const RoundLogTable: React.FC<RoundLogTableProps> = ({ players }) => {
  const [open, setOpen] = useState(false);
  const log = buildRoundLog(players);
  if (!log) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(value => !value);
        }}
        aria-expanded={open}
        className="flex items-center text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-600"
      >
        <ListOrdered size={16} className="mr-2" />
        Round-by-round log
        {open ? <ChevronUp size={16} className="ml-2" /> : <ChevronDown size={16} className="ml-2" />}
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left font-medium py-1 pr-2">Player</th>
                {log.columns.map(column => (
                  <th key={column} className="text-right font-medium py-1 px-1" title={COLUMN_LABELS[column].title}>
                    {COLUMN_LABELS[column].short}
                  </th>
                ))}
              </tr>
            </thead>
            {log.rounds.map(({ round, rows }) => (
              <tbody key={round}>
                <tr>
                  <th colSpan={log.columns.length + 1} className="text-left font-semibold pt-2 pb-1 text-gray-200">
                    Round {round}
                  </th>
                </tr>
                {rows.map(row => (
                  <tr key={row.matchPlayerId} className={row.team === Team.Titans ? 'bg-blue-900/20' : 'bg-red-900/20'}>
                    <td className="py-1 pr-2">
                      <span className="font-medium">{row.playerName}</span>
                      <span className="text-gray-400"> · {row.heroName}</span>
                    </td>
                    {log.columns.map(column => (
                      <td key={column} className="text-right py-1 px-1 tabular-nums">
                        {formatStatValue(row.entry?.[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
};

export default RoundLogTable;
