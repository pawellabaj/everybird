// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ebirdLine, inatLine } from '@/components/import/SourceLine'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { SourceMenu } from '@/components/import/SourceMenu'

afterEach(cleanup)

describe('SourceMenu: a source row’s ⋯ menu button', () => {
  const setup = () => {
    const refresh = vi.fn()
    const remove = vi.fn()
    render(<SourceMenu label="More for iNaturalist" items={[{ label: 'Refresh', onSelect: refresh }, { label: 'Change username', onSelect: () => {} }, { label: 'Remove', danger: true, keepFocus: true, onSelect: remove }]} />)
    return { btn: screen.getByRole('button', { name: 'More for iNaturalist' }), refresh, remove }
  }

  it('is a menu button; ArrowDown opens on the first item, the arrows wrap, Home/End jump, Escape closes back to the button', () => {
    const { btn } = setup()
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'More for iNaturalist' })
    expect(btn).toHaveAttribute('aria-controls', menu.id)
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(items[2]).toHaveFocus()
    expect(items[2]).toHaveAttribute('data-danger')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'End' })
    expect(items[2]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(btn).toHaveFocus()
  })

  it('ArrowUp opens on the last item; picking closes the menu and runs the item; a press outside closes it', () => {
    const { btn, refresh, remove } = setup()
    fireEvent.keyDown(btn, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toHaveFocus()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))
    expect(remove).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(btn).toHaveFocus()
    fireEvent.click(btn)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('ebirdLine and inatLine: a connected row’s name and date', () => {
  const now = new Date('2026-11-06T12:00:00Z')
  it('leaves the year off this year’s dates, and says nothing for a bad one', () => {
    const at = (iso: string) => ebirdLine('life-list', { kind: 'life-list', file: 'a.csv', at: iso }, en.ui, now).parts
    expect(at('2026-11-06T10:00:00Z')).toEqual(['Imported 6 Nov'])
    expect(at('2025-03-01T10:00:00Z')).toEqual(['Imported 1 Mar 2025'])
    expect(at('2026-09-06T10:00:00Z')).toEqual(['Imported 6 Sep'])
    expect(at('nope')).toEqual([])
    expect(inatLine({ user: 'sam', observations: 3, at: '2026-11-06T10:00:00Z' }, en.ui, now)).toEqual({ name: 'sam', parts: ['Updated 6 Nov'] })
  })
  it('in Spanish, with the fallbacks', () => {
    expect(ebirdLine('full-export', { kind: 'full-export', at: '2026-09-06T10:00:00Z' }, es.ui, now)).toEqual({ name: 'Exportación completa de eBird', parts: ['Importado el 6 sept'] })
    expect(ebirdLine('life-list', undefined, es.ui, now)).toEqual({ name: 'Descarga de la lista de vida de eBird', parts: ['Detalles desconocidos'] })
    expect(inatLine(undefined, en.ui)).toEqual({ name: '', parts: ['Username unknown: enter it again to refresh'] })
  })
})
