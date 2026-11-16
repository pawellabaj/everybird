// Shared name resolution, ported from item 8. Imports can switch to these exports when the branches meet.
import { foldName } from '@/lib/species/resolve'
import type { Regions } from '@/lib/species/types'
import { stripBracket } from '../import/places'

/**
 * Explicit sub1 names, folded on use and tried within their own country only. They come first: an alias is a choice
 * (the eBird subnational1 code where regions.v1.json names two codes alike, or a local spelling of a region
 * build-geo renamed to English), so it wins over any real name. Shared by the iNaturalist and observation.org imports.
 */
export const SUB1_ALIASES: Record<string, string[]> = {
  // ISO 3166-2:AR names the province "Buenos Aires" and the city "Ciudad Autónoma de Buenos Aires"; regions.v1.json
  // calls both "Buenos Aires".
  'AR-B': ['Buenos Aires'],
  'AR-C': ['Ciudad Autónoma de Buenos Aires', 'Ciudad de Buenos Aires'],
  'BE-VLG': ['Vlaanderen', 'Vlaams Gewest', 'Flemish Region'],
  'BE-WAL': ['Wallonie', 'Région wallonne', 'Walloon Region'],
  'CZ-10': ['Prague', 'Praha', 'Hlavní město Praha'],
  // Spain's eBird subnational1 are the autonomous communities; their names also belong to provinces (ES-O, ES-S, ...).
  'ES-AS': ['Asturias', 'Principado de Asturias'],
  'ES-CB': ['Cantabria'],
  'ES-CT': ['Catalunya', 'Cataluña'],
  'ES-IB': ['Balearic Islands', 'Illes Balears', 'Islas Baleares'],
  'ES-MC': ['Murcia', 'Región de Murcia'],
  'ES-MD': ['Community of Madrid', 'Madrid', 'Comunidad de Madrid'],
  'ES-NC': ['Navarre', 'Navarra', 'Comunidad Foral de Navarra'],
  'ES-RI': ['La Rioja'],
  'ES-VC': ['Comunitat Valenciana', 'Comunidad Valenciana', 'Valencia'],
  'FR-973': ['French Guiana', 'Guyane'],
  'US-DC': ['District of Columbia'],
  'US-VI': ['Virgin Islands', 'United States Virgin Islands'],
  'US-WA': ['Washington'],
  // eBird writes mainland China's provinces with GB/T 2260 numbers (build-geo.ts CN_NUMERIC), not ISO letters.
  'CN-11': ['Beijing'], 'CN-12': ['Tianjin'], 'CN-13': ['Hebei'], 'CN-14': ['Shanxi'], 'CN-15': ['Inner Mongolia'],
  'CN-21': ['Liaoning'], 'CN-22': ['Jilin'], 'CN-23': ['Heilongjiang'], 'CN-31': ['Shanghai'], 'CN-32': ['Jiangsu'],
  'CN-33': ['Zhejiang'], 'CN-34': ['Anhui'], 'CN-35': ['Fujian'], 'CN-36': ['Jiangxi'], 'CN-37': ['Shandong'],
  'CN-41': ['Henan'], 'CN-42': ['Hubei'], 'CN-43': ['Hunan'], 'CN-44': ['Guangdong'], 'CN-45': ['Guangxi'],
  'CN-46': ['Hainan'], 'CN-50': ['Chongqing'], 'CN-51': ['Sichuan'], 'CN-52': ['Guizhou'], 'CN-53': ['Yunnan'],
  'CN-54': ['Tibet'], 'CN-61': ['Shaanxi'], 'CN-62': ['Gansu'], 'CN-63': ['Qinghai'], 'CN-64': ['Ningxia'],
  'CN-65': ['Xinjiang'],
}

