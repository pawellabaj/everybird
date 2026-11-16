// Local bird names: which names file a visitor gets (pickNameLocale), loading it, and the one place every display
// site reads a name from (displayName / familyName). English has no file. The names are display only: import
// matching, links and backups stay English and scientific. "Show bird names in English" (localStorage
// `everybird:en-names`, per device) makes every display site show English again.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { fetchData } from '@/lib/data-url'
import type { DataFile } from '@/lib/data-files'
import type { ListEntry } from '@/lib/list/model'
import { useI18n } from '@/i18n/I18nProvider'
import { primarySubtag, type Lang } from '@/i18n/langs'
import { familyLang, REGION_LOCALE, type NameLocale } from './name-locales'
import type { SpeciesRow } from './types'

/** A names file (public/data/names.<locale>.v1.json): only names that differ from English, the base's chain baked in. */
export type NameSet = { v: 1; locale: NameLocale; taxonomy: string; names: Record<string, string>; fam: Record<string, string> }

/** The 2-letter region of a BCP 47 tag ("es-MX" -> "MX", "zh-Hant-TW" -> "TW"), if any. */
function regionOf(tag: string): string | undefined {
  return tag.split(/[-_]/).slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase()
}

/** A region's name set, only when it belongs to the UI language's family (a Spanish UI never gets pt names for BR). */
function regional(lang: Lang, region: string | undefined): NameLocale | null {
  const l = region ? REGION_LOCALE[region] : undefined
  return l && familyLang(l) === lang ? l : null
}

/**
 * The names file for a UI language: the browser's region (the first of `languages` in this language) when it maps to
 * a set of this language, else the list's top country when it does, else the base (es, pt_BR, nl). English: null.
 */
export function pickNameLocale(lang: Lang, languages: readonly string[], top?: string): NameLocale | null {
  if (lang === 'en') return null
  if (lang === 'nl') return 'nl'
  const tag = languages.find((t) => primarySubtag(t) === lang)
  return regional(lang, tag ? regionOf(tag) : undefined) ?? regional(lang, top) ?? (lang === 'es' ? 'es' : 'pt_BR')
}

/** The country with the most species by lifer place (ties: alphabetical); undefined with none. */
export function topCountry(list: readonly ListEntry[]): string | undefined {
  const n = new Map<string, number>()
  for (const e of list) {
    const c = e.place?.country
    if (c) n.set(c, (n.get(c) ?? 0) + 1)
  }
  let best: string | undefined
  for (const [c, k] of n) if (best === undefined || k > n.get(best)! || (k === n.get(best) && c < best)) best = c
  return best
}

const loaded = new Map<NameLocale, Promise<NameSet>>()
/** A locale's names, fetched once (a failure is not cached: English keeps showing and the next call retries). */
export function loadNames(l: NameLocale): Promise<NameSet> {
  let p = loaded.get(l)
  if (!p) {
    p = fetchData<NameSet>(`names.${l}.v1.json` as DataFile)
    loaded.set(l, p)
    const mine = p
    mine.catch(() => { if (loaded.get(l) === mine) loaded.delete(l) })
  }
  return p
}

// --- state: the current set and the English switch, one version for both ---
export const EN_NAMES_KEY = 'everybird:en-names'
let current: NameSet | null = null
let version = 0
let enMemory: boolean | null = null // this page's value when storage refuses a write
let enCache: boolean | null = null
const listeners = new Set<() => void>()
const bump = () => { version++; for (const f of listeners) f() }

export function setNames(set: NameSet | null): void {
  if (set === current) return
  current = set
  bump()
}
export const namesVersion = (): number => version

/** Whether bird names show in English on this device (the switch). */
export function englishNames(): boolean {
  if (enMemory !== null) return enMemory
  if (enCache === null) {
    try {
      enCache = localStorage.getItem(EN_NAMES_KEY) === '1'
    } catch {
      enCache = false
    }
  }
  return enCache
}
export function setEnglishNames(on: boolean): void {
  try {
    if (on) localStorage.setItem(EN_NAMES_KEY, '1')
    else localStorage.removeItem(EN_NAMES_KEY)
    enMemory = null
  } catch {
    enMemory = on
  }
  enCache = null
  bump()
}

function subscribe(f: () => void): () => void {
  enCache = null // a mount re-reads storage (it may have changed while nothing listened)
  listeners.add(f)
  const onStorage = (e: StorageEvent) => { if (e.key === EN_NAMES_KEY || e.key === null) { enCache = null; bump() } }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(f)
    window.removeEventListener('storage', onStorage)
  }
}

/** Re-render when the names change (a set arrives, the locale changes, the switch flips); returns the version. */
export function useNames(): number {
  return useSyncExternalStore(subscribe, namesVersion, () => 0)
}
/** The English switch's value for a component: off on the server and while hydrating, then stored. */
export function useEnNames(): boolean {
  return useSyncExternalStore(subscribe, englishNames, () => false)
}

/** Show a set only when no names are loaded yet (the sample's own names until the names file arrives). */
export function seedNames(set: NameSet): void {
  if (!current) setNames(set)
}

/** A species' name to show: English when the switch is on, no set is loaded or the code isn't in it, else the local name. */
export function displayName(r: Pick<SpeciesRow, 'code' | 'com'>): string {
  if (!current || englishNames()) return r.com
  return current.names[r.code] ?? r.com
}
/** The local name only (undefined when none applies), for search. */
export function localName(code: string): string | undefined {
  return current && !englishNames() ? current.names[code] : undefined
}
/**
 * Load the names for the UI language, the browser's languages and the list's top country (recomputed when the list
 * changes), and make them current. English clears them. A failed load leaves what showed before (English).
 */
export function useLoadNames(list: readonly ListEntry[]): void {
  const { lang } = useI18n()
  const top = useMemo(() => topCountry(list), [list])
  useEffect(() => {
    const l = pickNameLocale(lang, navigator.languages?.length ? navigator.languages : [navigator.language], top)
    if (!l) { setNames(null); return }
    let live = true
    loadNames(l).then((s) => { if (live) setNames(s) }, () => {})
    return () => { live = false }
  }, [lang, top])
}

/** A code's name to show (its row's, else the code), for messages built from codes. */
export function nameOfCode(byCode: { get(code: string): Pick<SpeciesRow, 'code' | 'com'> | undefined }, code: string): string {
  const r = byCode.get(code)
  return r ? displayName(r) : code
}
/** A family's name to show, by the same rule. */
export function familyName(r: Pick<SpeciesRow, 'fam' | 'famCom'>): string {
  if (!current || englishNames()) return r.famCom || r.fam
  return current.fam[r.fam] ?? (r.famCom || r.fam)
}
