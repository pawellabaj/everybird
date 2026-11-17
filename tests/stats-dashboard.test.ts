import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { verifyAccess, type AccessEnv, type Jwk } from '../workers/stats/src/access'
import { parseParams, shape, statements, type Row } from '../workers/stats/src/dashboard'
import worker from '../workers/stats/src/index'
import { PURE_JS } from '../workers/stats/src/pure'

// node:sqlite (as in tests/stats-worker.test.ts): the dashboard's SQL runs for real, on the Worker's schema.
type Db = { exec(sql: string): void; prepare(sql: string): { run(...a: unknown[]): unknown; all(...a: unknown[]): Row[] } }
const sqlite = (() => {
  try { return createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (path: string) => Db } } catch { return null }
})()

const seeded = () => {
  const db = new sqlite!.DatabaseSync(':memory:')
  db.exec(readFileSync('workers/stats/schema.sql', 'utf8'))
  const ins = db.prepare('INSERT INTO events (day, name, value, country, device, vid, lang) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const add = (day: string, name: string, value: string, vid: string, country = 'MX', device = 'iphone', lang = '') => ins.run(day, name, value, country, device, vid, lang)
  // previous period (2026-11-01..03) and current (2026-11-04..06)
  add('2026-11-02', 'visit', 'landing', 'p1'); add('2026-11-02', 'collage_made', 'inat', 'p1')
  add('2026-11-04', 'visit', 'landing', 'a', 'MX', 'iphone', 'es'); add('2026-11-04', 'visit', 'landing', 'b', 'US', 'mac', 'en')
  add('2026-11-04', 'visit', 'settings', 'a'); add('2026-11-04', 'visit', 'collage', 'a')
  add('2026-11-04', 'collage_made', 'inat', 'a'); add('2026-11-04', 'collage_made', 'ebird', 'a')
  add('2026-11-04', 'image_downloaded', 'story', 'a'); add('2026-11-04', 'poster_downloaded', 'pdf', 'a')
  add('2026-11-05', 'visit', 'landing', 'a'); add('2026-11-05', 'shared', 'link', 'c', 'US', 'mac')
  add('2026-11-05', 'poster_made', 'a3-l', 'c', 'US', 'mac'); add('2026-11-05', 'filter_used', 'place', 'c', 'US', 'mac')
  add('2026-11-06', 'visit', 'landing', 'd', 'XX', 'other')
  return db
}
const run = (db: Db, p: { from: string; to: string; country: string }) => shape(p, statements(p).map((s) => db.prepare(s.sql).all(...s.binds)), new Date('2026-11-06T12:00:00Z'))

describe.skipIf(!sqlite)('the dashboard aggregation', () => {
  const p = { from: '2026-11-04', to: '2026-11-06', country: '' }
  it('totals the range and the equal period before it', () => {
    const d = run(seeded(), p)
    expect(d.tiles.collages).toEqual({ value: 2, prev: 1 })
    expect(d.tiles.images).toEqual({ value: 1, prev: 0 })
    expect(d.tiles.posterDownloads.value).toBe(1)
    expect(d.tiles.shares.value).toBe(1)
    expect(d.tiles.posters.value).toBe(1)
    expect(d.tiles.downloads.value).toBe(2)
    expect(d.tiles.peopleLast).toEqual({ value: 1, prev: 2, day: '2026-11-06' })
    expect(d.range).toMatchObject({ from: '2026-11-04', prevFrom: '2026-11-01', prevTo: '2026-11-03', days: 3 })
  })
  it('gives one daily point per day, people as distinct visitors', () => {
    const d = run(seeded(), p)
    expect(d.days.map((x) => [x.d, x.people, x.collages])).toEqual([['2026-11-04', 2, 2], ['2026-11-05', 2, 0], ['2026-11-06', 1, 0]])
  })
  it('compares a one-day range with the day before', () => {
    const d = run(seeded(), { from: '2026-11-05', to: '2026-11-05', country: '' })
    expect(d.tiles.peopleLast).toEqual({ value: 2, prev: 2, day: '2026-11-05' })
    expect(d.days.map((x) => x.d)).toEqual(['2026-11-05'])
  })
  it('builds the funnel in person-days', () => {
    expect(run(seeded(), p).funnel).toEqual([{ k: 'landing', n: 4 }, { k: 'settings', n: 1 }, { k: 'collage', n: 1 }, { k: 'collage_made', n: 1 }, { k: 'downloaded', n: 1 }])
  })
  it('breaks down formats, poster sizes, devices, languages and countries', () => {
    const b = run(seeded(), p).breakdowns
    expect(b.formats).toEqual([{ k: 'story', n: 1 }])
    expect(b.posterSizes).toEqual([{ k: 'a3-l', n: 1 }])
    expect(b.filters).toEqual([{ k: 'place', n: 1 }])
    expect(b.browserLanguages.map((x) => x.k).sort()).toEqual(['en', 'es'])
    expect(b.devices.find((x) => x.k === 'mac')?.n).toBe(2) // b on the 4th, c on the 5th: person-days
    expect(b.countries[0]).toEqual({ k: 'MX', n: 2 })
  })
  it('filters by country, but the country list stays whole', () => {
    const d = run(seeded(), { ...p, country: 'US' })
    expect(d.tiles.collages.value).toBe(0)
    expect(d.tiles.shares.value).toBe(1)
    expect(d.breakdowns.countries.map((x) => x.k).sort()).toEqual(['MX', 'US', 'XX'])
    expect(d.breakdowns.devices).toEqual([{ k: 'mac', n: 2 }])
  })
  it('starts "All" at the first day with data and returns aggregates only', () => {
    const d = run(seeded(), { from: '2020-01-01', to: '2026-11-06', country: '' })
    expect(d.range.from).toBe('2026-11-02')
    const text = JSON.stringify(d)
    expect(text).not.toMatch(/"vid"|"a"|"p1"/)
  })
  it('uses a handful of statements; all but the two since-launch ones are on the day range', () => {
    const s = statements(p)
    expect(s.length).toBeLessThanOrEqual(10)
    expect(s.filter((x) => x.sql.includes('day BETWEEN')).length).toBe(8)
    for (const x of s) expect(x.sql.match(/\?/g)?.length ?? 0).toBe(x.binds.length) // bound params only
  })
  it('counts rates in person-days, never summing people across days', () => {
    // person-days: a and b on the 4th, a and c on the 5th, d on the 6th = 5
    expect(run(seeded(), p).rates).toEqual({ pd: 5, collage: 1, downloaded: 1, shared: 1, poster: 1 })
    expect(run(seeded(), { ...p, country: 'US' }).rates).toEqual({ pd: 2, collage: 0, downloaded: 0, shared: 1, poster: 1 })
    expect(run(seeded(), { from: '2026-11-04', to: '2026-11-04', country: '' }).rates.pd).toBe(2)
  })
  it('totals since launch for the whole site, whatever the range or country', () => {
    const all = run(seeded(), p).launch
    expect(all).toEqual({ since: '2026-11-02', collages: 3, own: 3, images: 1, posters: 1, peak: { day: '2026-11-04', people: 2 } })
    expect(run(seeded(), { from: '2026-11-06', to: '2026-11-06', country: 'XX' }).launch).toEqual(all)
  })
  it('keeps the demo and backups out of the postable collage count', () => {
    const db = seeded()
    const ins = db.prepare('INSERT INTO events (day, name, value, country, device, vid, lang) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ins.run('2026-10-01', 'collage_made', 'sample', 'MX', 'iphone', 'z1', ''); ins.run('2026-10-01', 'collage_made', 'restore', 'MX', 'iphone', 'z2', '')
    expect(run(db, p).launch).toMatchObject({ collages: 5, own: 3, since: '2026-10-01' })
  })
  it('returns the previous period day for day, for compare', () => {
    const d = run(seeded(), p)
    expect(d.prevDays.map((x) => [x.d, x.people, x.collages])).toEqual([['2026-11-01', 0, 0], ['2026-11-02', 1, 1], ['2026-11-03', 0, 0]])
    expect(run(seeded(), { from: '2020-01-01', to: '2026-11-06', country: '' }).prevDays).toEqual([]) // "All" has none
    expect(d.days[0]).toMatchObject({ images: 1, posterDownloads: 1 })
  })
  it('stays aggregates only with the new fields', () => {
    expect(JSON.stringify(run(seeded(), p))).not.toMatch(/"vid"|"p1"/)
  })
})

describe('the dashboard parameters', () => {
  const q = (s: string) => new URLSearchParams(s)
  it('defaults to the last 14 days', () => expect(parseParams(q(''), '2026-11-16')).toEqual({ from: '2026-11-03', to: '2026-11-16', country: '' }))
  it('rejects bad input', () => {
    for (const s of ['from=2026-13-01', 'from=nope', 'from=2026-11-05&to=2026-11-01', 'country=USA', "country=a'b", 'from=1990-01-01&to=2026-11-16', 'to=bad', 'to=2026-02-30']) expect(typeof parseParams(q(s), '2026-11-16'), s).toBe('string')
    expect(parseParams(q('country=mx'), '2026-11-16')).toMatchObject({ country: 'MX' })
  })
})

// Access: a real RSA key signs test tokens; the JWKS fetch is injected.
const AUD = 'aud-123', TEAM = 'yusuf.cloudflareaccess.com', ENV: AccessEnv = { ACCESS_AUD: AUD, ACCESS_TEAM_DOMAIN: TEAM, DASHBOARD_EMAILS: 'me@example.com, other@example.com' }
const enc = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
async function keys() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' } as Jwk
  const sign = async (claims: Record<string, unknown>, kp = pair.privateKey, kid = 'k1', alg = 'RS256') => {
    const head = enc({ alg, kid }), body = enc({ iss: 'https://' + TEAM, aud: [AUD], email: 'me@example.com', exp: Math.floor(Date.now() / 1000) + 600, ...claims })
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp, new TextEncoder().encode(head + '.' + body))
    return head + '.' + body + '.' + Buffer.from(sig).toString('base64url')
  }
  return { jwk, sign, jwks: async () => ({ keys: [jwk] }) }
}

