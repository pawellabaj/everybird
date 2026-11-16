// @vitest-environment jsdom
// Loading local bird names: loadNames' cache and retry, useLoadNames (no request in English, a stale answer ignored,
// the idle wait with no list), the one page-level `storage` listener, and the English switch read before mount.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BirdCard } from '@/components/collage/BirdCard'
import type { ListEntry } from '@/lib/list/model'
import { buildSpeciesIndex } from '@/lib/species/load'
import { displayName, EN_NAMES_KEY, englishNames, loadNames, setEnglishNames, setNames, subscribeNames, type NameSet } from '@/lib/species/names'
import { useLoadNames } from '@/lib/species/use-names'
import type { SpeciesRow } from '@/lib/species/types'
import { withI18n } from './i18n-render'

const fetchData = vi.hoisted(() => vi.fn())
vi.mock('@/lib/data-url', () => ({ fetchData }))

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

const set = (locale: NameSet['locale'], names: Record<string, string>): NameSet => ({ v: 1, locale, taxonomy: 't', names, fam: {} })
const entry = (code: string): ListEntry => ({ code, heard: false, dead: false, media: false, sources: ['manual'] })
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  fetchData.mockReset()
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('navigator', { languages: ['es-CO'], language: 'es-CO' })
  setEnglishNames(false)
})
afterEach(() => {
  cleanup()
  act(() => { setNames(null); setEnglishNames(false) })
  vi.unstubAllGlobals()
})

describe('loadNames', () => {
  it('fetches a locale once, and a failure is not cached: the next call asks again', async () => {
    fetchData.mockResolvedValueOnce(set('nl', { houspa: 'Huismus' }))
    const [a, b] = [loadNames('nl'), loadNames('nl')]
    expect(a).toBe(b)
    await a
    await loadNames('nl')
    expect(fetchData).toHaveBeenCalledTimes(1)
    expect(fetchData).toHaveBeenCalledWith('names.nl.v1.json')

    fetchData.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(set('pt_BR', { houspa: 'Pardal' }))
    await expect(loadNames('pt_BR')).rejects.toThrow('offline')
    await flush()
    await expect(loadNames('pt_BR')).resolves.toMatchObject({ locale: 'pt_BR' })
    expect(fetchData).toHaveBeenCalledTimes(3)
  })
})

function Loader({ list }: { list: ListEntry[] }) {
  useLoadNames(list)
  return null
}

describe('useLoadNames', () => {
  it('asks for nothing in English and clears the names', async () => {
    setNames(set('es', { houspa: 'Gorrión' }))
    render(<Loader list={[entry('houspa')]} />, { wrapper: withI18n('en') })
    await flush()
    expect(fetchData).not.toHaveBeenCalled()
    expect(displayName({ code: 'houspa', com: 'House Sparrow' })).toBe('House Sparrow')
  })

  it('with a list, asks at once and shows the names; an answer that arrives after the language left is ignored', async () => {
    let resolve!: (s: NameSet) => void
    fetchData.mockReturnValueOnce(new Promise<NameSet>((r) => { resolve = r }))
    const { unmount } = render(<Loader list={[entry('houspa')]} />, { wrapper: withI18n('es') })
    expect(fetchData).toHaveBeenCalledWith('names.es.v1.json')
    unmount()
    await act(async () => { resolve(set('es', { houspa: 'Gorrión común' })) })
    expect(displayName({ code: 'houspa', com: 'House Sparrow' })).toBe('House Sparrow') // stale: never applied

    fetchData.mockResolvedValueOnce(set('nl', { houspa: 'Huismus' }))
    render(<Loader list={[entry('houspa')]} />, { wrapper: withI18n('nl') })
    await flush()
    expect(displayName({ code: 'houspa', com: 'House Sparrow' })).toBe('Huismus')
  })

  it('with no list the request waits for an idle moment, and a list arriving first takes over', async () => {
    const idle: (() => void)[] = []
    vi.stubGlobal('requestIdleCallback', (f: () => void) => idle.push(f))
    vi.stubGlobal('cancelIdleCallback', () => {})
    vi.stubGlobal('navigator', { languages: ['pt-PT'], language: 'pt-PT' }) // a locale no other test loads (the cache is per module)
    fetchData.mockResolvedValue(set('pt_PT', { houspa: 'Pardal' }))
    const { rerender } = render(<Loader list={[]} />, { wrapper: withI18n('pt') })
    expect(fetchData).not.toHaveBeenCalled()
    expect(idle).toHaveLength(1)
    rerender(<Loader list={[entry('houspa')]} />)
    expect(fetchData).toHaveBeenCalledTimes(1) // the list asked at once
    idle[0]() // the cancelled idle callback may still fire; it must not matter
    await flush()
    expect(displayName({ code: 'houspa', com: 'House Sparrow' })).toBe('Pardal')
  })
})

describe('the page-level storage listener', () => {
  it('is added when the first subscriber arrives, shared by the rest, and removed with the last', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const count = (spy: typeof add, type: string) => spy.mock.calls.filter((c) => c[0] === type).length
    const f1 = vi.fn(), f2 = vi.fn()
    const off1 = subscribeNames(f1)
    const off2 = subscribeNames(f2)
    expect(count(add, 'storage')).toBe(1)
    window.dispatchEvent(new StorageEvent('storage', { key: EN_NAMES_KEY }))
    expect(f1).toHaveBeenCalledTimes(1) // one bump per event, not one per subscriber
    expect(f2).toHaveBeenCalledTimes(1)
    off1()
    expect(count(remove, 'storage')).toBe(0)
    off2()
    expect(count(remove, 'storage')).toBe(1)
    window.dispatchEvent(new StorageEvent('storage', { key: EN_NAMES_KEY }))
    expect(f1).toHaveBeenCalledTimes(1)
    add.mockRestore()
    remove.mockRestore()
  })

  it('another tab flipping the switch is read again', () => {
    const off = subscribeNames(() => {})
    expect(englishNames()).toBe(false)
    localStorage.setItem(EN_NAMES_KEY, '1')
    window.dispatchEvent(new StorageEvent('storage', { key: EN_NAMES_KEY }))
    expect(englishNames()).toBe(true)
    off()
  })
})

describe('the English switch stored before mount', () => {
  it('shows English names although a set is loaded', () => {
    const row: SpeciesRow = { code: 'houspa', com: 'House Sparrow', sci: 'Passer domesticus', ord: 'Passeriformes', fam: 'Passeridae', famCom: 'Old World Sparrows', to: 1, g: 30, gSrc: 'avonet', st: true, ar: 1, q: true }
    const species = buildSpeciesIndex([row])
    localStorage.setItem(EN_NAMES_KEY, '1')
    setNames(set('es', { houspa: 'Gorrión común' }))
    render(<BirdCard entry={entry('houspa')} species={species} regions={{ v: 1, countries: {}, sub1: {} }} onClose={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByRole('heading', { name: 'House Sparrow' })).toBeInTheDocument()
  })
})
