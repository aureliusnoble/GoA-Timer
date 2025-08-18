// src/services/MigrationService.ts
import dbService from './DatabaseService';

export interface MigrationResult {
  success: boolean;
  version: number;
  matchesAnalyzed: number;
  statsConverted: number;
  playersAffected: number;
  error?: string;
  duration: number;
}

export class MigrationService {
  private static readonly MIGRATION_VERSION_KEY = 'goa_migration_version';
  private static readonly CURRENT_VERSION = 1;
  private static readonly TIMEOUT_MS = 30000; // 30 second timeout

  /**
   * Run all pending migrations silently in background
   * Safe to call multiple times - will only run each migration once
   */
  async runMigrations(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      // Check if migrations have already been run
      const lastVersion = this.getLastMigrationVersion();
      
      if (lastVersion >= MigrationService.CURRENT_VERSION) {
        return {
          success: true,
          version: lastVersion,
          matchesAnalyzed: 0,
          statsConverted: 0,
          playersAffected: 0,
          duration: Date.now() - startTime
        };
      }

      // Run migration with timeout
      const migrationPromise = this.runLegacyStatsMigration();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Migration timeout')), MigrationService.TIMEOUT_MS);
      });

      const result = await Promise.race([migrationPromise, timeoutPromise]);
      
      // Update version on success
      this.setMigrationVersion(MigrationService.CURRENT_VERSION);
      
      return {
        success: true,
        version: MigrationService.CURRENT_VERSION,
        duration: Date.now() - startTime,
        ...result
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        version: this.getLastMigrationVersion(),
        matchesAnalyzed: 0,
        statsConverted: 0,
        playersAffected: 0,
        error: error instanceof Error ? error.message : 'Unknown migration error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Core legacy stats migration logic
   * Converts suspicious all-zero stats to undefined (not tracked)
   */
  private async runLegacyStatsMigration(): Promise<{
    matchesAnalyzed: number;
    statsConverted: number;
    playersAffected: number;
  }> {
    console.log('🔄 Starting legacy stats migration...');
    
    // Get all matches
    const matches = await dbService.getAllMatches();
    console.log(`📊 Found ${matches.length} matches to analyze`);
    
    let statsConverted = 0;
    const playersAffected = new Set<string>();

    for (const match of matches) {
      const matchPlayers = await dbService.getMatchPlayers(match.id);
      
      // Check each stat type
      const statsToCheck: (keyof typeof matchPlayers[0])[] = [
        'kills', 'deaths', 'assists', 'goldEarned', 'minionKills', 'level'
      ];
      
      for (const statType of statsToCheck) {
        // Get all values for this stat in this match
        const statValues = matchPlayers.map(p => p[statType]);
        
        // If ALL players have this stat as 0, and none have undefined, it means it wasn't tracked
        const allZeros = statValues.every(val => val === 0);
        const hasAnyUndefined = statValues.some(val => val === undefined || val === null);
        const hasAnyNonZero = statValues.some(val => val !== 0 && val !== undefined && val !== null);
        
        if (allZeros && !hasAnyUndefined && !hasAnyNonZero) {
          // Convert all 0s to undefined for this stat in this match
          for (const player of matchPlayers) {
            await dbService.updateMatchPlayer(player.id, {
              ...player,
              [statType]: undefined
            });
            statsConverted++;
            playersAffected.add(player.playerId);
          }
        }
      }
    }

    const result = {
      matchesAnalyzed: matches.length,
      statsConverted,
      playersAffected: playersAffected.size
    };

    console.log('✅ Legacy stats migration completed:', result);
    return result;
  }

  /**
   * Get the last migration version that was run
   */
  private getLastMigrationVersion(): number {
    try {
      const versionStr = localStorage.getItem(MigrationService.MIGRATION_VERSION_KEY);
      return parseInt(versionStr || '0');
    } catch (error) {
      console.warn('Failed to read migration version:', error);
      return 0;
    }
  }

  /**
   * Set the current migration version
   */
  private setMigrationVersion(version: number): void {
    try {
      localStorage.setItem(MigrationService.MIGRATION_VERSION_KEY, version.toString());
    } catch (error) {
      console.warn('Failed to save migration version:', error);
    }
  }

  /**
   * Check if migrations are needed (for debugging)
   */
  isMigrationNeeded(): boolean {
    return this.getLastMigrationVersion() < MigrationService.CURRENT_VERSION;
  }

  /**
   * Reset migration version (for testing only)
   */
  resetMigrationVersion(): void {
    try {
      localStorage.removeItem(MigrationService.MIGRATION_VERSION_KEY);
    } catch (error) {
      console.warn('Failed to reset migration version:', error);
    }
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
export default migrationService;