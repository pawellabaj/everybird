#!/usr/bin/env bash
# The day-boundary reading for the relabel (README, "Day boundary"). Read-only: it only runs SELECT MAX(rowid) on the live
# events table, once every few seconds, until 07:01:00Z on 17 Nov 2026. Each output line is: the read's start time, the value,
# and the read's end time (all UTC). B is the value on the last line whose end time is before 07:00:00Z; use that one.
# Run from workers/stats, about 06:58Z, wrapped in caffeinate so the Mac stays awake:
#   caffeinate -i ./read-boundary.sh | tee "${TMPDIR:-/tmp}/boundary.txt"
set -u
while (( 10#$(date -u +%H%M%S) < 70100 )); do
  start=$(date -u +%T)
  value=$(npx wrangler d1 execute everybird-events --remote --json --command "SELECT MAX(rowid) AS b FROM events" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["results"][0]["b"])')
  echo "$start $value $(date -u +%T)"
done
