import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SeenAgg, decodeSeenMonths } from '@/lib/list/seen'
import { emptySaved, migrateSaved } from '@/lib/list/storage'
import { fromJson, toJson } from '@/lib/list/export'
import { parseEbirdMyData } from '@/lib/import/ebird-mydata'
import { buildTaxonomyIndex } from '@/lib/species/load'
import { slottedRecords } from '@/lib/list/source-counts'

const taxonomy = buildTaxonomyIndex(JSON.parse(readFileSync('tests/fixtures/species/taxonomy.json', 'utf8')).taxa)

describe('SeenAgg months', () => {
  it('deduplicates months at each place, keeps later sightings and sorts the compact output', () => {
    const a = new SeenAgg()
    a.add('a', { country: 'CA', sub1: 'CA-BC', sub2: 'Example County' }, '2026-11-02')
    a.add('a', { country: 'CA', sub1: 'CA-BC', sub2: 'Example County' }, '2024-03-04')
    a.add('a', { country: 'CA', sub1: 'CA-BC', sub2: 'Example County' }, '2026-11-15')
    a.add('a', { country: 'MX' }, '2025-02')
    a.add('a', { country: 'MX' }, '2025')
    a.add('a', { country: 'MX' }, undefined)
    expect(a.getMonths('a')).toEqual(['2024-03,2026-11|CA-BC|Example County', '2025-02|MX'])
    expect(a.get('a')).toEqual(['2024-03-04|CA-BC|Example County', '2025|MX'])
    expect(a.getMonths('missing')).toBeUndefined()
  })
  it('merges all months across codes and can take an upstream month set directly', () => {
    const a = new SeenAgg(), b = new SeenAgg()
    a.addKey('a', 'CA-BC', '2024-01-02')
    b.addKey('b', 'CA-BC', '2025-02-02')
    b.addKey('b', 'CA-BC', '2026-03-02')
    a.merge('a', b, 'b')
    a.addMonths('a', 'CA-BC', ['2026-04', '', '2026-13', '2026-04'])
    expect(a.getMonths('a')).toEqual(['2024-01,2025-02,2026-03,2026-04|CA-BC'])
  })
  it('does not invent a month for a year-only, undated or placeless record', () => {
    const a = new SeenAgg()
    a.add('a', { country: 'CA' }, '2024')
    a.add('a', { country: 'CA' }, undefined)
    a.add('a', undefined, '2026-11-01')
    expect(a.getMonths('a')).toBeUndefined()
  })
  it('decodes month sets without losing the county, rejecting malformed months', () => {
    expect(decodeSeenMonths('2024-03,2026-11|CA-BC|Example|County')).toEqual({
      place: { country: 'CA', sub1: 'CA-BC', sub2: 'Example|County' }, months: ['2024-03', '2026-11'],
    })
    for (const s of ['2026-00|CA', '2026-13|CA', '|CA', '2026|CA', '2026-11', '2026-11|']) expect(decodeSeenMonths(s)).toBeUndefined()
  })
})

describe('month history in sources and Saved v5', () => {
  it('MyEBirdData keeps months beyond the earliest sighting and keeps unmatched months for later fixes', async () => {
    const r = await parseEbirdMyData(readFileSync('tests/fixtures/ebird/mydata-basic.csv', 'utf8'), taxonomy)
    expect(r.records.find((r) => r.code === 'gilfli')?.seenMonths).toEqual(['2026-02,2026-06|US-AZ|Pima'])
    expect(r.unmatched[0].seenMonths).toEqual(['2026-08|CA-BC|Okanagan-Similkameen', '2026-09|US-AZ|Pima'])
    const s = emptySaved()
    s.unmatched = r.unmatched
    s.edits.fixes[`ebird:${r.unmatched[0].row}`] = 'synthetic'
    expect(slottedRecords(s)[0].record.seenMonths).toEqual(r.unmatched[0].seenMonths)
  })
  it('migrates v1-v4 without inferring month history, preserving v4 titles verbatim', () => {
    for (const v of [1, 2, 3, 4]) {
      const old = { ...emptySaved(), v, name: 'Ada' }
      old.records.ebird = [{ code: 'a', source: 'ebird', date: '2024-03-01', seen: ['2024-03-01|CA'] }]
      const migrated = migrateSaved(old as never)
      expect(migrated.v).toBe(5)
      expect(migrated.records.ebird).toBe(old.records.ebird)
      expect(migrated.records.ebird[0].seenMonths).toBeUndefined()
      expect(migrated.name).toBe(v === 4 ? 'Ada' : "Ada's birds")
    }
    const fresh = emptySaved()
    expect(migrateSaved(fresh)).toBe(fresh)
  })
  it('round-trips month history for records, fixes and manual edits, preserving absent versus empty', () => {
    const s = emptySaved()
    s.records.ebird = [{ code: 'a', source: 'ebird', seenMonths: ['2024-01,2026-11|CA-BC|Example County'] }]
    s.records.inat = [{ code: 'b', source: 'inat', seenMonths: [] }]
    s.records['ebird-list'] = [{ code: 'c', source: 'ebird' }]
    s.unmatched = [{ source: 'ebird', row: 1, reason: 'no-match', seenMonths: ['2026-11|MX'] }]
    s.edits.added = [{ code: 'd', source: 'manual', seenMonths: ['2026-11|CA'] }]
    expect(fromJson(toJson(s))).toEqual(s)
  })
  it('refuses malformed month arrays everywhere in backups', () => {
    for (const seenMonths of ['bad', [4], ['2026-13|CA'], ['2026-11']]) {
      const s = emptySaved()
      s.records.ebird = [{ code: 'a', source: 'ebird', seenMonths: seenMonths as string[] }]
      expect(() => fromJson(toJson(s))).toThrow(/records/)
      s.records.ebird = []
      s.unmatched = [{ source: 'ebird', row: 1, reason: 'no-match', seenMonths: seenMonths as string[] }]
      expect(() => fromJson(toJson(s))).toThrow(/unmatched/)
      s.unmatched = []
      s.edits.added = [{ code: 'a', source: 'manual', seenMonths: seenMonths as string[] }]
      expect(() => fromJson(toJson(s))).toThrow(/edits/)
    }
  })
})
