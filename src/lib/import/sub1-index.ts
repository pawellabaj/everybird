import { foldName } from '@/lib/species/resolve'
import type { Regions } from '@/lib/species/types'
import { stripBracket } from './places'

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
 * What a real regions.v1.json name that two or more codes in one country share (and no alias settles) resolves to:
 * 'none', nothing, so the place stays the country, never a wrong province (observation.org; with `rollUp`, the codes'
 * common top-level region when every one of them rolls up to the same one); 'first', the first such code in
 * regions.sub1 order, as iNaturalist's import always did (kept so its places don't change).
 */
export type Sub1Clash = 'first' | 'none'

/**
 * Province and state names to sub1 codes, within one country. Precedence: the alias tables first (earlier tables win),
 * then a real regions.v1.json name, a shared one by `onClash`. `key` further normalises folded names on both sides
 * (observation.org drops a trailing " (62)"). `rollUp` (onClash 'none' only) maps a code to its top-level region
 * (SUB1_PARENT): a name whose codes all have the same top, itself in regions.sub1, resolves to that top.
 */
export function makeSub1Index(
  regions: Regions,
  aliasTables: readonly Record<string, string[]>[] = [SUB1_ALIASES],
  key: (folded: string) => string = (s) => s,
  { onClash = 'none', rollUp }: { onClash?: Sub1Clash; rollUp?: (code: string) => string } = {},
): Sub1Index {
  const byKey = new Map<string, string>()
  // Every code a name belongs to, in regions.sub1 order.
  const real = new Map<string, string[]>()
  for (const [code, name] of Object.entries(regions.sub1)) {
    const country = code.split('-')[0]
    for (const n of new Set(sub1Names(name).map(key))) {
      if (!n) continue
      const k = `${country}|${n}`
      const codes = real.get(k)
      if (!codes) real.set(k, [code])
      else if (!codes.includes(code)) codes.push(code)
    }
  }
  for (const [k, codes] of real) {
    if (codes.length === 1 || onClash === 'first') {
      byKey.set(k, codes[0])
      continue
    }
    const tops = rollUp ? new Set(codes.map(rollUp)) : undefined
    const top = tops?.size === 1 ? [...tops][0] : undefined
    if (top && regions.sub1[top]) byKey.set(k, top)
  }
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