describe('the Access gate', () => {
  it('accepts a valid token for an allowed email (case-insensitive)', async () => {
    const k = await keys()
    expect(await verifyAccess(await k.sign({}), ENV, k.jwks)).toBe('me@example.com')
    expect(await verifyAccess(await k.sign({ email: 'Other@Example.com' }), ENV, k.jwks)).toBe('other@example.com')
  })
  it('rejects everything else', async () => {
    const k = await keys(), other = await keys()
    const bad: [string, string | null][] = [
      ['no token', null], ['garbage', 'a.b.c'], ['wrong aud', await k.sign({ aud: ['nope'] })], ['wrong iss', await k.sign({ iss: 'https://evil.cloudflareaccess.com' })],
      ['email not allowed', await k.sign({ email: 'eve@example.com' })], ['no email', await k.sign({ email: undefined })], ['expired', await k.sign({ exp: 1 })],
      ['signed by another key', await k.sign({}, (await other.sign({}), (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])).privateKey))],
      ['unknown kid', await k.sign({}, undefined, 'k2')],
      ['not yet valid', await k.sign({ nbf: Math.floor(Date.now() / 1000) + 3600 })],
      ['no exp', await k.sign({ exp: undefined })],
      ['alg not RS256 (validly signed)', await k.sign({}, undefined, 'k1', 'RS512')], ['alg none', await k.sign({}, undefined, 'k1', 'none')],
    ]
    for (const [name, t] of bad) expect(await verifyAccess(t, ENV, k.jwks), name).toBeNull()
    const ok = await k.sign({})
    for (const missing of ['ACCESS_AUD', 'ACCESS_TEAM_DOMAIN', 'DASHBOARD_EMAILS'] as const) expect(await verifyAccess(ok, { ...ENV, [missing]: '' }, k.jwks), missing).toBeNull()
    expect(await verifyAccess(ok, { ...ENV, ACCESS_TEAM_DOMAIN: 'evil.example.com' }, k.jwks)).toBeNull()
    expect(await verifyAccess(ok, ENV, async () => { throw new Error('down') })).toBeNull()
  })
})

