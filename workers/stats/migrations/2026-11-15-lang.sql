-- 2026-11-15: the browser language's primary subtag on visit events ('' for other events and older rows).
-- Run once on the live database, then deploy the Worker (AGENTS.md):
--   npx wrangler d1 execute everybird-events --remote --file migrations/2026-11-15-lang.sql
ALTER TABLE events ADD COLUMN lang TEXT NOT NULL DEFAULT '';
