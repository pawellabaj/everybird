import { beforeEach, describe, expect, it, vi } from 'vitest'

// Spy on the exported suggester across the module boundary (obsorg.ts imports it from resolve.ts).
vi.mock('@/lib/species/resolve', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/species/resolve')>()
  return { ...real, suggestName: vi.fn(real.suggestName) }
})

const { suggestName } = await import('@/lib/species/resolve')
const { parseObsOrgObservations, parseObsOrgSpecies, SUGGEST_MAX } = await import('@/lib/import/obsorg')
const { regions, taxonomy: t } = await import('./obsorg-helpers')
const spy = vi.mocked(suggestName)

const HEAD = 'name,scientific name,group,date first observed,species type'
const lifeList = (rows: string[]) => [HEAD, 'Demo,Colaptes auratus,Birds,2020-01-01,species', ...rows].join('\n')
const invented = (i: number) => `Nomen ignotum${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)}`

beforeEach(() => {
  spy.mockClear()
})

describe('observation.org suggestions are computed last, for few names', () => {
  it('1,000 names in a dropped group never ask for a suggestion', () => {
    const plants = Array.from({ length: 1000 }, (_, i) => `Plant ${i},${invented(i)},Plants,2020-01-01,species`)
    const r = parseObsOrgSpecies(lifeList(plants), t, {})
    if ('error' in r) throw new Error(r.error)
    expect(r.records.map((x) => x.code)).toEqual(['norfli'])
    expect(r.unmatched).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
  it('a kept group suggests once per distinct unmatched name, up to the cap', () => {
    const twice = ['Avis inventa', 'Avis inventa', 'Neotis denhamii'].map((sci) => `Demo,${sci},Birds,,species`)
    const r = parseObsOrgSpecies(lifeList(twice), t, {})
    if ('error' in r) throw new Error(r.error)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(r.unmatched.filter((u) => u.sci === 'Neotis denhamii').map((u) => u.suggestion)).toEqual(['rupbus'])

    spy.mockClear()
    const many = Array.from({ length: SUGGEST_MAX + 100 }, (_, i) => `Demo,${invented(i)},Birds,,species`)
    const big = parseObsOrgSpecies(lifeList(many), t, {})
    if ('error' in big) throw new Error(big.error)
    expect(big.unmatched).toHaveLength(SUGGEST_MAX + 100)
    expect(spy).toHaveBeenCalledTimes(SUGGEST_MAX)
  })
  it('the observations export suggests once per distinct unmatched name, at the end, up to the cap', async () => {
    const head = 'date,scientific name,species type,country,country division,is certain,is escape'
    const row = (sci: string) => `2020-01-01,${sci},soort,Nederland,Utrecht,True,False`
    const names = Array.from({ length: SUGGEST_MAX + 50 }, (_, i) => invented(i))
    const text = [head, row('Colaptes auratus'), ...names.flatMap((n) => [row(n), row(n)])].join('\r\n')
    const r = await parseObsOrgObservations(text, t, {}, regions)
    if ('error' in r) throw new Error(r.error)
    expect(r.unmatched).toHaveLength(SUGGEST_MAX + 50)
    expect(spy).toHaveBeenCalledTimes(SUGGEST_MAX)
    // Matched names never ask.
    spy.mockClear()
    await parseObsOrgObservations([head, ...Array(500).fill(row('Colaptes auratus'))].join('\r\n'), t, {}, regions)
    expect(spy).not.toHaveBeenCalled()
  })
  it('a malformed row stops the observations parse: nothing is resolved or suggested after it', async () => {
    const head = 'date,scientific name,species type,country,country division,is certain,is escape'
    const text = [head, '2020-01-01,Avis inventa,soort,Nederland,Utrecht,True,False', '2020-01-01,"Avis broken,soort'].join('\r\n')
    await expect(parseObsOrgObservations(text, t, {}, regions)).rejects.toThrow('Malformed observation.org CSV.')
    expect(spy).not.toHaveBeenCalled()
  })
})
