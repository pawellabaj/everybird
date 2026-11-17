-- Add before deploying the timestamp-writing Worker. Old Workers can still insert their original columns.
-- Existing events keep NULL: their receipt times were never recorded and cannot be reconstructed.
-- No new index or additional event writes. Apply this file once, not the full migrations directory.
-- Rollback: redeploy the old Worker and leave this nullable column in place; do not delete stored timestamps.
ALTER TABLE events ADD COLUMN received_at TEXT;
