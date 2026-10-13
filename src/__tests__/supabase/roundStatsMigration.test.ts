// src/__tests__/supabase/roundStatsMigration.test.ts
import { describe, it, expect } from 'vitest';
import migrationSql from '../../../supabase/migrations/013_add_round_stats_to_match_players.sql?raw';
import schemaSql from '../../../supabase/schema.sql?raw';

describe('round_stats cloud column', () => {
  it('has an idempotent, nullable migration', () => {
    expect(migrationSql).toMatch(/ALTER TABLE\s+cloud_match_players\s+ADD COLUMN IF NOT EXISTS\s+round_stats\s+JSONB\s*;/i);
    expect(migrationSql).not.toMatch(/NOT NULL/i);
  });

  it('is declared on cloud_match_players in schema.sql', () => {
    const table = schemaSql.slice(schemaSql.indexOf('CREATE TABLE cloud_match_players'));
    expect(table.slice(0, table.indexOf(');'))).toMatch(/round_stats\s+JSONB/i);
  });
});
