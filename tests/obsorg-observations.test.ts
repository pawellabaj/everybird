import Papa from 'papaparse'
import { describe, expect, it, vi } from 'vitest'
import { parseObsOrgObservations } from '@/lib/import/obsorg'
import { fixture, regions, taxonomy as t } from './obsorg-helpers'
const csv = fixture('observations-nl')
const parse = async (text: string | File = csv, onProgress?: (rows:number) => void) => {
  const result = await parseObsOrgObservations(text, t, {}, regions, onProgress)
  if ('error' in result) throw new Error(result.error)
  return result
}

describe('observation.org observations export', () => {
  it('uses the earliest counted date with exactly that observation’s place', async () => {
    const r = await parse()
    const record = (code:string) => r.records.find(x => x.code === code)
    expect(record('norfli')).toMatchObject({ source:'obsorg', date:'2020-04-11', place:{ country:'BE', sub1:'BE-VAN' } })
    expect(record('rupgri')).toMatchObject({ date:'2019-02-02', place:{country:'NL'}, seen:['2019-02-02|NL'] })
    expect(record('mallar3b')).toMatchObject({ date:'2018-03-03', seen:[] })
    expect(record('mallar3b')?.place).toBeUndefined()
    expect(record('gilfli')?.date).toBe('2023-06-06')
    expect(r.rows).toBe(12)
  })
  it('keeps every place with its earliest date, even across synonym names', async () => {
    const r = await parse()
    expect(r.records.find(x => x.code === 'norfli')?.seen?.sort()).toEqual(['2020-04-11|BE-VAN','2021-05-03|NL-NH','2022-01-01|FR-62'])
    const extra = '\r\n2024-01-01,Colaptes auratus cafer,ondersoort,België,Antwerpen,True,False\r\n2019-01-01,Colaptes auratus cafer,ondersoort,België,Antwerpen,True,False'
    const compact = 'date,scientific name,species type,country,country division,is certain,is escape\r\n2020-01-01,Colaptes auratus,soort,België,Antwerpen,True,False'
    expect((await parse(compact+extra)).records[0].seen).toEqual(['2019-01-01|BE-VAN'])
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
  it('rejects malformed CSV without leaking row contents', async () => {
    await expect(parse('scientific name,species type\nColaptes auratus,species,SENTINEL')).rejects.toThrow('Malformed observation.org CSV.')
  })
  it('no-birds for an empty or entirely excluded file, but keeps named skips and unmatched names', async () => {
    expect(await parseObsOrgObservations('',t,{},regions)).toEqual({error:'no-birds'})
    expect(await parseObsOrgObservations('scientific name,species type,is escape\nColaptes auratus,species,True',t,{},regions)).toEqual({error:'no-birds'})
    expect((await parse('scientific name,species type\nAvis inventa,species\nAves indet.,aggregate')).unmatched).toHaveLength(2)
  })
})
