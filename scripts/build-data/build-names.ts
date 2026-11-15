// Run fetch-sources.ts [--names-only] first. No sticker changes or uploads.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { familyLang, NAME_BASE, NAME_LOCALES } from '../../src/lib/species/name-locales'
import type { NameLocale } from '../../src/lib/species/name-locales'
import type { SpeciesFile, SpeciesRow } from '../../src/lib/species/types'
import { assertSameSpeciesCodes } from './fetch-sources'

export type NameGroup = { englishName: string; groupName: string }
type RawGroup = { groupOrder: number; groupName: string }
type RawTaxon = { speciesCode: string; comName: string; category: string }

function sorted(entries: Iterable<[string, string]>): Record<string, string> {
  return Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
}

/** First translated name wins; an English fallback in a regional set never hides the base. */
export function mergeChain(english: Map<string, string>, chain: Map<string, string>[]): Record<string, string> {
  const names = new Map<string, string>()
  for (const [code, en] of english) {
    for (const set of chain) {
      const name = set.get(code)
      if (name?.trim() && name !== en) {
        names.set(code, name)
        break
      }
    }
  }
  return sorted(names)
}

/** Capitalise only the first code point, preserving all remaining spelling and punctuation. */
export function capFirst(name: string, locale: 'pt-BR'): string {
  const first = [...name][0]
  return first ? first.toLocaleUpperCase(locale) + name.slice(first.length) : name
}

/** Exact English group matches only: a group containing several families is not a translation of one. */
export function familyNames(groups: NameGroup[], species: Pick<SpeciesRow, 'fam' | 'famCom'>[], hand: Record<string, string>): Record<string, string> {
  const byEnglish = new Map(groups.map((g) => [g.englishName, g.groupName]))
  const names = new Map<string, string>()
  for (const s of species) {
    const name = hand[s.fam] ?? byEnglish.get(s.famCom)
    if (name?.trim() && (Object.hasOwn(hand, s.fam) || name !== s.famCom)) names.set(s.fam, name)
  }
  return sorted(names)
}

/** Rebuild every locale from the same pinned taxonomy; output contains only published species codes. */
export function writeNames(): void {
  const root = process.cwd()
  const raw = resolve(root, 'data/raw')
  const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T
  const species = read<SpeciesFile>(resolve(root, 'public/data/species.v1.json'))
  const manifest = read<{ ebirdTaxonomy: string }>(resolve(raw, 'manifest.json'))
  if (manifest.ebirdTaxonomy !== species.ebirdTaxonomy) throw new Error('names taxonomy does not match species.v1.json; fetch the pinned taxonomy first')
  const englishRows = read<RawTaxon[]>(resolve(raw, 'ebird-taxonomy.json'))
  const english = new Map(species.species.map((s) => [s.code, s.com]))
  const sets = new Map<NameLocale, Map<string, string>>()
  for (const locale of NAME_LOCALES) {
    const rows = read<RawTaxon[]>(resolve(raw, `ebird-taxonomy.${locale}.json`))
    assertSameSpeciesCodes(englishRows, rows, locale)
    sets.set(locale, new Map(rows.map((r) => [r.speciesCode, NAME_BASE[locale] === 'pt_BR' ? capFirst(r.comName, 'pt-BR') : r.comName])))
  }
  const englishGroups = new Map(read<RawGroup[]>(resolve(raw, 'ebird-groups.en.json')).map((g) => [g.groupOrder, g.groupName]))
  const families = new Map<string, Record<string, string>>()
  for (const lang of ['es', 'pt', 'nl'] as const) {
    const groups = read<RawGroup[]>(resolve(raw, `ebird-groups.${lang}.json`)).map((g): NameGroup => {
      const englishName = englishGroups.get(g.groupOrder)
      if (!englishName) throw new Error(`No English group for ${lang} group ${g.groupOrder}`)
      return { englishName, groupName: g.groupName }
    })
    const hand = read<Record<string, string>>(resolve(root, `data/i18n/families.${lang}.json`))
    families.set(lang, familyNames(groups, species.species, hand))
  }
  mkdirSync(resolve(root, 'public/data'), { recursive: true })
  for (const locale of NAME_LOCALES) {
    const base = NAME_BASE[locale]
    const chain = locale === base ? [sets.get(locale)!] : [sets.get(locale)!, sets.get(base)!]
    const names = mergeChain(english, chain)
    const file = { v: 1, locale, taxonomy: species.ebirdTaxonomy, names, fam: families.get(familyLang(locale))! }
    writeFileSync(resolve(root, `public/data/names.${locale}.v1.json`), JSON.stringify(file))
    console.log(`${locale}: ${Object.keys(names).length} species names, ${Object.keys(file.fam).length} families`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeNames()
