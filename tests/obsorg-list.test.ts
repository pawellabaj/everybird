// observation.org's two files on one list: the life list's first dates, the observations' places, the Places filter,
// and nothing private leaving through a share link or the CSV export.
import { describe, expect, it } from 'vitest'
import { buildList } from '@/lib/list/build-list'
import { toCsv } from '@/lib/list/export'
import { placesUnplacedFor } from '@/lib/list/filter-summary'
import { applyFilter, togglePlace } from '@/lib/list/filters'
import type { SourceRecord } from '@/lib/list/model'
import { buildSeen, seenOf } from '@/lib/list/seen'
import { emptySaved, replaceSource, type Saved } from '@/lib/list/storage'
import { recordsOf } from '@/lib/list/store'
import { decodeShare } from '@/lib/share/link'
import { makeShareLink } from '@/lib/share/make-link'
import { parseObsOrgObservations } from '@/lib/import/obsorg'
import type { SpeciesIndex } from '@/lib/species/load'
import { fixture, regions, taxonomy as t } from './obsorg-helpers'

const row = (code: string, ord: string, to: number) => ({ code, com: code, sci: code, ord, fam: ord, famCom: ord, to }) as never
const rows = ['norfli', 'gilfli', 'rupgri', 'mallar3', 'mallar3b', 'yerwar', 'crow1', 'duck1'].map((c, i) => row(c, 'Piciformes', i))
const species: SpeciesIndex = { rows, byCode: new Map(rows.map((r) => [(r as { code: string }).code, r])), search: () => [] }

const listOf = (s: Saved) => {
  const records = recordsOf(s)
  const list = buildList(records, s.edits, s.rules)
  return { list, seen: buildSeen(records, s.edits, s.rules, list) }
}
const codes = (s: Saved, filter: object) => {
  const { list, seen } = listOf(s)
  return applyFilter(list, filter, species, seen).map((e) => e.code).sort()
}

describe('both observation.org files on the list', () => {
  const both = () => {
    const s = emptySaved()
    s.records['obsorg-list'] = [{ code: 'norfli', source: 'obsorg', date: '2015-06-01' }]
    s.records.obsorg = [{ code: 'norfli', source: 'obsorg', date: '2020-04-11', place: { country: 'BE', sub1: 'BE-VLG' }, seen: ['2020-04-11|BE-VLG'] }]
    return s
  }
  it("the life list's earlier date, with the observations' place as seen-here", () => {
    const s = both()
    const { list, seen } = listOf(s)
    expect(list).toHaveLength(1)
    expect(list[0].date).toBe('2015-06-01')
    expect(seenOf(seen, list[0]).map((p) => p.country)).toEqual(['BE'])
    expect(codes(s, togglePlace({}, 'c:BE'))).toEqual(['norfli'])
    expect(codes(s, togglePlace({}, 's:BE-VLG'))).toEqual(['norfli'])
    expect(codes(s, togglePlace({}, 'c:NL'))).toEqual([])
    expect(placesUnplacedFor(s)).toBeUndefined()
  })
})

describe('Places with placed records and life-list-only observation.org birds', () => {
  it('a country keeps the placed birds; birds only on the observation.org life list drop out', () => {
    const s = emptySaved()
    const ebird = (code: string, country: string): SourceRecord => ({ code, source: 'ebird', date: '2019-01-01', place: { country }, seen: [`2019-01-01|${country}`] })
    s.records.ebird = [ebird('crow1', 'CA'), ebird('duck1', 'CA'), ebird('norfli', 'US')]
    s.records['obsorg-list'] = [
      { code: 'gilfli', source: 'obsorg', date: '2016-01-01' },
      { code: 'rupgri', source: 'obsorg', date: '2017-01-01' },
      { code: 'norfli', source: 'obsorg', date: '2012-01-01' },
    ]
    expect(codes(s, {})).toEqual(['crow1', 'duck1', 'gilfli', 'norfli', 'rupgri'])
    expect(codes(s, togglePlace({}, 'c:CA'))).toEqual(['crow1', 'duck1'])
    // A bird on both keeps its eBird places.
    expect(codes(s, togglePlace({}, 'c:US'))).toEqual(['norfli'])
    expect(placesUnplacedFor(s)).toBe('add')
  })
})

describe('nothing private leaves through a share link or the CSV export', () => {
  it('a list from the observations export: the link and the CSV carry no location, note or coordinate', async () => {
    const r = await parseObsOrgObservations(fixture('observations-nl'), t, {}, regions)
    if ('error' in r) throw new Error(r.error)
    const s = replaceSource(emptySaved(), 'obsorg', r, { kind: 'observations', file: 'synthetic.csv', rows: r.rows, at: '2026-11-15T10:00:00.000Z', excluded: r.excluded })
    const { list, seen } = listOf(s)
    expect(list.length).toBeGreaterThan(0)
    const { url, dropped } = makeShareLink(list, regions, 'Test birder', 'https://everybird.example')
    // Some fixture codes are synthetic (not in the link index); the rest are carried, with their places.
    expect(dropped).toBeLessThan(list.length)
    const decoded = decodeShare(url.split('/s/')[1])
    expect(decoded.birds.length).toBe(list.length - dropped)
    expect(decoded.places?.length).toBeGreaterThan(0)
    const payload = JSON.stringify(decoded)
    const csv = toCsv(list, species, regions, seen)
    expect(csv).toContain('Belgium')
    for (const text of [url, payload, csv]) {
      for (const bad of ['SENTINEL', '12.345', '98.765']) expect(text).not.toContain(bad)
    }
  })
})
