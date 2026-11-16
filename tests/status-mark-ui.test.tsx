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

describe('Collage marks', () => {
  it('threatened birds only (VU, CR), as pills with their abbreviation; none for LC or a bird without a status', () => {
    const { container } = stage()
    expect(marks(container).sort()).toEqual(['crbir', 'vulbi'])
    expect(container.querySelector('[data-code="vulbi"] .eb-smark')).toHaveTextContent('VU')
    expect(container.querySelector('[data-code="crbir"] .eb-smark')).toHaveTextContent('CR')
  })
  it('marks are aria-hidden', () => {
    for (const m of stage().container.querySelectorAll('.eb-smark')) expect(m).toHaveAttribute('aria-hidden', 'true')
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
  it('data-nomark follows the layout on a rerender: a bird growing past 32px gains its mark, shrinking loses it', () => {
    const at = (side: number): StateLayout => ({ ...layout, key: `narrow|even|${side}`, boxes: new Map(Object.entries({ ...boxes, vulbi: [10, 10, side, side] })) })
    const props = { entries, species, visible, mode: 'even' as const, onPick: () => {} }
    const { container, rerender } = render(<Collage {...props} layout={at(20)} />)
    const vul = () => container.querySelector('[data-code="vulbi"]')!
    expect(vul()).toHaveAttribute('data-nomark')
    rerender(<Collage {...props} layout={at(80)} />)
    expect(vul()).not.toHaveAttribute('data-nomark')
    rerender(<Collage {...props} layout={at(20)} />)
    expect(vul()).toHaveAttribute('data-nomark')
  })
  it('data-nomark follows the count: a bigger count\u2019s hole reaches a corner that a smaller one\u2019s left clear', () => {
    // 350px narrow stage: a 60px box at x 170 keeps clear of the one-digit count's hole (3 shown) and not of the three-digit count's (120 shown).
    const codes120 = ['a', ...Array.from({ length: 119 }, (_, i) => `f${i}`)]
    const sp = buildSpeciesIndex(codes120.map((c, i) => row(c, `Bird ${i}`, i, c === 'a' ? 'EN' : undefined)))
    const es: ListEntry[] = codes120.map((code) => ({ code, heard: false, dead: false, media: false, sources: ['manual'] }))
    const bx = new Map<string, Box>([['a', [170, 150, 60, 60]], ...codes120.slice(1).map((c, i) => [c, [(i % 10) * 4, 330 + Math.floor(i / 10) * 4, 3, 3] as Box] as [string, Box]).slice(0, 119)])
    const L: StateLayout = { key: 'narrow|even|c', layout: 'narrow', mode: 'even', W: 350, H: 400, boxes: bx, scale: 1, base: 20 }
    const few = new Set(['a', 'f0', 'f1'])
    const props = { entries: es, species: sp, layout: L, mode: 'even' as const, onPick: () => {} }
    const { container, rerender } = render(<Collage {...props} visible={few} />)
    const a = () => container.querySelector('[data-code="a"]')!
    expect(a()).not.toHaveAttribute('data-nomark')
    rerender(<Collage {...props} visible={new Set(codes120)} />)
    expect(a()).toHaveAttribute('data-nomark')
    rerender(<Collage {...props} visible={few} />)
    expect(a()).not.toHaveAttribute('data-nomark')
  })
  it('a windowed list (over 1,500 entries) renders marks on its birds too', () => {
    const many = Array.from({ length: 1501 }, (_, i) => `b${i}`)
    const sp = buildSpeciesIndex(many.map((c, i) => row(c, `Bird ${i}`, i, i % 2 ? 'EN' : undefined)))
    const es: ListEntry[] = many.map((code) => ({ code, heard: false, dead: false, media: false, sources: ['manual'] }))
    const bx = new Map(many.map((c, i) => [c, [(i % 40) * 8, Math.floor(i / 40) * 8, 7, 7] as Box]))
    const L: StateLayout = { key: 'narrow|even|y', layout: 'narrow', mode: 'even', W: 350, H: 400, boxes: bx, scale: 1, base: 20 }
    const { container } = render(<Collage entries={es} species={sp} layout={L} visible={new Set(many)} mode="even" onPick={() => {}} />)
    expect(container.querySelectorAll('.eb-smark')).toHaveLength(750)
    expect(container.querySelector('[data-code="b1"]')).toHaveAttribute('data-nomark') // 7px: too small
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
