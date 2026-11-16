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

const marks = (c: HTMLElement) => [...c.querySelectorAll('.eb-bird')].filter((b) => b.querySelector('.eb-status')).map((b) => b.getAttribute('data-code')!)
const stage = () => render(<Collage entries={entries} species={species} layout={layout} visible={visible} mode="even" onPick={() => {}} />)

describe('Collage marks', () => {
  it('threatened birds only (VU, CR), as pills with their abbreviation; none for LC or a bird without a status', () => {
    const { container } = stage()
    expect(marks(container).sort()).toEqual(['crbir', 'vulbi'])
    expect(container.querySelector('[data-code="vulbi"] .eb-status')).toHaveTextContent('VU')
    expect(container.querySelector('[data-code="crbir"] .eb-status')).toHaveTextContent('CR')
  })
  it('marks are aria-hidden', () => {
    for (const m of stage().container.querySelectorAll('.eb-status')) expect(m).toHaveAttribute('aria-hidden', 'true')
  })
  it('button names carry the status only for marked birds', () => {
    stage()
    expect(screen.getByRole('button', { name: 'Vuln Bird, Vulnerable' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Critical Bird, Critically Endangered' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Common Bird' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plain Bird' })).toBeInTheDocument()
  })
  it('leaves a mark out (data-nomark) on a sticker too small for it, once the layout is in', () => {
    const small: StateLayout = { ...layout, boxes: new Map(Object.entries({ ...boxes, vulbi: [10, 10, 20, 20] })) }
    const { container } = render(<Collage entries={entries} species={species} layout={small} visible={visible} mode="even" onPick={() => {}} />)
    expect(container.querySelector('[data-code="vulbi"]')).toHaveAttribute('data-nomark')
    expect(container.querySelector('[data-code="crbir"]')).not.toHaveAttribute('data-nomark')
  })
  it('a windowed list (over 1,500 entries) renders marks on its birds too', () => {
    const many = Array.from({ length: 1501 }, (_, i) => `b${i}`)
    const sp = buildSpeciesIndex(many.map((c, i) => row(c, `Bird ${i}`, i, i % 2 ? 'EN' : undefined)))
    const es: ListEntry[] = many.map((code) => ({ code, heard: false, dead: false, media: false, sources: ['manual'] }))
    const bx = new Map(many.map((c, i) => [c, [(i % 40) * 8, Math.floor(i / 40) * 8, 7, 7] as Box]))
    const L: StateLayout = { key: 'narrow|even|y', layout: 'narrow', mode: 'even', W: 350, H: 400, boxes: bx, scale: 1, base: 20 }
    const { container } = render(<Collage entries={es} species={sp} layout={L} visible={new Set(many)} mode="even" onPick={() => {}} />)
    expect(container.querySelectorAll('.eb-status')).toHaveLength(750)
    expect(container.querySelector('[data-code="b1"]')).toHaveAttribute('data-nomark') // 7px: too small
  })
})

describe('ListView marks', () => {
  const list = () => render(<ListView entries={entries} species={species} regions={{ countries: {}, sub1: {} } as never} order="heaviest" onPick={() => {}} />)
  const rowOf = (c: HTMLElement, code: string) => c.querySelector(`[data-code="${code}"]`) as HTMLElement
  it('the pill on threatened rows, with the status in the row\u2019s name; none on LC or without a status', () => {
    const { container } = list()
    expect(rowOf(container, 'vulbi').querySelector('.eb-status')).toHaveTextContent('VU')
    expect(rowOf(container, 'vulbi')).toHaveTextContent('Vuln Bird, Vulnerable')
    expect(rowOf(container, 'lcbir').querySelector('.eb-status')).toBeNull()
    expect(rowOf(container, 'nonbi').querySelector('.eb-status')).toBeNull()
    expect(container.querySelectorAll('.eb-status')).toHaveLength(2)
  })
  it('the mark is aria-hidden and the status words are screen-reader text', () => {
    const { container } = list()
    for (const m of container.querySelectorAll('.eb-status')) expect(m).toHaveAttribute('aria-hidden', 'true')
    expect(rowOf(container, 'vulbi').querySelector('.eb-sr')).toHaveTextContent(', Vulnerable')
  })
})
