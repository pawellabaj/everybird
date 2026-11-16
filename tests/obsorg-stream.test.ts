// @vitest-environment jsdom
// The observations export read from a File, as the worker reads it: streamed through FileReader in chunks. A tiny
// chunk size makes the chunks split rows, quoted fields and multi-byte characters.
import Papa from 'papaparse'
import { afterEach, describe, expect, it } from 'vitest'
import { DamagedCsvError, parseObsOrgObservations } from '@/lib/import/obsorg'
import { fixture, regions, taxonomy as t } from './obsorg-helpers'

const HEAD = 'date,scientific name,species type,country,country division,is certain,is escape,notes'
// Synthetic rows, with non-ASCII country and division names and a quoted, multi-line note.
const ROWS = [
  '2021-05-03,Colaptes auratus,soort,Frankrijk,Île-de-France,True,False,"Été, à l’aube ""très"" tôt',
  'deuxième ligne"',
  '2020-04-11,Colaptes auratus,soort,België,Liège,True,False,',
  '2019-02-02,Gyps rueppelli,soort,Frankrijk,Provence-Alpes-Côte d’Azur,True,False,ééé',
  '2018-03-03,Anas platyrhynchos,soort,Spanje,Andalucía,True,False,',
  '2022-01-01,Colaptes auratus,soort,Duitsland,Thüringen,True,False,ü',
  '2023-06-06,Avis inventa,soort,Österreich,Kärnten,True,False,',
  '2017-01-01,Colaptes auratus,soort,Frankrijk,Île-de-France,False,False,',
]
const CSV = [HEAD, ...ROWS].join('\r\n')

const parse = async (input: string | File) => {
  const r = await parseObsOrgObservations(input, t, {}, regions)
  if ('error' in r) throw new Error(r.error)
  return r
}

describe('observation.org observations: a File streams to the same result as the string', () => {
  const size = Papa.LocalChunkSize
  afterEach(() => { Papa.LocalChunkSize = size })
  it('with jsdom’s FileReader (the streaming path)', () => {
    expect(typeof FileReader).toBe('function')
  })
  for (const chunk of [7, 16, 61]) {
    it(`non-ASCII names, a BOM and ${chunk}-byte chunks`, async () => {
      const fromString = await parse(CSV)
      // Places resolved through the non-ASCII names (not the country only).
      expect([...(fromString.records.find((r) => r.code === 'norfli')?.seen ?? [])].sort()).toEqual(['2020-04-11|BE-WAL', '2021-05-03|FR-IDF', '2022-01-01|DE-TH'])
      expect(fromString.excluded).toEqual({ escape: 0, uncertain: 1 })
      Papa.LocalChunkSize = chunk
      const fromFile = await parse(new File(['﻿' + CSV], 'synthetic.csv', { type: 'text/csv' }))
      expect(fromFile).toEqual(fromString)
    })
  }
  it('the fixture export too', async () => {
    const csv = fixture('observations-nl')
    Papa.LocalChunkSize = 33
    expect(await parse(new File(['﻿' + csv], 'synthetic.csv'))).toEqual(await parse(csv))
  })
  it('a damaged File (an unclosed quote) still rejects as damaged, and a file without the columns too', async () => {
    Papa.LocalChunkSize = 9
    const damaged = `${HEAD}\r\n2021-05-03,Colaptes auratus,soort,Frankrijk,"Île-de-France,True,False,\r\n2020-04-11,Colaptes auratus,soort,België,Liège,True,False,`
    await expect(parseObsOrgObservations(new File([damaged], 'd.csv'), t, {}, regions)).rejects.toBeInstanceOf(DamagedCsvError)
    await expect(parseObsOrgObservations(new File(['name,age\r\nÉlise,3'], 'd.csv'), t, {}, regions)).rejects.toBeInstanceOf(DamagedCsvError)
  })
})
