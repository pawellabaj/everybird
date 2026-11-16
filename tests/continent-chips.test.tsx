// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContinentChips } from '@/components/filters/ContinentChips'
import { placeCounts, type Filter } from '@/lib/list/filters'
import type { ListEntry } from '@/lib/list/model'
import type { SpeciesIndex } from '@/lib/species/load'

afterEach(cleanup)

const rows = [{ code: 'duck', ord: 'Anseriformes', fam: 'Anatidae' }, { code: 'crow', ord: 'Passeriformes', fam: 'Corvidae' }] as never[]
const species = { rows, byCode: new Map(rows.map((r) => [(r as { code: string }).code, r])), search: () => [] } as unknown as SpeciesIndex
const e = (code: string, country: string): ListEntry => ({ code, date: '2020-01-01', place: { country }, heard: false, dead: false, media: false, sources: [] })
// Duck in Canada (North America), crow in Egypt (Africa). No Europe, no Asia: those chips are not shown.
const list = [e('duck', 'CA'), e('crow', 'EG')]

function chips(filter: Filter, onFilter = vi.fn()) {
  const counts = placeCounts(list, {}, species)
  render(<ContinentChips counts={counts} filter={filter} onFilter={onFilter} />)
  return onFilter
}

describe('ContinentChips', () => {
  it('shows only the continents with species, each with its count, in display order', () => {
    chips({})
    expect(screen.getByRole('group', { name: 'Continents' })).toBeInTheDocument()
    expect(screen.getByTestId('continent-AF')).toHaveTextContent('Africa')
    expect(screen.getByTestId('continent-AF')).toHaveTextContent('1')
    expect(screen.getByTestId('continent-NA')).toBeInTheDocument()
    expect(screen.queryByTestId('continent-EU')).toBeNull()
    const ids = Array.from(document.querySelectorAll('[data-testid^="continent-"]')).map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['continent-AF', 'continent-NA'])
  })

  it('a chip is a toggle: pressed while chosen, a tap adds it, a second tap clears it', () => {
    const onFilter = chips({ continents: ['AF'] })
    expect(screen.getByTestId('continent-AF')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('continent-NA')).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByTestId('continent-NA'))
    expect(onFilter).toHaveBeenLastCalledWith({ continents: ['AF', 'NA'] })
    fireEvent.click(screen.getByTestId('continent-AF'))
    expect(onFilter).toHaveBeenLastCalledWith({})
  })

  it('a checked continent with no species under the other filters stays, at 0', () => {
    chips({ continents: ['SA'] })
    expect(screen.getByTestId('continent-SA')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('continent-SA')).toHaveTextContent('0')
  })
})
