import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { ALLOWED as APP_ALLOWED } from '@/lib/analytics'
import { ALLOWED, DAILY_CAP, SEEN_SQL, eventRow, keepRow, seenBinds, type EventRow } from '../workers/stats/src/event'

const ctx = { day: '2026-11-15', country: 'MX', device: 'iphone', vid: 'abc123' }

describe("the stats Worker's row", () => {
  it("keeps a visit's browser language", () => {
    expect(eventRow({ n: 'visit', p: 'landing', l: 'es' }, ctx)).toEqual({ ...ctx, name: 'visit', value: 'landing', lang: 'es' })
    expect(eventRow({ n: 'visit', p: 'landing', l: 'es' }, ctx)!.lang).toBe('es')
    expect(eventRow({ n: 'visit', p: 'about', l: 'zh' }, ctx)?.lang).toBe('zh')
    expect(eventRow({ n: 'visit', p: 'about' }, ctx)?.lang).toBe('')
  })
  it('stores only a primary subtag: anything else is ""', () => {
    for (const l of ['ES-es', 'ES', 'es-MX', '<script>', 'x', 'abcd', '', 12, null, ['es']]) {
      expect(eventRow({ n: 'visit', p: 'landing', l }, ctx)?.lang, String(l)).toBe('')
    }
  })
  it('never keeps a language on other events', () => {
    expect(eventRow({ n: 'shared', p: 'post', l: 'es' }, ctx)).toEqual({ ...ctx, name: 'shared', value: 'post', lang: '' })
    expect(eventRow({ n: 'collage_made', p: 'inat', l: 'pt' }, ctx)?.lang).toBe('')
  })
  it('drops anything off the allow-list', () => {
    for (const body of [null, 'visit', 7, {}, { n: 'visit', p: '/s/v1.token' }, { n: 'nope', p: 'landing' }, { n: 'toString', p: 'x' }, { n: 'visit' }, { p: 'landing' }]) {
      expect(eventRow(body, ctx), JSON.stringify(body)).toBeNull()
    }
  })
  it("matches the app's allow-list (AGENTS.md: they change together)", () => {
    expect(Object.fromEntries(Object.entries(ALLOWED).map(([k, v]) => [k, [...v]]))).toEqual(APP_ALLOWED)
  })
})

// node:sqlite (as in tests/stats-report.test.ts): the Worker's schema and SEEN_SQL run for real, as D1 runs them.
type Db = {
  exec(sql: string): void
  prepare(sql: string): {
    run(...a: unknown[]): unknown
    get(...a: unknown[]): { c: number | null; dup: number | null } | undefined
    all(...a: unknown[]): Record<string, unknown>[]
  }
}
const sqlite = (() => {
  try {
    return createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (path: string) => Db }
  } catch {
    return null
  }
})()

