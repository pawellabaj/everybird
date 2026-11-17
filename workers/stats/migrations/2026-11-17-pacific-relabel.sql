-- 2026-11-17: the day boundary moves to Pacific at 2026-11-17T00:00Z (workers/stats/src/event.ts, CUTOVER). From then a row's
-- day is the America/Vancouver date: 16 Nov until 07:00Z, 17 Nov from 07:00Z. The old Worker wrote UTC dates, so the rows it
-- wrote from 00:00Z until the new Worker went live carry day '2026-11-17' but belong to Pacific 16 Nov (evening). This moves them.
--
-- RUN IT RIGHT AFTER THE NEW WORKER IS DEPLOYED, AND BEFORE 2026-11-17T07:00Z. From 07:00Z the new Worker writes Pacific
-- 17 Nov rows under the same label, and this statement would move those too. SQL cannot read the clock, so that deadline is
-- the operator's to keep. Before 07:00Z it is safe to run again (the new Worker writes no 17 Nov rows before 07:00Z).
--   cd workers/stats && npx wrangler d1 execute everybird-events --remote --file migrations/2026-11-17-pacific-relabel.sql
UPDATE events SET day = '2026-11-16' WHERE day = '2026-11-17';
