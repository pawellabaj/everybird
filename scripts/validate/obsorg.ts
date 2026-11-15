/** Local, read-only validation. Outputs aggregates only; never prints file names, raw rows or place names. */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { detectFile } from '../../src/lib/import/detect'
import { parseObsOrgObservations, parseObsOrgSpecies, resolveObsOrgName, rowKind } from '../../src/lib/import/obsorg'
import { makeObsOrgPlaces } from '../../src/lib/import/obsorg-places'
import { buildTaxonomyIndex } from '../../src/lib/species/load'
import type { Regions } from '../../src/lib/species/types'

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error('Usage: npx tsx scripts/validate/obsorg.ts <file.csv>')
  const csv = readFileSync(path, 'utf8')
  const t = buildTaxonomyIndex(JSON.parse(readFileSync('public/data/taxonomy.v1.json', 'utf8')).taxa)
  const synonyms = JSON.parse(readFileSync('public/data/inat-synonyms.v1.json', 'utf8'))
  const kind = detectFile(csv, path)
  if (kind === 'obsorg-species') {
    const result = parseObsOrgSpecies(csv, t, synonyms)
    if ('error' in result) throw new Error(result.error)
    const skippedTypes: Record<string, number> = {}
    Papa.parse<Record<string, string>>(csv, { header:true, skipEmptyLines:true, transformHeader:h => h.trim().toLowerCase(), step: ({data}) => {
      if (rowKind(data['species type'], data['scientific name'] ?? '') === 'skip') {
        const type = data['species type']?.trim().toLowerCase() ?? ''
        skippedTypes[type] = (skippedTypes[type] ?? 0) + 1
      }
    } })
    console.log(`rows ${result.rows} · species ${result.records.length} · not species ${result.unmatched.filter(u => u.reason === 'not-species').length} · unmatched ${result.unmatched.filter(u => u.reason === 'no-match').length} · skipped by type ${JSON.stringify(skippedTypes)}`)
    return
  }
  if (kind !== 'obsorg-observations') throw new Error('Unsupported file kind.')
  const regions: Regions = JSON.parse(readFileSync('public/data/regions.v1.json', 'utf8'))
  const result = await parseObsOrgObservations(csv, t, synonyms, regions)
  if ('error' in result) throw new Error(result.error)
  const placeOf = makeObsOrgPlaces(regions)
  const names = new Set<string>(), matched = new Set<string>()
  const countries = new Set<string>(), countryResolved = new Set<string>()
  const divisions = new Set<string>(), divisionResolved = new Set<string>()
  const skippedTypes: Record<string, number> = {}
  let oceanRows = 0, emptyDivisionRows = 0, parseErrors = 0
  Papa.parse<Record<string, string>>(csv, { header:true, skipEmptyLines:true, transformHeader:h => h.trim().toLowerCase(), step: ({data:r,errors}) => {
    parseErrors += errors.length
    const sci = r['scientific name']?.trim() ?? ''
    const type = r['species type']?.trim().toLowerCase() ?? ''
    const row = rowKind(type, sci)
    if (type === 'soort' || type === 'species') {
      names.add(sci)
      if (resolveObsOrgName(t,sci,'species',synonyms).code !== null) matched.add(sci)
    }
    if (row === 'skip') skippedTypes[type] = (skippedTypes[type] ?? 0) + 1
    const country = r.country?.trim() ?? ''
    const division = r['country division']?.trim() ?? ''
    if (!division) emptyDivisionRows++
    if (country.toLowerCase() === 'world') { oceanRows++; return }
    if (!country) return
    countries.add(country)
    const place = placeOf(country,division)
    if (place?.country) countryResolved.add(country)
    if (!division) return
    const key = `${country}\u0000${division}`
    divisions.add(key)
    if (place?.sub1) divisionResolved.add(key)
  } })
  console.log(`rows ${result.rows} · soort names matched ${matched.size}/${names.size} · species ${result.records.length} · unmatched ${result.unmatched.filter(u => u.reason === 'no-match').length} · countries resolved ${countryResolved.size}/${countries.size} (World excluded) · divisions matched ${divisionResolved.size}/${divisions.size} · excluded escape ${result.excluded.escape}, uncertain ${result.excluded.uncertain} · not species names ${result.unmatched.filter(u => u.reason === 'not-species').length} · skipped by type ${JSON.stringify(skippedTypes)} · ocean rows ${oceanRows} · empty division rows ${emptyDivisionRows} · parse errors ${parseErrors}`)
}
main().catch(() => { console.error('Validation failed. Check the file kind and CSV structure locally.'); process.exitCode = 1 })
