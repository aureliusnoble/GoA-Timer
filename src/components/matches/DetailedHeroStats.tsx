// src/components/matches/DetailedHeroStats.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Info, Loader } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { useDataSource } from '../../hooks/useDataSource';
import { heroes as allHeroData } from '../../data/heroes';
import { HeroImpactResult, Hero, VictoryType, Team } from '../../types';
import ForestPlot from './ForestPlot';
import { SkillGradientTab } from './DetailedHeroStats/SkillGradientTab';
import { VictoryProfileTab } from './DetailedHeroStats/VictoryProfileTab';
import { RelationshipsTab } from './DetailedHeroStats/RelationshipsTab';
import WinRateTab from './DetailedHeroStats/WinRateTab';
import { MatchHistoryTab } from './DetailedHeroStats/MatchHistoryTab';

interface DetailedHeroStatsProps {
  heroId: number;
  onBack: () => void;
}

interface HeroMatch {
  date: Date;
  won: boolean;
  team: Team;
  victoryType?: VictoryType;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'win-rate', label: 'Win Rate' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'skill-gradient', label: 'Skill Gradient' },
  { key: 'victory-profile', label: 'Victory Profile' },
  { key: 'match-history', label: 'Match History' },
] as const;

type TabKey = typeof TABS[number]['key'];

