// src/components/matches/DetailedPlayerStats/HeroPerformance.tsx
import React, { useState, useEffect } from 'react';
import { Shield, Swords, Users, Star, TrendingUp, Hexagon } from 'lucide-react';
import dbService from '../../../services/DatabaseService';
import { getRoleTooltip } from '../../../shared/utils/roleDescriptions';

interface HeroPerformanceProps {
  favoriteHeroes: { heroId: number; heroName: string; count: number }[];
  favoriteRoles: { role: string; count: number }[];
  totalGames: number;
  matches: any[]; // DBMatchPlayer[] - Player's match participation data
}

interface HeroStats {
  heroName: string;
  gamesPlayed: number;
  winRate: number;
  percentage: number;
}

const HeroPerformance: React.FC<HeroPerformanceProps> = ({
  favoriteHeroes,
  favoriteRoles,
  totalGames,
  matches
}) => {
  const [heroStats, setHeroStats] = useState<HeroStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate real hero win rates based on match data
  useEffect(() => {
    const calculateHeroWinRates = async () => {
      try {
        setLoading(true);
        
        const statsWithWinRates: HeroStats[] = [];
        
        for (const hero of favoriteHeroes) {
          // Find all matches where player used this specific hero
          const heroMatches = matches.filter(match => 
            match.heroId === hero.heroId || match.heroName === hero.heroName
          );
          
          let wins = 0;
          let validGames = 0;
          
          // For each hero match, determine if player won
          for (const playerMatch of heroMatches) {
            try {
              const fullMatch = await dbService.getMatch(playerMatch.matchId);
              if (fullMatch) {
                validGames++;
                if (playerMatch.team === fullMatch.winningTeam) {
                  wins++;
                }
              }
            } catch (error) {
              console.warn(`Failed to load match ${playerMatch.matchId}:`, error);
            }
          }
          
          // Calculate win rate (only if we have valid match outcome data)
          const winRate = validGames > 0 ? (wins / validGames) * 100 : 0;
          
          statsWithWinRates.push({
            heroName: hero.heroName,
            gamesPlayed: hero.count,
            winRate: winRate,
            percentage: totalGames > 0 ? (hero.count / totalGames) * 100 : 0
          });
        }
        
        setHeroStats(statsWithWinRates);
      } catch (error) {
        console.error('Error calculating hero win rates:', error);
        // Fallback to basic stats without win rates
        const basicStats = favoriteHeroes.map(hero => ({
          heroName: hero.heroName,
          gamesPlayed: hero.count,
          winRate: 0,
          percentage: totalGames > 0 ? (hero.count / totalGames) * 100 : 0
        }));
        setHeroStats(basicStats);
      } finally {
        setLoading(false);
      }
    };

    if (favoriteHeroes.length > 0) {
      calculateHeroWinRates();
    } else {
      setHeroStats([]);
      setLoading(false);
    }
  }, [favoriteHeroes, matches, totalGames]);

  // Get role icon with tooltip
  const getRoleIcon = (role: string) => {
    const tooltip = getRoleTooltip(role);
    
    switch (role.toLowerCase()) {
      case 'guardian':
      case 'durable':
        return <span title={tooltip}><Shield size={16} className="text-blue-400" /></span>;
      case 'slayer':
      case 'tactician':
        return <span title={tooltip}><Swords size={16} className="text-red-400" /></span>;
      case 'support':
        return <span title={tooltip}><Users size={16} className="text-green-400" /></span>;
      case 'sorcerer':
        return <span title={tooltip}><Star size={16} className="text-purple-400" /></span>;
      default:
        return <span title={tooltip}><Hexagon size={16} className="text-gray-400" /></span>;
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'guardian':
      case 'durable':
        return 'text-blue-400';
      case 'slayer':
      case 'tactician':
        return 'text-red-400';
      case 'support':
        return 'text-green-400';
      case 'sorcerer':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Shield size={20} className="mr-2 text-blue-400" />
          Hero Performance Analytics
        </h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Calculating hero win rates...</p>
        </div>
      </div>
    );
  }

  if (favoriteHeroes.length === 0 || heroStats.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Shield size={20} className="mr-2 text-blue-400" />
          Hero Performance Analytics
        </h3>
        <div className="text-center py-8">
          <Shield size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">No Hero Data Available</p>
          <p className="text-sm text-gray-500">
            This player hasn't recorded any matches with hero selection yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <Shield size={20} className="mr-2 text-blue-400" />
        Hero Performance Analytics
      </h3>

      {/* Hero Statistics */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3 text-gray-300">Most Played Heroes</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {heroStats.slice(0, 6).map((hero) => (
            <div key={hero.heroName} className="bg-gray-800 p-3 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-medium text-white truncate">{hero.heroName}</div>
                  <div className="text-xs text-gray-400">{hero.gamesPlayed} games</div>
                </div>
                <div className="text-right ml-2">
                  <div className="text-sm font-semibold text-green-400">
                    {hero.winRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">win rate</div>
                </div>
              </div>
              
              {/* Usage percentage bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Usage</span>
                  <span>{hero.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500"
                    style={{ width: `${hero.percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Win rate bar */}
              <div>
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${hero.winRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Preferences */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3 text-gray-300">Role Preferences</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {favoriteRoles.map((role) => {
            const rolePercentage = totalGames > 0 ? (role.count / totalGames) * 100 : 0;
            return (
              <div key={role.role} className="bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {getRoleIcon(role.role)}
                    <span className={`ml-2 font-medium ${getRoleColor(role.role)}`} title={getRoleTooltip(role.role)}>
                      {role.role}
                    </span>
                  </div>
                </div>
                <div className="text-lg font-bold text-white">{role.count}</div>
                <div className="text-xs text-gray-400 mb-2">
                  {rolePercentage.toFixed(1)}% of games
                </div>
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500"
                    style={{ width: `${rolePercentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-gray-300 flex items-center">
            <TrendingUp size={16} className="mr-2 text-blue-400" />
            Hero Diversity
          </h4>
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {favoriteHeroes.length}
          </div>
          <div className="text-sm text-gray-400">
            Different heroes played
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {totalGames > 0 ? `Avg ${(totalGames / favoriteHeroes.length).toFixed(1)} games per hero` : 'No data'}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-gray-300 flex items-center">
            <Star size={16} className="mr-2 text-yellow-400" />
            Main Hero
          </h4>
          {favoriteHeroes[0] && (
            <>
              <div className="text-lg font-bold text-white mb-1">
                {favoriteHeroes[0].heroName}
              </div>
              <div className="text-sm text-gray-400">
                {favoriteHeroes[0].count} games played
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {totalGames > 0 ? `${((favoriteHeroes[0].count / totalGames) * 100).toFixed(1)}% of all games` : ''}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-gray-300 flex items-center">
            <Users size={16} className="mr-2 text-green-400" />
            Favorite Role
          </h4>
          {favoriteRoles[0] && (
            <>
              <div className="text-lg font-bold text-white mb-1 flex items-center">
                {getRoleIcon(favoriteRoles[0].role)}
                <span className="ml-2">{favoriteRoles[0].role}</span>
              </div>
              <div className="text-sm text-gray-400">
                {favoriteRoles[0].count} games played
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {totalGames > 0 ? `${((favoriteRoles[0].count / totalGames) * 100).toFixed(1)}% preference` : ''}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default HeroPerformance;