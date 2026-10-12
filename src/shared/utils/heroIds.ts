// src/shared/utils/heroIds.ts

/**
 * Hero id stored for a match player whose hero is unknown (for example a player who reached
 * the victory screen without a hero). Real hero ids start at 0 (Arien), so 0 must never be
 * used as a "no hero" fallback. The cloud column hero_id is INTEGER NOT NULL, so the
 * sentinel has to be a number rather than undefined.
 */
export const NO_HERO_ID = -1;

/** True for a real hero id (0 = Arien is valid). False for NO_HERO_ID, null, undefined and NaN. */
export function isRealHeroId(heroId: number | null | undefined): heroId is number {
  return typeof heroId === 'number' && Number.isInteger(heroId) && heroId >= 0;
}

export interface HeroPlayCount {
  heroId: number;
  heroName: string;
  count: number;
}

/**
 * Counts how often each real hero appears, most played first (ties keep first-seen order).
 * Records without a real hero id (NO_HERO_ID, null, undefined) are skipped.
 */
export function countHeroesPlayed(
  records: ReadonlyArray<{ heroId: number | null | undefined; heroName?: string | null }>
): HeroPlayCount[] {
  const counts = new Map<number, HeroPlayCount>();
  for (const record of records) {
    const heroId = record.heroId;
    if (!isRealHeroId(heroId)) continue;
    const existing = counts.get(heroId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(heroId, {
        heroId,
        heroName: record.heroName || `Hero ${heroId}`,
        count: 1,
      });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