const DetailedHeroStats: React.FC<DetailedHeroStatsProps> = ({ heroId, onBack }) => {
  const { playSound } = useSound();
  const { isViewModeLoading, getHeroStats, getHeroImpact, getAllMatches, getAllMatchPlayers } = useDataSource();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  // Hero data from static definitions
  const heroData: Hero | undefined = useMemo(
    () => allHeroData.find(h => h.id === heroId),
    [heroId]
  );

  // Loaded stats
  const [heroStats, setHeroStats] = useState<{
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    bestTeammates: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
    bestAgainst: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
    worstAgainst: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
  } | null>(null);
  const [impact, setImpact] = useState<HeroImpactResult | null>(null);
  const [heroMatches, setHeroMatches] = useState<HeroMatch[]>([]);

  useEffect(() => {
    if (isViewModeLoading) return;

    const load = async () => {
      setLoading(true);
      try {
        const [statsArr, impactArr, allMatches, allMatchPlayers] = await Promise.all([
          getHeroStats(),
          getHeroImpact(),
          getAllMatches(),
          getAllMatchPlayers(),
        ]);

        // Find stats for this hero
        const stat = statsArr.find(s => s.heroId === heroId) ?? null;
        if (stat) {
          setHeroStats({
            totalGames: stat.totalGames,
            wins: stat.wins,
            losses: stat.losses,
            winRate: stat.winRate,
            bestTeammates: stat.bestTeammates || [],
            bestAgainst: stat.bestAgainst || [],
            worstAgainst: stat.worstAgainst || [],
          });
        }

        // Find impact for this hero
        const imp = impactArr.find(r => r.heroId === heroId) ?? null;
        setImpact(imp);

        // Build hero match list
        const matchesMap = new Map(allMatches.map(m => [m.id, m]));
        const heroMPs = allMatchPlayers.filter(mp => mp.heroId === heroId);
        const matchesMapped = heroMPs
          .map(mp => {
            const match = matchesMap.get(mp.matchId);
            if (!match) return null;
            const heroMatch: HeroMatch = {
              date: new Date(match.date),
              won: mp.team === match.winningTeam,
              team: mp.team,
              victoryType: match.victoryType,
            };
            return heroMatch;
          });
        const filteredMatches: HeroMatch[] = matchesMapped.filter((m): m is HeroMatch => m !== null);
        filteredMatches.sort((a, b) => b.date.getTime() - a.date.getTime());
        setHeroMatches(filteredMatches);
      } catch (err) {
        console.error('Error loading detailed hero stats:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isViewModeLoading, heroId, getHeroStats, getHeroImpact, getAllMatches, getAllMatchPlayers]);

  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  const handleTabChange = (tab: TabKey) => {
    playSound('buttonClick');
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader size={32} className="animate-spin text-blue-400" />
          <span className="text-gray-400">Loading hero details...</span>
        </div>
      </div>
    );
  }

  if (!heroData) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <button onClick={handleBack} className="flex items-center text-gray-300 hover:text-white mb-4">
          <ChevronLeft size={20} className="mr-1" />
          <span>Back</span>
        </button>
        <p className="text-gray-400">Hero not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center text-gray-300 hover:text-white mb-6"
      >
        <ChevronLeft size={20} className="mr-1" />
        <span>Back to Hero Statistics</span>
      </button>

      {/* Hero header */}
      <div className="flex items-center gap-4 mb-6 bg-gray-700 rounded-lg p-4">
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-gray-900">
          <img
            src={heroData.icon}
            alt={heroData.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=Hero';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">{heroData.name}</h2>
          <div className="text-sm text-gray-300 mt-0.5">{heroData.roles.join(' • ')}</div>
          <div className="text-xs text-blue-400 mt-1">
            {heroData.expansion} • Complexity: {heroData.complexity}
          </div>
          {heroData.description && (
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">{heroData.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Win rate summary */}
          {heroStats ? (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Win Rate Summary</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Win Rate</span>
                <span className="font-medium">{heroStats.winRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-red-600 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${heroStats.winRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Wins: {heroStats.wins}</span>
                <span>Losses: {heroStats.losses}</span>
                <span>Total: {heroStats.totalGames}</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-4 text-sm text-gray-500 italic">
              No match data recorded for this hero.
            </div>
          )}

          {/* Hero Impact */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Hero Impact</h3>
              {/* Info tooltip */}
              <div className="relative group">
                <Info size={14} className="text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-300 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                  <p className="font-semibold mb-1 text-white">G-Formula Methodology</p>
                  <p>
                    Hero Impact uses the g-formula (parametric g-computation) to estimate the
                    Average Treatment Effect (ATE) — the causal effect of picking this hero on
                    win probability, controlling for confounders like team composition and
                    player skill.
                  </p>
                  <p className="mt-2">
                    The dot shows the estimated impact; the shaded band shows the 95% confidence
                    interval. Green means statistically positive, yellow means negative, grey
                    means inconclusive.
                  </p>
                </div>
              </div>
            </div>

            {impact ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {!impact.sufficient && (
                      <span className="text-xs px-2 py-0.5 bg-gray-600 text-gray-300 rounded-full">EARLY DATA</span>
                    )}
                    <span className={`text-lg font-bold ${
                      impact.ciLower > 0 ? 'text-green-400' :
                      impact.ciUpper < 0 ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {impact.ate >= 0 ? '+' : ''}{(impact.ate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{impact.gamesWithHero} games</span>
                </div>
                <ForestPlot
                  ate={impact.ate}
                  ciLower={impact.ciLower}
                  ciUpper={impact.ciUpper}
                  sufficient={impact.sufficient}
                  size="large"
                />
                {impact.gradientBadge !== 'balanced' && (
                  <div className="mt-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      impact.gradientBadge === 'rewards-skill'
                        ? 'bg-purple-900/50 text-purple-300'
                        : 'bg-green-900/50 text-green-300'
                    }`}>
                      {impact.gradientBadge === 'rewards-skill' ? 'Rewards Skill' : 'Beginner Friendly'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Not enough data to compute hero impact.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'win-rate' && (
        <WinRateTab heroName={heroData.name} matches={heroMatches} />
      )}

      {activeTab === 'relationships' && heroStats && (
        <RelationshipsTab
          bestTeammates={heroStats.bestTeammates}
          bestAgainst={heroStats.bestAgainst}
          worstAgainst={heroStats.worstAgainst}
        />
      )}

      {activeTab === 'skill-gradient' && impact && (
        <SkillGradientTab
          gradient={impact.gradient}
          gradientBadge={impact.gradientBadge}
          heroName={heroData.name}
        />
      )}

      {activeTab === 'victory-profile' && impact && (
        <VictoryProfileTab
          victoryProfile={impact.victoryProfile}
          winStyleBadge={impact.winStyleBadge}
          heroName={heroData.name}
        />
      )}

      {activeTab === 'match-history' && (
        <MatchHistoryTab matches={heroMatches} heroName={heroData.name} />
      )}
    </div>
  );
};

export default DetailedHeroStats;