describe('the Worker routes', () => {
  const db = { prepare: vi.fn(() => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) })), batch: vi.fn(async (s: unknown[]) => s.map(() => ({ results: [] }))) }
  const call = async (path: string, init: RequestInit, token?: string, env: Record<string, unknown> = { ...ENV }, jwks = async () => ({ keys: [] as Jwk[] })) => {
    const headers = new Headers(init.headers); if (token) headers.set('cf-access-jwt-assertion', token)
    return worker.fetch(new Request('https://stats.yusuftaleb.com' + path, { ...init, headers }), { DB: db, SALT_SECRET: 's', ...env } as never, undefined, jwks)
  }
  it('answers 404 on /dashboard and /dashboard/data without a valid token, wrong aud, or a disallowed email', async () => {
    const k = await keys()
    for (const path of ['/dashboard', '/dashboard/', '/dashboard/data?from=2026-11-01&to=2026-11-02']) {
      for (const [t, c] of [[undefined, 'none'], [await k.sign({ aud: ['x'] }), 'aud'], [await k.sign({ email: 'eve@example.com' }), 'email']] as const) {
        const r = await call(path, { method: 'GET' }, t, { ...ENV }, k.jwks)
        expect([path, c, r.status]).toEqual([path, c, 404])
      }
    }
    expect((await call('/dashboard', { method: 'GET' }, await k.sign({}), {}, k.jwks)).status).toBe(404) // env missing: fail closed
    expect(db.batch).not.toHaveBeenCalled()
  })
  it('serves the page and the data to an allowed email', async () => {
    const k = await keys(), t = await k.sign({})
    const page = await call('/dashboard', { method: 'GET' }, t, { ...ENV }, k.jwks)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('<title>Everybird stats</title>')
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/) // self-contained: no CDN, no fonts
    expect(html.length).toBeLessThan(60_000)
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(m[1])).not.toThrow() // the inline JS parses (eslint and tsc don't see it)
    const data = await call('/dashboard/data?from=2026-11-01&to=2026-11-14&country=mx', { method: 'GET' }, t, { ...ENV }, k.jwks)
    expect(data.status).toBe(200)
    expect(data.headers.get('cache-control')).toBe('private, max-age=60')
    expect(await data.json()).toMatchObject({ range: { from: '2026-11-01', country: 'MX' } })
    expect((await call('/dashboard/data?from=bad', { method: 'GET' }, t, { ...ENV }, k.jwks)).status).toBe(400)
    expect((await call('/dashboard/other', { method: 'GET' }, t, { ...ENV }, k.jwks)).status).toBe(404)
    expect((await call('/dashboard', { method: 'POST' }, t, { ...ENV }, k.jwks)).status).toBe(404)
  })
  it('leaves POST /e and CORS as they were', async () => {
    const opt = await call('/e', { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } })
    expect([opt.status, opt.headers.get('access-control-allow-origin'), opt.headers.get('access-control-allow-methods')]).toEqual([204, 'http://localhost:3000', 'POST, OPTIONS'])
    const nf = await call('/nope', { method: 'GET' })
    expect([nf.status, await nf.text(), nf.headers.get('access-control-allow-origin')]).toEqual([404, 'not found', 'https://everybird.yusuftaleb.com'])
    const bad = await call('/e', { method: 'POST', body: '{"n":"nope","p":"x"}', headers: { origin: 'https://everybird.yusuftaleb.com' } })
    expect(bad.status).toBe(204)
    expect((await call('/e', { method: 'POST', body: '{"n":"visit","p":"landing"}', headers: { origin: 'https://evil.example' } })).status).toBe(204)
    const ok = await call('/e', { method: 'POST', body: '{"n":"visit","p":"landing"}', headers: { origin: 'https://everybird.yusuftaleb.com' } })
    expect([ok.status, ok.headers.get('access-control-allow-origin')]).toEqual([204, 'https://everybird.yusuftaleb.com'])
    expect(db.prepare).toHaveBeenCalled() // the insert path ran
  })
})

