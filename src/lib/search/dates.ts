import { searchKey } from '../species/name-search'
import type { SearchLang } from './groups'

/** Month precision only; bounds are inclusive, matching Everybird's timeline. */
export type Period = { from?: string; to?: string; n: number; invalid?: boolean }
export type SearchWord = { key: string; raw: string; start: number; end: number; quoted: boolean }
const words = (s: string) => s.split('|').map(searchKey)
const DICT = {
  en: { link: 'to|through|thru|until|till', between: 'between', and: 'and', from: 'from', since: 'since', after: 'after', before: 'before', until: 'until', this: 'this', last: 'last|past', year: 'year|years', month: 'month|months', quarter: 'quarter|quarters' },
  es: { link: 'a|hasta', between: 'entre', and: 'y', from: 'de|desde', since: 'desde', after: 'después de', before: 'antes de', until: 'hasta', this: 'este|esta', last: 'último|últimos|última|últimas|pasado', year: 'año|años', month: 'mes|meses', quarter: 'trimestre|trimestres' },
  pt: { link: 'a|até', between: 'entre', and: 'e', from: 'de|desde', since: 'desde', after: 'depois de|após', before: 'antes de', until: 'até', this: 'este|esta', last: 'último|últimos|última|últimas|passado', year: 'ano|anos', month: 'mês|meses', quarter: 'trimestre|trimestres' },
  nl: { link: 'tot|tot en met', between: 'tussen', and: 'en', from: 'van|vanaf', since: 'sinds|vanaf', after: 'na', before: 'voor', until: 'tot', this: 'dit|deze', last: 'laatste|vorige|vorig|afgelopen', year: 'jaar|jaren', month: 'maand|maanden', quarter: 'kwartaal|kwartalen' },
} as const
export const SEARCH_CONNECTORS: Record<SearchLang, string[]> = {
  en: ['in', 'on', 'at', 'from', 'and'], es: ['en', 'de', 'desde', 'y'], pt: ['em', 'no', 'na', 'de', 'do', 'da', 'e'], nl: ['in', 'uit', 'van', 'en'],
}
const month = (y: number, m: number) => {
  const at = new Date(Date.UTC(y, m, 1))
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`
}
const year = (s?: string) => !!s && /^(19|20)\d{2}$/.test(s)

/** Date vocabulary and Intl month names are prepared once per parse; never reads the clock. */
export function dateParser(today: Date, lang: SearchLang) {
  const y = today.getFullYear(), mo = today.getMonth()
  const now = month(y, mo)
  const months = new Map<string, number>()
  for (const locale of new Set(['en', lang])) {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    for (let m = 0; m < 12; m++) months.set(searchKey(fmt.format(new Date(Date.UTC(2020, m, 1)))), m)
  }
  const monthOf = (s: string) => {
    if (s.length < 3) return undefined
    const hits = new Set([...months].filter(([name]) => name.startsWith(s)).map(([, m]) => m))
    return hits.size === 1 ? [...hits][0] : undefined
  }
  type Point = { y: number; m: number; end: number; explicit: boolean; n: number }
  return (tokens: readonly SearchWord[], i: number): Period | undefined => {
    const keys = tokens.map((t) => t.quoted ? '' : t.key)
    const raw = tokens.map((t) => t.quoted ? '' : t.raw.toLowerCase())
    const is = (key: keyof typeof DICT.en, at: number): number => {
      for (const locale of new Set([lang, 'en'] as const)) {
        for (const phrase of words(DICT[locale][key]).sort((a, b) => b.length - a.length)) {
          const seq = phrase.split(' ')
          if (seq.every((s, j) => keys[at + j] === s)) return seq.length
        }
      }
      return 0
    }
    const point = (at: number): Point | undefined => {
      const iso = /^(19\d{2}|20\d{2})-(0[1-9]|1[0-2])(?:-(\d{2}))?$/.exec(raw[at] ?? '')
      if (iso) {
        const yr = Number(iso[1]), m = Number(iso[2]) - 1
        if (iso[3] && (Number(iso[3]) < 1 || Number(iso[3]) > new Date(Date.UTC(yr, m + 1, 0)).getUTCDate())) return undefined
        return { y: yr, m, end: m, explicit: true, n: 1 }
      }
      const m = monthOf(keys[at] ?? '')
      if (m !== undefined) {
        // Spanish/Portuguese "octubre de 2026" as well as "oct 2026".
        const de = (lang === 'es' || lang === 'pt') && keys[at + 1] === 'de' ? 1 : 0
        const explicit = year(keys[at + 1 + de])
        return { y: explicit ? Number(keys[at + 1 + de]) : y, m, end: m, explicit, n: explicit ? 2 + de : 1 }
      }
      if (year(keys[at])) return { y: Number(keys[at]), m: 0, end: 11, explicit: true, n: 1 }
    }
    const lead = is('from', i) || is('between', i)
    const a = point(i + lead)
    if (a) {
      const edge = i + lead + a.n
      const link = /^[-–—/]$/.test(raw[edge] ?? '') ? 1 : is('link', edge) || (is('between', i) ? is('and', edge) : 0)
      const b = link ? point(edge + link) : undefined
      if (b) {
        // An explicit end year anchors an implicit start; an explicit start anchors an implicit end.
        if (!b.explicit) b.y = a.explicit ? a.y + (b.end < a.m ? 1 : 0) : y - (b.end > mo ? 1 : 0)
        if (!a.explicit) a.y = b.y - (a.m > b.end ? 1 : 0)
        const from = month(a.y, a.m), to = month(b.y, b.end)
        if (from <= to) return { from, to, n: lead + a.n + link + b.n }
        return { n: lead + a.n + link + b.n, invalid: true }
      }
    }
    for (const kind of ['since', 'after', 'before', 'until'] as const) {
      const n = is(kind, i)
      const p = n ? point(i + n) : undefined
      if (!p) continue
      if (!p.explicit && p.m > mo) p.y--
      if (kind === 'since' || kind === 'after') {
        const from = month(p.y, kind === 'after' ? p.end + 1 : p.m)
        if (from > now) return undefined
        return { from, to: now, n: n + p.n }
      }
      return { to: month(p.y, kind === 'before' ? p.m - 1 : p.end), n: n + p.n }
    }
    if ((lang === 'es' || lang === 'pt') && is('year', i) && is('last', i + 1)) {
      return { from: month(y - 1, 0), to: month(y - 1, 11), n: 2 }
    }
    if ((lang === 'es' || lang === 'pt') && is('month', i) && is('last', i + 1)) {
      return { from: month(y, mo - 1), to: month(y, mo - 1), n: 2 }
    }
    const back = is('last', i), current = is('this', i)
    if (back || current) {
      const start = i + (back || current)
      const count = /^\d+$/.test(keys[start] ?? '') ? Number(keys[start]) : undefined
      const unitAt = start + (count === undefined ? 0 : 1)
      const unit = is('year', unitAt) ? 'year' : is('month', unitAt) ? 'month' : is('quarter', unitAt) ? 'quarter' : undefined
      if (unit && count === undefined) {
        if (unit === 'year') return { from: month(y - (back ? 1 : 0), 0), to: month(y - (back ? 1 : 0), 11), n: unitAt - i + 1 }
        const width = unit === 'quarter' ? 3 : 1
        const first = Math.floor(mo / width) * width - (back ? width : 0)
        return { from: month(y, first), to: month(y, first + width - 1), n: unitAt - i + 1 }
      }
      if (back && unit && count && count <= 1200) {
        const width = unit === 'year' ? 12 : unit === 'quarter' ? 3 : 1
        // Whole calendar months, including the current one: last 3 months in November = Sep..Nov.
        return { from: month(y, mo - count * width + 1), to: now, n: unitAt - i + 1 }
      }
    }
    const q = /^q([1-4])$/.exec(keys[i] ?? '')
    if (q) {
      const yr = year(keys[i + 1]) ? Number(keys[i + 1]) : y
      const first = (Number(q[1]) - 1) * 3
      return { from: month(yr, first), to: month(yr, first + 2), n: year(keys[i + 1]) ? 2 : 1 }
    }
    // Reversed explicit spans remain text as a whole rather than turning into two unrelated dates.
    const p = point(i)
    if (!p) return undefined
    if (!p.explicit && p.m > mo) p.y--
    return { from: month(p.y, p.m), to: month(p.y, p.end), n: p.n }
  }
}
