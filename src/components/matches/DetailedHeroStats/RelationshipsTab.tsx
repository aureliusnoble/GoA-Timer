import React, { useState, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { heroes as allHeroData } from '../../../data/heroes';

interface RelationshipHero {
  heroId: number;
  heroName: string;
  icon: string;
  winRate: number;
  gamesPlayed: number;
}

interface RelationshipsTabProps {
  bestTeammates: RelationshipHero[];
  bestAgainst: RelationshipHero[];
  worstAgainst: RelationshipHero[];
}

export const RelationshipsTab: React.FC<RelationshipsTabProps> = ({
  bestTeammates,
  bestAgainst,
  worstAgainst,
}) => {
  const [minGames, setMinGames] = useState(3);

  const filteredTeammates = useMemo(
    () => bestTeammates.filter((h) => h.gamesPlayed >= minGames),
    [bestTeammates, minGames]
  );

  const filteredBestAgainst = useMemo(
    () => bestAgainst.filter((h) => h.gamesPlayed >= minGames),
    [bestAgainst, minGames]
  );

  const filteredWorstAgainst = useMemo(
    () => worstAgainst.filter((h) => h.gamesPlayed >= minGames),
    [worstAgainst, minGames]
  );

  const handleMinusClick = () => {
    if (minGames > 1) {
      setMinGames(minGames - 1);
    }
  };

  const handlePlusClick = () => {
    setMinGames(minGames + 1);
  };

  const RelationshipSection: React.FC<{
    title: string;
    heroes: RelationshipHero[];
  }> = ({ title, heroes }) => (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-white">{title}</h3>
      <div className="bg-gray-700 rounded-lg p-4">
        {heroes.length === 0 ? (
          <p className="text-gray-400 italic">No data available</p>
        ) : (
          <div className="space-y-3">
            {heroes.map((hero) => {
              const heroData = allHeroData.find((h) => h.id === hero.heroId);
              const winRateColor = hero.winRate >= 50 ? 'text-green-400' : 'text-red-400';

              return (
                <div
                  key={hero.heroId}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-600 transition-colors"
                >
                  {heroData && (
                    <img
                      src={heroData.icon}
                      alt={hero.heroName}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-grow">
                    <p className="text-white font-medium">{hero.heroName}</p>
                    <p className="text-gray-300 text-sm">{hero.gamesPlayed} games</p>
                  </div>
                  <p className={`font-semibold ${winRateColor}`}>
                    {hero.winRate.toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex justify-end items-center gap-3">
        <span className="text-gray-300 text-sm">Min shared games:</span>
        <button
          onClick={handleMinusClick}
          disabled={minGames <= 1}
          className="p-1 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease minimum games"
        >
          <Minus size={18} className="text-gray-300" />
        </button>
        <span className="text-white font-semibold w-8 text-center">{minGames}</span>
        <button
          onClick={handlePlusClick}
          className="p-1 rounded hover:bg-gray-600 transition-colors"
          aria-label="Increase minimum games"
        >
          <Plus size={18} className="text-gray-300" />
        </button>
      </div>

      {/* Relationship Sections */}
      <RelationshipSection title="Best Teammates" heroes={filteredTeammates} />
      <RelationshipSection title="Strong Against" heroes={filteredBestAgainst} />
      <RelationshipSection title="Nemeses" heroes={filteredWorstAgainst} />
    </div>
  );
};
