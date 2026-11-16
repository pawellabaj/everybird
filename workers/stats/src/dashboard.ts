// The private dashboard's numbers: a handful of GROUP BY queries over a day range, returned as aggregates only
// (never a row or a vid). People = distinct vid per day; vids rotate daily, so ranges are shown as daily series and
// as "person-days" (distinct day + vid pairs), never as a sum of unique people. Pure: tests run these statements on node:sqlite.

export type Stmt = { sql: string; binds: (string | number)[] }
export type Row = Record<string, string | number | null>
export type Params = { from: string; to: string; country: string }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const ms = (d: string) => Date.parse(d + 'T00:00:00Z')
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => iso(ms(d) + n * 86_400_000)
export const MAX_DAYS = 3660

/** Validates ?from=&to=&country=; defaults to the last 14 UTC days. Returns an error message for a bad one. */
export function parseParams(q: URLSearchParams, today: string): Params | string {
  const to = q.get('to') ?? today
  const from = q.get('from') ?? addDays(to, -13)
  const country = (q.get('country') ?? '').toUpperCase()
  for (const d of [from, to]) if (!DAY.test(d) || Number.isNaN(ms(d)) || iso(ms(d)) !== d) return 'bad date'
  if (from > to) return 'from is after to'
  if ((ms(to) - ms(from)) / 86_400_000 > MAX_DAYS) return 'range too long'
  if (country && !/^[A-Z]{2}$/.test(country)) return 'bad country'
  return { from, to, country }
}

const PD = "COUNT(DISTINCT day || '|' || NULLIF(vid, ''))" // person-days; rows from before the Worker had ids carry ''
const VID = "COUNT(DISTINCT NULLIF(vid, ''))"

/** The statements, in the order shape() reads them. The previous period is the equal-length span just before `from`. */
export function statements(p: Params): Stmt[] {
  const len = (ms(p.to) - ms(p.from)) / 86_400_000 + 1
  const prevFrom = addDays(p.from, -len)
  const c = p.country ? ' AND country = ?' : ''
  const cb = p.country ? [p.country] : []
  const wide = [prevFrom, p.to, ...cb]
  const cur = [p.from, p.to, ...cb]
  const w = 'WHERE day BETWEEN ? AND ?'
  return [
    { sql: `SELECT day, name, COUNT(*) AS n FROM events ${w}${c} GROUP BY day, name`, binds: wide },
    { sql: `SELECT day, ${VID} AS people FROM events ${w}${c} GROUP BY day`, binds: wide },
    { sql: `SELECT name, value, COUNT(*) AS n, ${PD} AS pd FROM events ${w}${c} GROUP BY name, value`, binds: cur },
    { sql: `SELECT CASE WHEN name IN ('image_downloaded', 'poster_downloaded') THEN 'downloaded' ELSE name END AS step, ${PD} AS pd FROM events ${w}${c} GROUP BY step`, binds: cur },
    { sql: `SELECT country, COUNT(*) AS n, ${PD} AS pd FROM events ${w} GROUP BY country ORDER BY pd DESC, country`, binds: [p.from, p.to] },
    { sql: `SELECT device, ${PD} AS pd FROM events ${w}${c} GROUP BY device ORDER BY pd DESC`, binds: cur },
    { sql: `SELECT lang, ${PD} AS pd FROM events ${w} AND name = 'visit' AND lang <> ''${c} GROUP BY lang ORDER BY pd DESC`, binds: cur },
    { sql: 'SELECT MIN(day) AS d FROM events', binds: [] },
  ]
}

const METRICS = { collages: ['collage_made'], downloads: ['image_downloaded', 'poster_downloaded'], shares: ['shared'], posters: ['poster_made'], posterDownloads: ['poster_downloaded'], images: ['image_downloaded'] } as const
type Metric = keyof typeof METRICS
const num = (v: unknown) => Number(v ?? 0)

/** The JSON the page draws. `results` are the rows of statements(p), in order. */
export function shape(p: Params, results: Row[][], now = new Date()) {
  const [daily, people, values, steps, countries, devices, langs, min] = results
  const first = (min?.[0]?.d as string | null | undefined) ?? null
  const from = first && first > p.from ? (first > p.to ? p.to : first) : p.from
  const len = (ms(p.to) - ms(p.from)) / 86_400_000 + 1
  const prevFrom = addDays(p.from, -len), prevTo = addDays(p.from, -1)
  const perDay = new Map<string, Record<string, number>>()
  for (const r of daily) { const d = perDay.get(r.day as string) ?? {}; d[r.name as string] = num(r.n); perDay.set(r.day as string, d) }
  const peopleOn = new Map(people.map((r) => [r.day as string, num(r.people)]))
  const sum = (a: string, b: string, names: readonly string[]) => {
    let t = 0
    for (const [d, m] of perDay) if (d >= a && d <= b) for (const n of names) t += m[n] ?? 0
    return t
  }
  const tiles = {} as Record<Metric, { value: number; prev: number }>
  for (const k of Object.keys(METRICS) as Metric[]) tiles[k] = { value: sum(p.from, p.to, METRICS[k]), prev: sum(prevFrom, prevTo, METRICS[k]) }
  const days: { d: string; people: number; collages: number; downloads: number; shares: number; posters: number }[] = []
  for (let d = from; d <= p.to; d = addDays(d, 1)) {
    days.push({ d, people: peopleOn.get(d) ?? 0, collages: sum(d, d, METRICS.collages), downloads: sum(d, d, METRICS.downloads), shares: sum(d, d, METRICS.shares), posters: sum(d, d, METRICS.posters) })
  }
  const by = (name: string) => values.filter((r) => r.name === name).map((r) => ({ k: r.value as string, n: num(r.n) })).sort((a, b) => b.n - a.n)
  const step = (s: string) => num(steps.find((r) => r.step === s)?.pd)
  const visit = (v: string) => num(values.find((r) => r.name === 'visit' && r.value === v)?.pd)
  return {
    generatedAt: now.toISOString(),
    range: { from, to: p.to, country: p.country, prevFrom, prevTo, days: days.length },
    tiles: { peopleLast: { value: peopleOn.get(p.to) ?? 0, prev: peopleOn.get(addDays(p.to, -1)) ?? 0, day: p.to }, ...tiles },
    days,
    funnel: [
      { k: 'landing', n: visit('landing') }, { k: 'settings', n: visit('settings') }, { k: 'collage', n: visit('collage') },
      { k: 'collage_made', n: step('collage_made') }, { k: 'downloaded', n: step('downloaded') },
    ],
    breakdowns: {
      formats: by('image_downloaded'), shareFormats: by('shared'), posterSizes: by('poster_made'), filters: by('filter_used'),
      search: by('search_applied'), uiLanguages: by('ui_language'),
      browserLanguages: langs.map((r) => ({ k: r.lang as string, n: num(r.pd) })),
      devices: devices.map((r) => ({ k: r.device as string, n: num(r.pd) })),
      countries: countries.map((r) => ({ k: r.country as string, n: num(r.pd) })),
    },
  }
}
