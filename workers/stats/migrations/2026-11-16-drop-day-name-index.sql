-- 2026-11-16: drop events_day_name. Nothing needs it for correctness (the report and the Worker filter on day, and
-- events_day_vid leads with day, so a range scan still works). Every index is one more row written per stored event on
-- D1's free tier, so dropping it takes an event from 3 rows_written to 2. Run once on the live database, then deploy the
-- Worker (AGENTS.md; this file is applied with --file, not `migrations apply`, which would re-run the lang migration):
--   npx wrangler d1 execute everybird-events --remote --file migrations/2026-11-16-drop-day-name-index.sql
DROP INDEX IF EXISTS events_day_name;