const SCHEMA = () => readFileSync('workers/stats/schema.sql', 'utf8')
const indexes = (db: Db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events' ORDER BY name").all().map((r) => r.name)
const count = (db: Db) => (db.prepare('SELECT COUNT(*) AS n FROM events').all()[0] as { n: number }).n

/** What the Worker's fetch does after the allow-list: SEEN_SQL on the visitor's day, then store the row if keepRow says so. */
function store(db: Db, body: unknown, c: typeof ctx = ctx): boolean {
  const row: EventRow | null = eventRow(body, c)
  if (!row) return false
  const seen = db.prepare(SEEN_SQL).get(...seenBinds(row))!
  if (!keepRow(row, seen)) return false
  db.prepare('INSERT INTO events (day, name, value, country, device, vid, lang) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(row.day, row.name, row.value, row.country, row.device, row.vid, row.lang)
  return true
}

describe('the daily keep decision', () => {
  const row = (name: string, value: string): EventRow => ({ ...ctx, name, value, lang: '' })
  it('stores a visit unless the same page is already there today', () => {
    expect(keepRow(row('visit', 'landing'), { c: 0, dup: 0 })).toBe(true)
    expect(keepRow(row('visit', 'landing'), { c: 1, dup: 1 })).toBe(false)
    expect(keepRow(row('visit', 'landing'), { c: 3, dup: 0 })).toBe(true) // another page today
    expect(keepRow(row('visit', 'landing'), { c: 0, dup: null })).toBe(true) // no rows: SUM is NULL
  })
  it('always stores the other events, repeats included', () => {
    expect(keepRow(row('shared', 'post'), { c: 1, dup: 1 })).toBe(true)
    expect(keepRow(row('collage_made', 'inat'), { c: 2, dup: 2 })).toBe(true)
  })
  it('stops every event at the daily cap', () => {
    expect(keepRow(row('collage_made', 'inat'), { c: DAILY_CAP - 1, dup: 0 })).toBe(true)
    expect(keepRow(row('collage_made', 'inat'), { c: DAILY_CAP, dup: 0 })).toBe(false)
    expect(keepRow(row('visit', 'about'), { c: DAILY_CAP, dup: 0 })).toBe(false)
  })
})

describe('visits are counted once per person, page and day', () => {
  it.skipIf(!sqlite)('a second identical visit is not stored', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    expect(store(db, { n: 'visit', p: 'landing' })).toBe(true)
    expect(store(db, { n: 'visit', p: 'landing' })).toBe(false)
    expect(store(db, { n: 'visit', p: 'landing', l: 'es' })).toBe(false) // the language doesn't make it a new view
    expect(count(db)).toBe(1)
  })
  it.skipIf(!sqlite)('a different page is stored, and then only once', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    expect(store(db, { n: 'visit', p: 'landing' })).toBe(true)
    expect(store(db, { n: 'visit', p: 'collage' })).toBe(true)
    expect(store(db, { n: 'visit', p: 'collage' })).toBe(false)
    expect(count(db)).toBe(2)
  })
  it.skipIf(!sqlite)('another visitor on the same page is stored, and the same visitor the next day', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    expect(store(db, { n: 'visit', p: 'landing' })).toBe(true)
    expect(store(db, { n: 'visit', p: 'landing' }, { ...ctx, vid: 'other' })).toBe(true)
    expect(store(db, { n: 'visit', p: 'landing' }, { ...ctx, day: '2026-11-16' })).toBe(true)
    expect(count(db)).toBe(3)
  })
  it.skipIf(!sqlite)('non-visit events are always stored, repeats included', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    expect(store(db, { n: 'shared', p: 'post' })).toBe(true)
    expect(store(db, { n: 'shared', p: 'post' })).toBe(true)
    expect(store(db, { n: 'collage_made', p: 'inat' })).toBe(true)
    expect(store(db, { n: 'collage_made', p: 'inat' })).toBe(true)
    expect(count(db)).toBe(4)
  })
  it.skipIf(!sqlite)('the daily cap still stops a visitor, and the dedupe reads the (day, vid) index', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    const ins = db.prepare('INSERT INTO events (day, name, value, country, device, vid) VALUES (?, ?, ?, ?, ?, ?)')
    for (let i = 0; i < DAILY_CAP; i++) ins.run(ctx.day, 'collage_made', 'inat', 'MX', 'iphone', 'busy')
    expect(store(db, { n: 'visit', p: 'about' }, { ...ctx, vid: 'busy' })).toBe(false)
    expect(store(db, { n: 'visit', p: 'about' })).toBe(true)
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${SEEN_SQL}`).all(...seenBinds({ ...ctx, name: 'visit', value: 'about', lang: '' }))
    expect(plan.map((r) => String(r.detail)).join(' ')).toContain('events_day_vid')
  })
})

describe('the events indexes', () => {
  it('the drop migration is the one file, and it only drops events_day_name', () => {
    const drops = readdirSync('workers/stats/migrations').filter((f) => /^\d{4}-\d{2}-\d{2}-drop-.*\.sql$/.test(f))
    expect(drops).toEqual(['2026-11-16-drop-day-name-index.sql'])
    const statements = readFileSync(`workers/stats/migrations/${drops[0]}`, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('--'))
    expect(statements).toEqual(['DROP INDEX IF EXISTS events_day_name;'])
  })
  it.skipIf(!sqlite)('a fresh schema.sql has only events_day_vid', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    expect(indexes(db)).toEqual(['events_day_vid'])
  })
  it.skipIf(!sqlite)('on the live table (with events_day_name) the migration drops it, keeps the rows and events_day_vid, and can run again', () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec(SCHEMA())
    db.exec('CREATE INDEX events_day_name ON events (day, name)') // the live table before the migration
    db.prepare('INSERT INTO events (day, name, value, country, device, vid) VALUES (?, ?, ?, ?, ?, ?)').run(ctx.day, 'visit', 'landing', 'MX', 'iphone', 'abc123')
    db.prepare('INSERT INTO events (day, name, value, country, device, vid) VALUES (?, ?, ?, ?, ?, ?)').run(ctx.day, 'shared', 'post', 'MX', 'iphone', 'abc123')
    expect(indexes(db)).toEqual(['events_day_name', 'events_day_vid'])
    const migration = readFileSync('workers/stats/migrations/2026-11-16-drop-day-name-index.sql', 'utf8')
    db.exec(migration)
    expect(indexes(db)).toEqual(['events_day_vid'])
    expect(count(db)).toBe(2)
    db.exec(migration) // IF EXISTS: a second run is harmless
    expect(indexes(db)).toEqual(['events_day_vid'])
  })
})
