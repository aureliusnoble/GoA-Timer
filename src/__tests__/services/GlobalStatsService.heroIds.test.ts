// src/__tests__/services/GlobalStatsService.heroIds.test.ts
// Matches saved without a hero upload hero_id = NO_HERO_ID (-1). The shared (global) views and
// RPCs group by hero_id without filtering, so GlobalStatsService must keep those rows out of
// every hero-keyed result while still counting Arien (hero id 0).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_HERO_ID } from '../../shared/utils/heroIds';

const fake = vi.hoisted(() => {
  type FakeResult = { data: unknown; error: null };
  const state = {
    rpc: {} as Record<string, unknown>,
    tables: {} as Record<string, unknown[]>,
  };

  /** Chainable query builder; awaiting it resolves to the rows set for its table. */
  class FakeQuery implements PromiseLike<FakeResult> {
    constructor(private readonly table: string) {}
    select() { return this; }
    in() { return this; }
    eq() { return this; }
    gte() { return this; }
    then<A = FakeResult, B = never>(
      onfulfilled?: ((value: FakeResult) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve({ data: state.tables[this.table] ?? [], error: null }).then(onfulfilled, onrejected);
    }
  }

  const client = {
    rpc: async (name: string) => ({ data: state.rpc[name] ?? null, error: null }),
    from: (table: string) => new FakeQuery(table),
  };
  return { state, client };
});

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: fake.client,
  isSupabaseConfigured: () => true,
}));

import { GlobalStatsService } from '../../services/supabase/GlobalStatsService';

function rel(heroId: number, heroName: string, winRate = 50) {
  return { related_hero_id: heroId, related_hero_name: heroName, games_played: 4, wins: 2, win_rate: winRate };
}

function heroStatsRow(heroId: number, heroName: string, related: ReturnType<typeof rel>[] = []) {
  return {
    hero_id: heroId,
    hero_name: heroName,
    total_games: 4,
    wins: 2,
    losses: 2,
    win_rate: 50,
    best_teammates: related,
    best_against: related,
    worst_against: related,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  fake.state.rpc = {};
  fake.state.tables = {};
  GlobalStatsService.clearCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GlobalStatsService keeps unknown heroes out of global hero stats', () => {
  it('getGlobalHeroStats drops NO_HERO_ID heroes and relationships but keeps Arien (id 0)', async () => {
    const related = [rel(NO_HERO_ID, 'Unknown Hero'), rel(0, 'Arien'), rel(1, 'Brogan')];
    fake.state.rpc.get_global_hero_stats_full = [
      heroStatsRow(0, 'Arien', related),
      heroStatsRow(NO_HERO_ID, 'Unknown Hero', related),
      heroStatsRow(1, 'Brogan', related),
    ];

    const result = await GlobalStatsService.getGlobalHeroStats(1, 1, true);

    expect(result.success).toBe(true);
    expect(result.data!.map(h => h.heroId)).toEqual([0, 1]);
    for (const hero of result.data!) {
      expect(hero.bestTeammates.map(r => r.heroId)).toEqual([0, 1]);
      expect(hero.bestAgainst.map(r => r.heroId)).toEqual([0, 1]);
      expect(hero.worstAgainst.map(r => r.heroId)).toEqual([0, 1]);
    }
  });

  it('getGlobalHeroStatsOverTime drops the NO_HERO_ID line but keeps Arien (id 0)', async () => {
    const line = (heroId: number, heroName: string) => ({
      heroId,
      heroName,
      totalGames: 5,
      currentWinRate: 60,
      dataPoints: [{ date: '2026-01-01', gamesPlayedTotal: 5, winsTotal: 3, winRate: 60, gamesPlayedOnDate: 5 }],
    });
    fake.state.rpc.get_global_hero_stats_over_time = {
      heroes: [line(0, 'Arien'), line(NO_HERO_ID, 'Unknown Hero'), line(1, 'Brogan')],
      dateRange: { firstMatch: '2026-01-01', lastMatch: '2026-01-01' },
    };

    const result = await GlobalStatsService.getGlobalHeroStatsOverTime();

    expect(result.success).toBe(true);
    expect(result.data!.heroes.map(h => h.heroId)).toEqual([0, 1]);
  });

  it('getHeroRelationshipNetwork drops pairs that involve NO_HERO_ID (view and filtered RPC)', async () => {
    const rows = [
      { hero_id: 0, related_hero_id: 1, relationship_type: 'teammate', games_played: 3, wins: 2 },
      { hero_id: 0, related_hero_id: NO_HERO_ID, relationship_type: 'teammate', games_played: 3, wins: 2 },
      { hero_id: NO_HERO_ID, related_hero_id: 0, relationship_type: 'opponent', games_played: 3, wins: 1 },
    ];
    fake.state.tables.global_hero_relationships = rows;
    fake.state.rpc.get_global_hero_relationships_filtered = rows;

    const fromView = await GlobalStatsService.getHeroRelationshipNetwork([0, 1]);
    const fromRpc = await GlobalStatsService.getHeroRelationshipNetwork([0, 1], 1, 'quick');

    for (const result of [fromView, fromRpc]) {
      expect(result.success).toBe(true);
      expect(result.data!.map(r => [r.heroId, r.relatedHeroId])).toEqual([[0, 1]]);
    }
  });

  it('getGlobalHeroRelationships drops NO_HERO_ID teammates and opponents but keeps Arien (id 0)', async () => {
    const row = (relatedId: number, name: string, type: string, winRate: number) => ({
      hero_id: 1,
      related_hero_id: relatedId,
      related_hero_name: name,
      relationship_type: type,
      games_played: 4,
      wins: 2,
      win_rate: winRate,
    });
    fake.state.tables.global_hero_relationships = [
      row(0, 'Arien', 'teammate', 75),
      row(NO_HERO_ID, 'Unknown Hero', 'teammate', 80),
      row(0, 'Arien', 'opponent', 60),
      row(NO_HERO_ID, 'Unknown Hero', 'opponent', 70),
      row(NO_HERO_ID, 'Unknown Hero', 'opponent', 20),
      row(2, 'Tigerclaw', 'opponent', 30),
    ];

    const result = await GlobalStatsService.getGlobalHeroRelationships(1);

    expect(result.success).toBe(true);
    expect(result.data!.bestTeammates.map(r => r.heroId)).toEqual([0]);
    expect(result.data!.bestAgainst.map(r => r.heroId)).toEqual([0]);
    expect(result.data!.worstAgainst.map(r => r.heroId)).toEqual([2]);
  });

  it('getGlobalHeroSkillStats has no result for NO_HERO_ID but still has one for Arien (id 0)', async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 12; i++) {
      const base = { match_id: `m${i}`, winning_team: i % 2 === 0 ? 'titans' : 'atlanteans', victory_type: 'throne', player_mu: 25 };
      rows.push({ ...base, team: 'titans', hero_id: 0, hero_name: 'Arien' });
      rows.push({ ...base, team: 'titans', hero_id: NO_HERO_ID, hero_name: 'Unknown Hero' });
      rows.push({ ...base, team: 'atlanteans', hero_id: 1, hero_name: 'Brogan' });
      rows.push({ ...base, team: 'atlanteans', hero_id: NO_HERO_ID, hero_name: 'Unknown Hero' });
    }
    fake.state.rpc.get_hero_skill_match_data = rows;

    const result = await GlobalStatsService.getGlobalHeroSkillStats(true);

    expect(result.success).toBe(true);
    expect(result.data!.find(r => r.heroId === NO_HERO_ID)).toBeUndefined();
    expect(result.data!.find(r => r.heroId === 0)).toBeDefined();
  });
});
