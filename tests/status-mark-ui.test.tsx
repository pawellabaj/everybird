// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Collage } from '@/components/collage/Collage'
import { ListView } from '@/components/collage/ListView'
import type { StateLayout } from '@/lib/layout/layout-client'
import type { Box } from '@/lib/layout/pack'
import type { ListEntry } from '@/lib/list/model'
import type { IucnCat } from '@/lib/species/iucn'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'

const row = (code: string, com: string, to: number, iu?: IucnCat): SpeciesRow => ({
  code, com, sci: `Avis ${code}`, ord: 'Passeriformes', fam: 'Corvidae', famCom: 'Crows', to, g: 100 - to, gSrc: 'avonet', st: true, ar: 1, q: true, ...(iu ? { iu } : {}),
})
const species = buildSpeciesIndex([
  row('vulbi', 'Vuln Bird', 1, 'VU'),
  row('lcbir', 'Common Bird', 2, 'LC'),
  row('nonbi', 'Plain Bird', 3),
  row('crbir', 'Critical Bird', 4, 'CR'),
])
const codes = ['vulbi', 'lcbir', 'nonbi', 'crbir']
const entries: ListEntry[] = codes.map((code) => ({ code, heard: false, dead: false, media: false, sources: ['manual'] }))
const boxes: Record<string, Box> = { vulbi: [10, 10, 80, 80], lcbir: [200, 10, 80, 80], nonbi: [10, 250, 80, 80], crbir: [250, 250, 80, 80] }
const layout: StateLayout = { key: 'narrow|even|x', layout: 'narrow', mode: 'even', W: 350, H: 400, boxes: new Map(Object.entries(boxes)), scale: 1, base: 20 }
const visible = new Set(codes)

afterEach(() => cleanup())

const marks = (c: HTMLElement) => [...c.querySelectorAll('.eb-bird')].filter((b) => b.querySelector('.eb-smark')).map((b) => b.getAttribute('data-code')!)
const stage = () => render(<Collage entries={entries} species={species} layout={layout} visible={visible} mode="even" onPick={() => {}} />)

describe('Collage: no pills on the stickers (Yusuf 2026-11-15: they overlapped neighbours)', () => {
  it('no bird carries a pill, and the buttons are named by the common name alone', () => {
    const { container } = stage()
    expect(container.querySelectorAll('.eb-smark')).toHaveLength(0)
    expect(marks(container)).toEqual([])
    for (const name of ['Vuln Bird', 'Common Bird', 'Plain Bird', 'Critical Bird']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })
})

describe('ListView marks', () => {
  const list = () => render(<ListView entries={entries} species={species} regions={{ countries: {}, sub1: {} } as never} order="heaviest" onPick={() => {}} />)
  const rowOf = (c: HTMLElement, code: string) => c.querySelector(`[data-code="${code}"]`) as HTMLElement
  it('the pill on threatened rows, with the status in the row\u2019s name; none on LC or without a status', () => {
    const { container } = list()
    expect(rowOf(container, 'vulbi').querySelector('.eb-smark')).toHaveTextContent('VU')
    expect(rowOf(container, 'vulbi')).toHaveTextContent('Vuln Bird, Vulnerable')
    expect(rowOf(container, 'lcbir').querySelector('.eb-smark')).toBeNull()
    expect(rowOf(container, 'nonbi').querySelector('.eb-smark')).toBeNull()
    expect(container.querySelectorAll('.eb-smark')).toHaveLength(2)
  })
  it('the mark is aria-hidden and the status words are screen-reader text', () => {
    const { container } = list()
    for (const m of container.querySelectorAll('.eb-smark')) expect(m).toHaveAttribute('aria-hidden', 'true')
    expect(rowOf(container, 'vulbi').querySelector('.eb-sr')).toHaveTextContent(', Vulnerable')
  })
})
