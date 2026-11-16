// The pure part of the stats Worker: what one POSTed body becomes in the events table, or null (dropped).
// No Worker globals here, so the app's unit tests import it (tests/stats-worker.test.ts).

/** Only these events and values are accepted; anything else is dropped. Mirrored by the app's ALLOWED (src/lib/analytics.ts). */
export const ALLOWED: Record<string, Set<string>> = {
  visit: new Set(['landing', 'collage', 'settings', 'about', 'shared']),
  collage_made: new Set(['ebird', 'ebird-list', 'inat', 'obsorg', 'manual', 'sample', 'restore', 'mixed']),
  image_downloaded: new Set(['story', 'post', 'square', 'desktop', 'wide']),
  shared: new Set(['story', 'post', 'square', 'desktop', 'wide', 'link']),
  link_copied: new Set(['full', 'compact', 'minimal', 'species']),
  ui_language: new Set(['en', 'es', 'pt', 'nl']),
  poster_made: new Set(['a4', 'a3', 'a2', 'a1']),
  poster_downloaded: new Set(['png', 'pdf']),
  search_applied: new Set(['smart', 'bird']),
  filter_used: new Set(['place', 'continent', 'time', 'status', 'group', 'taxonomy']),
}

export type EventContext = { day: string; country: string; device: string; vid: string }
export type EventRow = EventContext & { name: string; value: string; lang: string }

/** A browser language's primary subtag as the app sends it: two or three lower-case letters ("es"), nothing else. */
const LANG = /^[a-z]{2,3}$/

/** The row for one body: `n`/`p` on the allow-list, and `lang` = the body's `l` on a visit only, else ''. */
export function eventRow(body: unknown, ctx: EventContext): EventRow | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { n?: unknown; p?: unknown; l?: unknown }
  const n = typeof b.n === 'string' ? b.n : ''
  const p = typeof b.p === 'string' ? b.p : ''
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, n) || !ALLOWED[n].has(p)) return null
  const lang = n === 'visit' && typeof b.l === 'string' && LANG.test(b.l) ? b.l : ''
  return { day: ctx.day, name: n, value: p, country: ctx.country, device: ctx.device, vid: ctx.vid, lang }
}
