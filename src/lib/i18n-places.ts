// Country names in the UI language: the one place the app reads Intl (GLOSSARY.md "Country names"). Province and
// county names stay the data's local names. English always reads regions.v1.json, so build-geo's REGION_RENAMES hold.
// Display only: imports, matching, the store, the CSV and share images keep the English regions.
import { HTML_LANG, type Lang } from '@/i18n/langs'
import { stripBracket } from '@/lib/import/places'
import type { Regions } from '@/lib/species/types'

const names = new Map<Lang, Intl.DisplayNames | null>()

/** The language's region names, made once per language; null where the engine has none. */
function displayNames(lang: Lang): Intl.DisplayNames | null {
  if (!names.has(lang)) {
    let d: Intl.DisplayNames | null = null
    try {
      d = new Intl.DisplayNames(HTML_LANG[lang], { type: 'region', fallback: 'code' })
    } catch {
      d = null
    }
    names.set(lang, d)
  }
  return names.get(lang)!
}

/** `regions`' English name (brackets stripped), else the code. */
function english(code: string, regions: Pick<Regions, 'countries'>): string {
  const n = regions.countries[code]
  return n ? stripBracket(n) : code
}

/**
 * A country's name in `lang`: Intl.DisplayNames ("CA" -> "Canadá" in es); the English name from `regions` when the
 * engine doesn't know the code (it answers with the code itself) or throws. English is always `regions`' name.
 */
export function countryName(code: string, lang: Lang, regions: Pick<Regions, 'countries'>): string {
  if (lang === 'en') return english(code, regions)
  const d = displayNames(lang)
  if (!d) return english(code, regions)
  try {
    const n = d.of(code)
    return n && n !== code ? n : english(code, regions)
  } catch {
    return english(code, regions)
  }
}

const localized = new WeakMap<object, Map<Lang, Regions>>()

/**
 * `regions` with its countries named in `lang` (countryName), for display: everything that names a country from
 * `regions.countries` (the card's place line, the Places panel, the Places button) then speaks the language. English
 * returns `regions` itself. Made once per regions object and language.
 */
export function regionsIn<R extends Regions>(regions: R, lang: Lang): R {
  if (lang === 'en') return regions
  let byLang = localized.get(regions)
  if (!byLang) localized.set(regions, (byLang = new Map()))
  let out = byLang.get(lang) as R | undefined
  if (!out) {
    const countries: Record<string, string> = {}
    for (const code of Object.keys(regions.countries)) countries[code] = countryName(code, lang, regions)
    out = { ...regions, countries }
    byLang.set(lang, out)
  }
  return out
}
