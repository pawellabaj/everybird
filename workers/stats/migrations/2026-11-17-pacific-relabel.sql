-- 2026-11-17: the day boundary moves to Pacific time (workers/stats/src/event.ts, CUTOVER = 2026-11-17T07:00:00Z, midnight
-- America/Vancouver). Rows written before the cutover carry the UTC date, so the rows the UTC date put on 17 Nov (written
-- 00:00Z to 07:00Z on 17 Nov) belong to Pacific 16 Nov. Run ONCE, after the cutover, with :LAST_PRE_CUTOVER_ROWID replaced
-- by the MAX(rowid) read at the cutover (README, "Day boundary"). Rowids rise with insert time, so the rows at or below that
-- number are the pre-cutover ones. Left unreplaced, the placeholder matches nothing (or the statement fails): no change.
-- A second run changes nothing, because the rows already say 16 Nov.
--   sed "s/rowid <= :LAST_PRE_CUTOVER_ROWID/rowid <= <B>/" workers/stats/migrations/2026-11-17-pacific-relabel.sql > "${TMPDIR:-/tmp}/pacific-relabel.sql"
--   npx wrangler d1 execute everybird-events --remote --file "${TMPDIR:-/tmp}/pacific-relabel.sql"
UPDATE events SET day = '2026-11-16' WHERE day = '2026-11-17' AND rowid <= :LAST_PRE_CUTOVER_ROWID;
