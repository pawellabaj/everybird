// @vitest-environment jsdom
// Local bird names in the UI: the card, the list rows, the dock search (finds by either language), Tick by hand and the
// English-names switch, with a small synthetic NameSet (never the real files).
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnglishNamesSwitch } from '@/components/app/LanguageField'
import { DockSearchField } from '@/components/app/DockSearch'
import { BirdCard } from '@/components/collage/BirdCard'
import { ListView } from '@/components/collage/ListView'
import { TickList } from '@/components/import/TickList'
import { EMPTY_EDITS, type ListEntry } from '@/lib/list/model'
import { buildSpeciesIndex } from '@/lib/species/load'
import { setEnglishNames, setNames, type NameSet } from '@/lib/species/names'
import type { Regions, SpeciesRow } from '@/lib/species/types'
import { withI18n } from './i18n-render'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

const row = (code: string, com: string, to: number, fam = 'Passeridae', famCom = 'Old World Sparrows'): SpeciesRow => ({
  code, com, sci: `Avis ${code}`, ord: 'Passeriformes', fam, famCom, to, g: 30, gSrc: 'avonet', st: true, ar: 1, q: true,
})
const species = buildSpeciesIndex([row('houspa', 'House Sparrow', 1), row('amerob', 'American Robin', 2, 'Turdidae', 'Thrushes'), row('newbrd', 'New Bird', 3)])
const regions: Regions = { v: 1, countries: { CA: 'Canada' }, sub1: {} }
const entry = (code: string): ListEntry => ({ code, heard: false, dead: false, media: false, sources: ['manual'] })
const set = (locale: NameSet['locale'], names: Record<string, string>, fam: Record<string, string> = {}): NameSet => ({ v: 1, locale, taxonomy: 't', names, fam })

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('innerWidth', 1000)
  setEnglishNames(false)
})
afterEach(() => {
  cleanup()
  act(() => { setNames(null); setEnglishNames(false) })
  vi.unstubAllGlobals()
})

describe('names in the UI', () => {
  it('the card and the list row show the local name, and a code the set lacks stays English', () => {
    setNames(set('es', { houspa: 'Gorrión común' }))
    render(<BirdCard entry={entry('houspa')} species={species} regions={regions} onClose={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByRole('dialog', { name: 'Gorrión común' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gorrión común' })).toBeInTheDocument()
    cleanup()
    render(<ListView entries={[entry('houspa'), entry('newbrd')]} species={species} regions={regions} order="heaviest" onPick={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByText('Gorrión común')).toBeInTheDocument()
    expect(screen.getByText('New Bird')).toBeInTheDocument()
  })

  it('the card re-renders when the names arrive', () => {
    render(<BirdCard entry={entry('houspa')} species={species} regions={regions} onClose={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByRole('dialog', { name: 'House Sparrow' })).toBeInTheDocument()
    act(() => setNames(set('es', { houspa: 'Gorrión común' })))
    expect(screen.getByRole('dialog', { name: 'Gorrión común' })).toBeInTheDocument()
  })

  it('the dock search finds a bird by its English name, and shows the local one', () => {
    setNames(set('es', { amerob: 'Zorzal americano' }))
    render(
      <DockSearchField entries={[entry('amerob'), entry('houspa')]} species={species} onPick={() => {}} open onClose={() => {}} within={createRef<HTMLElement>()} filter={{}} onApply={() => {}} regions={regions} listPlaces={[]} hasMonths={false} />,
      { wrapper: withI18n('es') },
    )
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'robin' } })
    expect(screen.getByText(/Zorzal americano/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'zorzal' } })
    expect(screen.getByText(/Zorzal americano/)).toBeInTheDocument()
  })

  it('the English-names switch shows English, is read back from everybird:en-names, and Spanish names return when it is off', () => {
    setNames(set('es', { houspa: 'Gorrión común' }))
    render(
      <>
        <EnglishNamesSwitch />
        <ListView entries={[entry('houspa')]} species={species} regions={regions} order="heaviest" onPick={() => {}} />
      </>,
      { wrapper: withI18n('es') },
    )
    expect(screen.getByText('Gorrión común')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))
    expect(localStorage.getItem('everybird:en-names')).toBe('1')
    expect(screen.getByText('House Sparrow')).toBeInTheDocument()
    expect(screen.queryByText('Gorrión común')).toBeNull()
    fireEvent.click(screen.getByRole('switch'))
    expect(localStorage.getItem('everybird:en-names')).toBeNull()
    expect(screen.getByText('Gorrión común')).toBeInTheDocument()
  })

  describe("Tick by hand's search", () => {
    const tick = (lang: 'pt' | 'nl') =>
      render(<TickList species={species} regions={regions} edits={EMPTY_EDITS} dispatch={() => {}} onList={new Set()} />, { wrapper: withI18n(lang) })
    const type = (q: string) => fireEvent.change(document.querySelector('input[type="search"]')!, { target: { value: q } })

    it('finds "pardal" with a pt_BR set (and "sparrow" still works)', async () => {
      setNames(set('pt_BR', { houspa: 'Pardal' }))
      tick('pt')
      type('pardal')
      expect(await screen.findByText('Pardal')).toBeInTheDocument()
      type('sparrow')
      expect(await screen.findByText('Pardal')).toBeInTheDocument()
    })

    it('finds "huismus" with an nl set', async () => {
      setNames(set('nl', { houspa: 'Huismus' }))
      tick('nl')
      type('huismus')
      expect(await screen.findByText('Huismus')).toBeInTheDocument()
      expect(screen.queryByText('New Bird')).toBeNull()
    })
  })
})