// The page's pure functions: the same string the page inlines.
type HashState = { days: number; all: boolean; country: string; metric: string; compare: boolean }
const lib = new Function(PURE_JS + '; return { parseHash, serializeHash, buildCsv, safeClaim, pct, perPerson, deltaInfo }')() as {
  parseHash(h: string): HashState
  serializeHash(s: HashState): string
  buildCsv(days: Record<string, number | string>[], country: string): string
  safeClaim(n: number, what: string): string
  pct(a: number, b: number): string
  perPerson(a: number, b: number): string
  deltaInfo(v: number, p: number): { dir: string; pct: number }
}

describe('the dashboard hash state', () => {
  const def = { days: 14, all: false, country: '', metric: 'people', compare: false }
  it('parses defaults and every field', () => {
    expect(lib.parseHash('')).toEqual(def)
    expect(lib.parseHash('#r=7&c=mx&m=collages&cmp=1')).toEqual({ days: 7, all: false, country: 'MX', metric: 'collages', compare: true })
    expect(lib.parseHash('#r=all&cmp=1')).toEqual({ ...def, all: true }) // no compare on All
  })
  it('ignores anything invalid', () => {
    expect(lib.parseHash('#r=99&c=USA&m=<script>&cmp=yes&x=1')).toEqual(def)
    expect(lib.parseHash('#c=%3Cb%3E&&=&r')).toEqual(def)
  })
  it('serializes without defaults and round-trips', () => {
    expect(lib.serializeHash(def)).toBe('')
    const s = { days: 30, all: false, country: 'US', metric: 'shares', compare: true }
    expect(lib.serializeHash(s)).toBe('#r=30&c=US&m=shares&cmp=1')
    expect(lib.parseHash(lib.serializeHash(s))).toEqual(s)
    expect(lib.serializeHash({ ...def, all: true, compare: true })).toBe('#r=all')
    expect(lib.serializeHash({ ...def, days: 1 })).toBe('#r=1')
  })
})

