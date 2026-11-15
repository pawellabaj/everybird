import type { Place } from '@/lib/list/model'
import type { Regions } from '@/lib/species/types'
import { foldName } from '@/lib/species/resolve'
import { SUB1_ALIASES, sub1Names } from './inat'

export const OBSORG_NAME_LANGS = ['nl', 'en', 'fr', 'de', 'es'] as const

/** Generic country spellings not supplied by Intl.DisplayNames (folded name -> ISO2). */
export const OBSORG_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  // Long Dutch territory names; Intl uses shorter names for SH and a different spelling for GS.
  'sint-helena, ascension en tristan da cunha': 'SH',
  'zuid-georgie en de zuidelijke sandwicheilanden': 'GS',
}

/** Local province names; scoped to their country, never used as fuzzy matches. */
export const OBSORG_SUB1_ALIASES: Record<string, string[]> = {
  'NL-NH': ['Noord-Holland'],
  'NL-ZH': ['Zuid-Holland'],
  'NL-NB': ['Noord-Brabant'],
  'BE-VAN': ['Antwerpen'],
  'BE-VBR': ['Vlaams-Brabant'],
  'BE-VOV': ['Oost-Vlaanderen'],
  'BE-VWV': ['West-Vlaanderen'],
  'BE-BRU': ['Brussel', 'Brussels Hoofdstedelijk Gewest', 'Bruxelles'],
  'BE-WBR': ['Waals-Brabant', 'Brabant wallon'],
  'BE-WHT': ['Henegouwen'],
  'BE-WLG': ['Luik'],
  'BE-WLX': ['Luxemburg'],
  'BE-WNA': ['Namen'],
  'PE-CUS': ['Cusco', 'Cuzco'],
  'DE-BY': ['Beieren'],
}

/** Reverse the regions' English names and Intl country names; ambiguous folded names never resolve. */
export function countryNameMap(regions: Regions, langs: readonly string[] = OBSORG_NAME_LANGS): Map<string, string> {
  const names = new Map<string, string>()
  const collisions = new Set<string>()
  const add = (name: string, code: string) => {
    const key = foldName(name)
    if (!key || collisions.has(key)) return
    const previous = names.get(key)
    if (previous && previous !== code) {
      names.delete(key)
      collisions.add(key)
    } else names.set(key, code)
  }
  for (const [code, name] of Object.entries(regions.countries)) add(name, code)
  for (const lang of langs) {
    const displayNames = new Intl.DisplayNames([lang], { type: 'region' })
    for (const code of Object.keys(regions.countries)) {
      const name = displayNames.of(code)
      if (name) add(name, code)
    }
  }
  for (const [name, code] of Object.entries(OBSORG_COUNTRY_ALIASES)) if (regions.countries[code]) add(name, code)
  return names
}

const divisionName = (name: string) => foldName(name.replace(/\s*\([^()]*\)\s*$/, ''))

/** Resolve and cache raw pairs for one parse. Only ISO country/sub1 codes leave the resolver; no counties. */
export function makeObsOrgPlaces(regions: Regions): (country: string, division: string) => Place | undefined {
  const countries = countryNameMap(regions)
  const sub1 = new Map<string, string>()
  for (const [code, name] of Object.entries(regions.sub1)) {
    const country = code.split('-')[0]
    for (const n of sub1Names(name)) {
      const key = `${country}|${divisionName(n)}`
      if (!sub1.has(key)) sub1.set(key, code)
    }
  }
  for (const aliases of [SUB1_ALIASES, OBSORG_SUB1_ALIASES]) {
    for (const [code, names] of Object.entries(aliases)) {
      if (!regions.sub1[code]) continue
      const country = code.split('-')[0]
      for (const name of names) {
        const key = `${country}|${divisionName(name)}`
        // Explicit aliases select the intended administrative tier (Murcia: ES-MC, not ES-MU).
        sub1.set(key, code)
      }
    }
  }
  const cache = new Map<string, Place | undefined>()
  return (countryName, division) => {
    const key = `${countryName}\u0000${division}`
    if (cache.has(key)) return cache.get(key)
    const country = foldName(countryName) === 'world' ? undefined : countries.get(foldName(countryName))
    let place: Place | undefined
    if (country) {
      const code = sub1.get(`${country}|${divisionName(division)}`)
      place = code ? { country, sub1: code } : { country }
    }
    cache.set(key, place)
    return place
  }
}
