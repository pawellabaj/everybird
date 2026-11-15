import Papa from 'papaparse'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { DamagedCsvError, parseObsOrgObservations } from '@/lib/import/obsorg'
import { buildTaxonomyIndex } from '@/lib/species/load'
import { toJson } from '@/lib/list/export'
import { emptySaved, replaceSource } from '@/lib/list/storage'
import { fixture, regions, taxonomy as t } from './obsorg-helpers'
const csv = fixture('observations-nl')
const publicT = buildTaxonomyIndex(JSON.parse(readFileSync('public/data/taxonomy.v1.json', 'utf8')).taxa)
const parse = async (text: string | File = csv, onProgress?: (rows:number) => void) => {
  const result = await parseObsOrgObservations(text, t, {}, regions, onProgress)
  if ('error' in result) throw new Error(result.error)
  return result
}

describe('observation.org observations export', () => {
  it('uses the earliest counted date with exactly that observation’s place', async () => {
    const r = await parse()
    const record = (code:string) => r.records.find(x => x.code === code)
    expect(record('norfli')).toMatchObject({ source:'obsorg', date:'2020-04-11', place:{ country:'BE', sub1:'BE-VLG' } })
    expect(record('rupgri')).toMatchObject({ date:'2019-02-02', place:{country:'NL'}, seen:['2019-02-02|NL'] })
    expect(record('mallar3b')).toMatchObject({ date:'2018-03-03', seen:[] })
    expect(record('mallar3b')?.place).toBeUndefined()
    expect(record('gilfli')?.date).toBe('2023-06-06')
    expect(r.rows).toBe(12)
  })
  it('keeps every place with its earliest date, even across synonym names', async () => {
    const r = await parse()
    expect(r.records.find(x => x.code === 'norfli')?.seen?.sort()).toEqual(['2020-04-11|BE-VLG','2021-05-03|NL-NH','2022-01-01|FR-HDF'])
    const extra = '\r\n2024-01-01,Colaptes auratus cafer,ondersoort,België,Antwerpen,True,False\r\n2019-01-01,Colaptes auratus cafer,ondersoort,België,Antwerpen,True,False'
    const compact = 'date,scientific name,species type,country,country division,is certain,is escape\r\n2020-01-01,Colaptes auratus,soort,België,Antwerpen,True,False'
    expect((await parse(compact+extra)).records[0].seen).toEqual(['2019-01-01|BE-VLG'])
  })
  it('excludes escapes and uncertain observations before species or place aggregation', async () => {
    const r = await parse()
    expect(r.records.some(x => x.code === 'yerwar')).toBe(false)
    expect(r.excluded).toEqual({ escape:1, uncertain:1 })
  })
  it('keeps unmatched dates, places and seen; skipped names have scientific names only', async () => {
    const r = await parse()
    expect(r.unmatched.find(x => x.sci === 'Avis inventa')).toEqual({ source:'obsorg', row:12, sci:'Avis inventa', reason:'no-match', date:'2015-07-07', place:{ country:'DE', sub1:'DE-BY' }, seen:['2015-07-07|DE-BY'] })
    expect(r.unmatched.filter(x => x.reason === 'not-species')).toEqual([
      { source:'obsorg', row:10, sci:'Colaptes spec.', reason:'not-species' },
      { source:'obsorg', row:11, sci:'Aves indet.', reason:'not-species' },
    ])
    expect(r.skipped).toBe(0)
  })
  it('looks up only the seven allowed fields and never emits raw place names or private columns', async () => {
    const serialized = JSON.stringify(await parse())
    for (const text of ['SENTINEL','12.345','98.765','Noord-Holland','Antwerpen','Pas-de-Calais','Atlantis','World','Nederland']) expect(serialized).not.toContain(text)
    const allowed = new Set(['date','scientific name','species type','country','country division','is certain','is escape'])
    const row = new Proxy({ date:'2020-01-01', 'scientific name':'Colaptes auratus', 'species type':'soort', country:'Nederland', 'country division':'Noord-Holland', 'is certain':'True', 'is escape':'False' }, {
      get(target,key) {
        if (!allowed.has(String(key))) throw new Error('Forbidden column access')
        return Reflect.get(target,key)
      },
    })
    const spy = vi.spyOn(Papa, 'parse').mockImplementationOnce(((_input:unknown, config: Papa.ParseConfig) => {
      config.step!({ data:row, errors:[], meta:{} } as never, {} as Papa.Parser)
      config.complete!({ data:[], errors:[], meta:{} } as never, undefined)
    }) as typeof Papa.parse)
    try { expect((await parse()).records[0].code).toBe('norfli') } finally { spy.mockRestore() }
  })
  it('a backup of the imported observations carries none of the private columns', async () => {
    const r = await parse()
    const saved = replaceSource(emptySaved(), 'obsorg', r, { kind:'observations', file:'synthetic.csv', rows:r.rows, at:'2026-11-15T10:00:00.000Z', excluded:r.excluded })
    const json = toJson(saved)
    expect(json).toContain('norfli')
    for (const text of ['SENTINEL','12.345','98.765']) expect(json).not.toContain(text)
  })
  it('streams a 20k-row File with progress and gives the same result as text', async () => {
    const text = ['scientific name,species type,date,country,country division,is certain,is escape', ...Array(20_000).fill('Colaptes auratus,soort,2020-01-01,Nederland,Noord-Holland,True,False')].join('\n')
    const progress: number[] = []
    expect(await parse(new File([text],'synthetic.csv'), n => progress.push(n))).toEqual(await parse(text))
    expect(progress).toEqual([5000,10000,15000,20000])
  })
  it('clears a later known place when the earlier row is unplaced and deduplicates unmatched names', async () => {
    const text = 'scientific name,species type,date,country,country division\nColaptes auratus,species,2020-01-01,Nederland,Utrecht\nColaptes auratus,species,2019-01-01,World,Ocean\nAvis inventa,species,2020-01-01,Nederland,Utrecht\nAvis inventa,species,2018-01-01,World,Ocean'
    const r = await parse(text)
    expect(r.records[0].date).toBe('2019-01-01')
    expect(r.records[0].place).toBeUndefined()
    expect(r.records[0].seen).toEqual(['2020-01-01|NL-UT'])
    expect(r.unmatched).toEqual([{ source:'obsorg', row:4, sci:'Avis inventa', reason:'no-match', date:'2018-01-01', seen:['2020-01-01|NL-UT'] }])
  })
  it('rejects a CSV whose quoting is broken, or without a scientific name column, without leaking row contents', async () => {
    for (const bad of ['scientific name,species type\nColaptes auratus,"SENTINEL', 'naam,soort\nSENTINEL,soort']) {
      const e = await parse(bad).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(DamagedCsvError)
      expect(String((e as Error).message)).not.toContain('SENTINEL')
    }
  })
  it('reads a row with too few or too many fields as it is: one bad row never loses the file', async () => {
    const head = 'date,scientific name,species type,country,country division,is certain,is escape'
    const r = await parse([head, '2020-01-01,Colaptes auratus,soort,Nederland,Utrecht,True,False,SENTINEL', '2021-01-01,Gyps rueppelli,soort,Nederland,Utrecht,True,False', '2022-01-01,Anas platyrhynchos'].join('\n'))
    expect(r.records.map(x => [x.code, x.date])).toEqual([['norfli','2020-01-01'],['rupgri','2021-01-01'],['mallar3b','2022-01-01']])
    expect(r.rows).toBe(3)
    expect(JSON.stringify(r)).not.toContain('SENTINEL')
  })
  it('on equal earliest dates the row with more place detail gives the place', async () => {
    const head = 'date,scientific name,species type,country,country division'
    const r = await parse([head, '2020-01-01,Colaptes auratus,soort,World,Ocean', '2020-01-01,Colaptes auratus,soort,Nederland,', '2020-01-01,Colaptes auratus,soort,Nederland,Utrecht', '2020-01-01,Colaptes auratus,soort,Nederland,'].join('\n'))
    expect(r.records[0].place).toEqual({ country:'NL', sub1:'NL-UT' })
    const later = await parse([head, '2020-01-01,Colaptes auratus,soort,Nederland,', '2020-01-02,Colaptes auratus,soort,Nederland,Utrecht'].join('\n'))
    expect(later.records[0]).toMatchObject({ date:'2020-01-01', place:{ country:'NL' } })
  })
  it('maps a subspecies of a regional split by its epithet, and a species name exactly', async () => {
    const head = 'date,scientific name,species type'
    const r = await parseObsOrgObservations([head, '2020-06-01,Muscicapa striata tyrrhenica,ondersoort', '2020-06-01,Muscicapa striata,soort', '2020-06-01,Tringa semipalmata inornata,ondersoort', '2020-06-01,Myophonus caeruleus flavirostris,ondersoort'].join('\n'), publicT, {}, regions)
    if ('error' in r) throw new Error(r.error)
    expect(r.records.map(x => x.code).sort()).toEqual(['bluwht2','spofly2','spofly3','willet3'])
  })
  it('no-birds for an empty or entirely excluded file, but keeps named skips and unmatched names', async () => {
    expect(await parseObsOrgObservations('',t,{},regions)).toEqual({error:'no-birds'})
    expect(await parseObsOrgObservations('scientific name,species type,is escape\nColaptes auratus,species,True',t,{},regions)).toEqual({error:'no-birds'})
    expect((await parse('scientific name,species type\nAvis inventa,species\nAves indet.,aggregate')).unmatched).toHaveLength(2)
  })
  it('counts a row once in excluded (an escape first) and counts undated rows', async () => {
    const head = 'date,scientific name,species type,country,country division,is certain,is escape'
    const r = await parse([head, '2020-01-01,Colaptes auratus,soort,Nederland,Utrecht,False,True', '2020-01-01,Colaptes auratus,soort,Nederland,Utrecht,False,False', '03-04-2020,Colaptes auratus,soort,Nederland,Utrecht,True,False', ',Colaptes auratus,soort,Nederland,Utrecht,True,False'].join('\r\n'))
    expect(r.excluded).toEqual({ escape: 1, uncertain: 1 })
    // Two undated rows of one species: one undated species. A dated row anywhere dates it.
    expect(r.undated).toBe(1)
    expect(r.records[0].date).toBeUndefined()
    expect((await parse([head, ',Colaptes auratus,soort,Nederland,Utrecht,True,False', '2020-01-01,Colaptes auratus,soort,Nederland,Utrecht,True,False', ',Gyps rueppelli,soort,,,True,False'].join('\r\n'))).undated).toBe(1)
  })
  it('reads quoted fields with commas, escaped quotes and line breaks as one row', async () => {
    expect(csv).toContain('""quoted""')
    expect(csv).toContain('\r\n')
    expect((await parse()).rows).toBe(12)
  })
})