describe('the CSV export', () => {
  const head = 'date,country,people,collages,images,poster_downloads,downloads,shares,posters\n'
  it('writes a header and one row per day', () => {
    const csv = lib.buildCsv([{ d: '2026-11-04', people: 2, collages: 2, images: 1, posterDownloads: 1, downloads: 2, shares: 0, posters: 0 }, { d: '2026-11-05', people: 2 }], '')
    expect(csv).toBe(head + '2026-11-04,all,2,2,1,1,2,0,0\n2026-11-05,all,2,0,0,0,0,0,0\n')
    expect(lib.buildCsv([{ d: '2026-11-04' }], 'MX').split('\n')[1]).toBe('2026-11-04,MX,0,0,0,0,0,0,0')
  })
  it('quotes cells that need it', () => {
    expect(lib.buildCsv([{ d: 'a,"b"' }], '').split('\n')[1].startsWith('"a,""b""",all')).toBe(true)
    expect(lib.buildCsv([], '')).toBe(head)
  })
})

describe('the safe claim', () => {
  it('rounds down and stays strictly below the count', () => {
    expect(lib.safeClaim(1234, 'collages made')).toBe('More than 1,200 collages made.')
    expect(lib.safeClaim(1200, 'x')).toBe('More than 1,100 x.')
    expect(lib.safeClaim(56789, 'x')).toBe('More than 56,000 x.')
    expect(lib.safeClaim(101, 'x')).toBe('More than 100 x.')
    expect(lib.safeClaim(100, 'x')).toBe('More than 90 x.')
    expect(lib.safeClaim(57, 'x')).toBe('More than 50 x.')
    expect(lib.safeClaim(11, 'x')).toBe('More than 10 x.')
    expect(lib.safeClaim(3, 'x')).toBe('More than 2 x.')
    for (const n of [3, 9, 10, 11, 99, 100, 101, 999, 1000, 1001, 123456, 1000000]) expect(Number(/More than ([\d,]+)/.exec(lib.safeClaim(n, 'x'))![1].replace(/,/g, ''))).toBeLessThan(n)
  })
  it('makes no claim for tiny or bad counts', () => {
    for (const n of [0, 1, 2, -5, NaN]) expect(lib.safeClaim(n, 'x')).toBe('')
  })
})

describe('rates and changes', () => {
  it('formats shares and ratios', () => {
    expect(lib.pct(1, 3)).toBe('33%'); expect(lib.pct(1, 20)).toBe('5.0%'); expect(lib.pct(0, 5)).toBe('0.0%'); expect(lib.pct(1, 0)).toBe('–')
    expect(lib.perPerson(5, 4)).toBe('1.25'); expect(lib.perPerson(1, 0)).toBe('–')
  })
  it('classifies the change against the previous period', () => {
    expect(lib.deltaInfo(12, 10)).toEqual({ dir: 'up', pct: 20 }); expect(lib.deltaInfo(5, 10)).toEqual({ dir: 'down', pct: 50 })
    expect(lib.deltaInfo(10, 10)).toEqual({ dir: 'flat', pct: 0 }); expect(lib.deltaInfo(3, 0)).toEqual({ dir: 'new', pct: 0 }); expect(lib.deltaInfo(0, 0)).toEqual({ dir: 'none', pct: 0 })
  })
})
