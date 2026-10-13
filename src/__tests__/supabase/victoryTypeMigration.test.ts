// src/__tests__/supabase/victoryTypeMigration.test.ts
import { describe, it, expect } from 'vitest';
import migrationSql from '../../../supabase/migrations/012_cloud_matches_victory_type.sql?raw';
import schemaSql from '../../../supabase/schema.sql?raw';

describe('cloud_matches.victory_type migration', () => {
  it('adds the column idempotently and makes it nullable even if it was hand-added as NOT NULL', () => {
    const add = migrationSql.search(/ALTER TABLE\s+cloud_matches\s+ADD COLUMN IF NOT EXISTS\s+victory_type\s+TEXT\s*;/i);
    const dropNotNull = migrationSql.search(
      /ALTER TABLE\s+cloud_matches\s+ALTER COLUMN\s+victory_type\s+DROP NOT NULL\s*;/i
    );
    expect(add).toBeGreaterThanOrEqual(0);
    expect(dropNotNull).toBeGreaterThan(add);
  });

  it('documents the apply order and the PostgREST schema reload', () => {
    const header = migrationSql.slice(0, migrationSql.search(/^\s*ALTER TABLE/im));
    expect(header).toMatch(/before 011/i);
    expect(header).toContain("NOTIFY pgrst, 'reload schema';");
  });

  it('is nullable in schema.sql', () => {
    const table = schemaSql.slice(schemaSql.indexOf('CREATE TABLE cloud_matches'));
    const columns = table.slice(0, table.indexOf(');'));
    expect(columns).toMatch(/victory_type\s+TEXT\s*,/i);
    expect(columns).not.toMatch(/victory_type\s+TEXT\s+NOT NULL/i);
  });
});
