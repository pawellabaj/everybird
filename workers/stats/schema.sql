-- Everybird anonymous events: daily aggregates and server receipt timestamps for new events.
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,      -- YYYY-MM-DD: the UTC date before 2026-11-17 00:00Z, the Pacific date from then (event.ts statsDay)
  name TEXT NOT NULL,     -- visit | collage_made | image_downloaded | shared | link_copied
  value TEXT NOT NULL,    -- the one allowed property value
  country TEXT NOT NULL,  -- ISO 3166-1 alpha-2 from Cloudflare, XX if unknown
  device TEXT NOT NULL,   -- iphone | ipad | android-phone | android-tablet | other-tablet | other-phone | mac | windows | linux | chromeos | other
  vid TEXT NOT NULL DEFAULT '', -- anonymous visitor id, rotates daily (HMAC of day; hash of IP+UA, neither stored)
  lang TEXT NOT NULL DEFAULT '', -- visit only: the browser language's primary subtag (es, pt, zh), '' if none (migrations/2026-11-15-lang.sql)
  received_at TEXT -- UTC ISO 8601 server receipt time; NULL for events recorded before the timestamp rollout
);
CREATE INDEX IF NOT EXISTS events_day_vid ON events (day, vid);
