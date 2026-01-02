// src/context/StatsFilterContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface PlayerStatsFilters {
  recencyMonths: number | null;
  minGamesRelationship: number;
  recalculateTrueSkill: boolean;
  dateRange: { startDate?: Date; endDate?: Date };
}

interface StatsFilterContextValue {
  playerStatsFilters: PlayerStatsFilters | null;
  setPlayerStatsFilters: (filters: PlayerStatsFilters | null) => void;
}

const StatsFilterContext = createContext<StatsFilterContextValue | undefined>(undefined);

interface StatsFilterProviderProps {
  children: ReactNode;
}

export const StatsFilterProvider: React.FC<StatsFilterProviderProps> = ({ children }) => {
  const [playerStatsFilters, setPlayerStatsFiltersState] = useState<PlayerStatsFilters | null>(null);

  const setPlayerStatsFilters = useCallback((filters: PlayerStatsFilters | null) => {
    setPlayerStatsFiltersState(filters);
  }, []);

  return (
    <StatsFilterContext.Provider value={{ playerStatsFilters, setPlayerStatsFilters }}>
      {children}
    </StatsFilterContext.Provider>
  );
};

export const useStatsFilter = (): StatsFilterContextValue => {
  const context = useContext(StatsFilterContext);
  if (context === undefined) {
    throw new Error('useStatsFilter must be used within a StatsFilterProvider');
  }
  return context;
};

// Hook that returns null if context is not available (for components that may be outside the provider)
export const useStatsFilterOptional = (): StatsFilterContextValue | null => {
  const context = useContext(StatsFilterContext);
  return context ?? null;
};
