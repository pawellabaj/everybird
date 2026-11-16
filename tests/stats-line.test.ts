// The stats line (statsLine in CollageView): the list's totals, and the threatened count (VU + EN + CR) on the
// unfiltered line, in the wording of each `threat` preview variant (a: "N threatened", b: "N globally threatened",
// c: not on the line).
import { describe, expect, it } from 'vitest'
import { statsLine } from '@/components/app/CollageView'
import type { ListEntry } from '@/lib/list/model'
import type { IucnCat } from '@/lib/species/iucn'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'

const row = (code: string, ord: string, fam: string, to: number, iu?: IucnCat): SpeciesRow => ({
  code, com: code, sci: `Avis ${code}`, ord, fam, famCom: fam, to, g: 100, gSrc: 'avonet', st: true, ar: 1, q: true, ...(iu ? { iu } : {}),
})
const species = buildSpeciesIndex([
  row('duck1', 'Anseriformes', 'Anatidae', 1, 'LC'),
  row('owl1', 'Strigiformes', 'Strigidae', 2, 'VU'),
  row('crow1', 'Passeriformes', 'Corvidae', 3, 'EN'),
  row('robin1', 'Passeriformes', 'Turdidae', 4),
  row('jay1', 'Passeriformes', 'Corvidae', 5, 'NT'),
])
const entry = (code: string, date: string): ListEntry => ({ code, date, heard: false, dead: false, media: false, sources: ['ebird'] })
const all = [entry('duck1', '2020-01-02'), entry('owl1', '2021-03-04'), entry('crow1', '2022-05-06'), entry('robin1', '2023-07-08')]
const noStatus = [entry('duck1', '2020-01-02'), entry('robin1', '2023-07-08'), entry('jay1', '2024-01-01')]

describe('statsLine: the threatened count', () => {
  it('variant a (default): "N threatened" after the families, before "since"', () => {
    expect(statsLine(all, all, species)).toBe('4 species · 3 orders · 4 families · 2 threatened · since Jan 2020')
    expect(statsLine(all, all, species, 'a')).toBe('4 species · 3 orders · 4 families · 2 threatened · since Jan 2020')
  })
  it('variant b: "N globally threatened" in the same place', () => {
    expect(statsLine(all, all, species, 'b')).toBe('4 species · 3 orders · 4 families · 2 globally threatened · since Jan 2020')
  })
  it('variant c: not on the line', () => {
    expect(statsLine(all, all, species, 'c')).toBe('4 species · 3 orders · 4 families · since Jan 2020')
  })
  it('the filtered line is unchanged in every variant', () => {
    for (const v of ['a', 'b', 'c'] as const) expect(statsLine(all, all.slice(0, 2), species, v)).toBe('2 of 4 species · 2 families')
  })
  it('hidden at 0: Least Concern and Near Threatened are not threatened, and a species without a status counts nothing', () => {
    expect(statsLine(noStatus, noStatus, species)).toBe('3 species · 2 orders · 3 families · since Jan 2020')
    expect(statsLine(noStatus, noStatus, species, 'b')).not.toContain('threatened')
  })
  it('the count is grouped like the other numbers', () => {
    const codes = Array.from({ length: 1200 }, (_, i) => `vu${i}`)
    const big = buildSpeciesIndex(codes.map((c, i) => row(c, 'Strigiformes', 'Strigidae', i + 1, 'VU')))
    const list = codes.map((c) => entry(c, '2020-01-01'))
    expect(statsLine(list, list, big)).toBe('1,200 species · 1 order · 1 family · 1,200 threatened · since Jan 2020')
  })
})