/** Names a sub1 entry answers to: "Wales [Cymru GB-CYM]" -> "wales"; "Catalunya [Cataluña]" -> "catalunya", "cataluna". */
export function sub1Names(name: string): string[] {
  const out = [foldName(stripBracket(name))]
  const inner = /\[([^\]]*)\]\s*$/.exec(name)?.[1]?.replace(/\s+[A-Z]{2}-[A-Z0-9]+$/, '').trim()
  if (inner) out.push(foldName(inner))
  return out
}

/** A country's sub1 code for a raw name, or undefined (the caller keeps the country only). */
export type Sub1Index = (country: string, name: string) => string | undefined

/**
 * Province and state names to sub1 codes, within one country. Precedence: the alias tables first (earlier tables win),
 * then a real regions.v1.json name that only one code in its country answers to. A real name two or more codes claim
 * (and no alias settles) resolves to nothing, so the place stays the country: never a wrong province. `key` further
 * normalises folded names on both sides (observation.org drops a trailing " (62)").
 */
export function makeSub1Index(
  regions: Regions,
  aliasTables: readonly Record<string, string[]>[] = [SUB1_ALIASES],
  key: (folded: string) => string = (s) => s,
): Sub1Index {
  const byKey = new Map<string, string>()
  const real = new Map<string, string>()
  const dead = new Set<string>()
  for (const [code, name] of Object.entries(regions.sub1)) {
    const country = code.split('-')[0]
    for (const n of new Set(sub1Names(name).map(key))) {
      const k = `${country}|${n}`
      if (!n || dead.has(k)) continue
      const previous = real.get(k)
      if (previous === undefined) real.set(k, code)
      else if (previous !== code) {
        real.delete(k)
        dead.add(k)
      }
    }
  }
  for (const [k, code] of real) byKey.set(k, code)
  const aliased = new Set<string>()
  for (const table of aliasTables) {
    for (const [code, names] of Object.entries(table)) {
      if (!regions.sub1[code]) continue
      const country = code.split('-')[0]
      for (const name of names) {
        const k = `${country}|${key(foldName(name))}`
        if (aliased.has(k)) continue
        aliased.add(k)
        byKey.set(k, code)
      }
    }
  }
  return (country, name) => {
    if (!country || !name.trim()) return undefined
    return byKey.get(`${country}|${key(foldName(stripBracket(name)))}`)
  }
}

export const COUNTRY_NAME_LANGS = ['nl', 'en', 'fr', 'de', 'es', 'pt'] as const

/** Generic country spellings not supplied by Intl.DisplayNames (folded name -> ISO2). */
export const OBSORG_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  usa: 'US', us: 'US', uk: 'GB', uae: 'AE',
  'united states': 'US', 'united kingdom': 'GB', 'united arab emirates': 'AE',
  'czech republic': 'CZ', 'south korea': 'KR', 'north korea': 'KP',
  // Long Dutch territory names; Intl uses shorter names for SH and a different spelling for GS.
  'sint-helena, ascension en tristan da cunha': 'SH',
  'zuid-georgie en de zuidelijke sandwicheilanden': 'GS',
}

/** Local province names; scoped to their country, never used as fuzzy matches. */
export const OBSORG_SUB1_ALIASES: Record<string, string[]> = {
  'NL-NH': ['Noord-Holland'],
  'NL-ZH': ['Zuid-Holland'],
  'NL-NB': ['Noord-Brabant'],
  'NL-FR': ['Fryslân'],
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
export function countryNameMap(regions: Regions, langs: readonly string[] = COUNTRY_NAME_LANGS): Map<string, string> {
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
    // An engine without this language's data (or without Intl.DisplayNames) keeps the English names and the aliases.
    let displayNames: Intl.DisplayNames
    try {
      displayNames = new Intl.DisplayNames([lang], { type: 'region' })
    } catch {
      continue
    }
    for (const code of Object.keys(regions.countries)) {
      const name = displayNames.of(code)
      if (name) add(name, code)
    }
  }
  for (const [name, code] of Object.entries(OBSORG_COUNTRY_ALIASES)) if (regions.countries[code]) add(name, code)
  return names
}

