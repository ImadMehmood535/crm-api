-- Baseline. schema_migrations itself is created by the migrator.
-- citext gives case-insensitive unique emails and names later on.
CREATE EXTENSION IF NOT EXISTS citext;
