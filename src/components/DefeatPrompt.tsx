// src/components/DefeatPrompt.tsx
// Shown in a team's lives card after its "-" while live stat tracking is on:
// "who was defeated / by whom" in one or two taps. Logs as soon as every
// tracked question is answered; the undo bar can take it back.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Player, Team } from '../types';
import { StatCategories } from '../shared/utils/gameStatLog';

interface DefeatPromptProps {
  /** The team that just lost a life (the defeated hero's team). */
  team: Team;
  /** How many lost lives are still waiting to be logged. */
  pending: number;
  players: Player[];
  categories: StatCategories;
  /** killerId undefined = no hero credited ("Other"). */
  onLog: (victimId: number | undefined, killerId: number | undefined) => void;
  onSkip: () => void;
}

const chipClass = (selected: boolean) =>
  `h-9 px-3 rounded-full text-sm font-medium bg-gray-700 hover:bg-gray-600 ${selected ? 'ring-2 ring-white' : ''}`;

const DefeatPrompt: React.FC<DefeatPromptProps> = ({ team, pending, players, categories, onLog, onSkip }) => {
  const [victimId, setVictimId] = useState<number | undefined>(undefined);
  const [killerChosen, setKillerChosen] = useState<{ id: number | undefined } | null>(null);

  const askVictim = categories.deaths;
  const askKiller = categories.kills;
  const victims = players.filter(p => p.team === team && p.hero);
  const killers = players.filter(p => p.team !== team && p.hero);

  const tryLog = (nextVictim: number | undefined, nextKiller: { id: number | undefined } | null) => {
    const victimDone = !askVictim || nextVictim !== undefined;
    const killerDone = !askKiller || nextKiller !== null;
    if (victimDone && killerDone) {
      onLog(nextVictim, nextKiller?.id);
      setVictimId(undefined);
      setKillerChosen(null);
    }
  };

  const chooseVictim = (id: number) => {
    setVictimId(id);
    tryLog(id, killerChosen);
  };

  const chooseKiller = (id: number | undefined) => {
    const choice = { id };
    setKillerChosen(choice);
    tryLog(victimId, choice);
  };

  return (
    <div className="mt-3 p-2 rounded-lg bg-black/30 text-left text-sm" role="group" aria-label="Log defeat">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">Log defeat{pending > 1 ? ` (${pending} pending)` : ''}</span>
        <button type="button" onClick={onSkip} aria-label="Skip logging this defeat" className="p-1 rounded-full hover:bg-black/30">
          <X size={16} />
        </button>
      </div>
      {askVictim && (
        <div className="mb-2">
          <div className="text-xs text-gray-300 mb-1">Who was defeated?</div>
          <div className="flex flex-wrap gap-1.5">
            {victims.map(p => (
              <button key={p.id} type="button" title={p.name} className={chipClass(victimId === p.id)} onClick={() => chooseVictim(p.id)}>
                {p.hero?.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {askKiller && (
        <div>
          <div className="text-xs text-gray-300 mb-1">Defeated by</div>
          <div className="flex flex-wrap gap-1.5">
            {killers.map(p => (
              <button key={p.id} type="button" title={p.name} className={chipClass(killerChosen?.id === p.id)} onClick={() => chooseKiller(p.id)}>
                {p.hero?.name}
              </button>
            ))}
            <button type="button" className={chipClass(killerChosen !== null && killerChosen.id === undefined)} onClick={() => chooseKiller(undefined)}>
              Other
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefeatPrompt;
