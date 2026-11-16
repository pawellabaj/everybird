// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChipRow } from '@/components/filters/ChipRow'
import { ALL, type Chip } from '@/lib/list/chips'

afterEach(cleanup)

const place = (label: string, token: string, spoken?: string): Chip => ({ kind: 'place', label, token, spoken })
const three = [place('Egypt', 'c:EG'), place('Canada', 'c:CA'), place('British Columbia', 's:CA-BC', 'British Columbia, Canada')]

describe('ChipRow', () => {
  it('single chips are one remove button each, named "Remove … filter"', () => {
    const onRemove = vi.fn()
    render(<ChipRow chips={three} label="Active filters" onRemove={onRemove} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Remove British Columbia, Canada filter' }))
    expect(onRemove).toHaveBeenCalledWith(three[2])
    expect(screen.getByRole('button', { name: 'Remove Egypt filter' })).toBeInTheDocument()
  })

  it('a collapsed chip: the label opens, the × clears', () => {
    const chip = place('4 places', ALL)
    const onOpen = vi.fn()
    const onRemove = vi.fn()
    const { rerender } = render(<ChipRow chips={[chip]} label="Active filters" onRemove={onRemove} onOpen={onOpen} />)
    const open = screen.getByTestId('chip-place-open')
    expect(open).toHaveAccessibleName('Show 4 places in Filters')
    expect(open).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByTestId('chip-place-clear')).toHaveAccessibleName('Remove all 4 places')
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith(chip, open)
    fireEvent.click(screen.getByTestId('chip-place-clear'))
    expect(onRemove).toHaveBeenCalledWith(chip)
    rerender(<ChipRow chips={[chip]} label="Active filters" onRemove={onRemove} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('removing a chip moves focus to its neighbour, the last one calls onEmpty', () => {
    const onEmpty = vi.fn()
    function Harness() {
      const [chips, setChips] = useState(three)
      return <ChipRow chips={chips} label="Active filters" onRemove={(c) => setChips((cs) => cs.filter((x) => x !== c))} onEmpty={onEmpty} />
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Canada filter' }))
    expect(screen.getAllByRole('button')[1]).toHaveAccessibleName('Remove British Columbia, Canada filter')
    expect(screen.getAllByRole('button')[1]).toHaveFocus()
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(screen.getByRole('button', { name: 'Remove Egypt filter' })).toHaveFocus()
    expect(onEmpty).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Egypt filter' }))
    expect(onEmpty).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('chips that change without a chip press move no focus and call nothing', () => {
    const onEmpty = vi.fn()
    const { rerender } = render(
      <>
        <button>outside</button>
        <ChipRow chips={three} label="Active filters" onRemove={() => {}} onEmpty={onEmpty} />
      </>,
    )
    screen.getByText('outside').focus()
    rerender(
      <>
        <button>outside</button>
        <ChipRow chips={three.slice(1)} label="Active filters" onRemove={() => {}} onEmpty={onEmpty} />
      </>,
    )
    rerender(
      <>
        <button>outside</button>
        <ChipRow chips={[]} label="Active filters" onRemove={() => {}} onEmpty={onEmpty} />
      </>,
    )
    expect(screen.getByText('outside')).toHaveFocus()
    expect(onEmpty).not.toHaveBeenCalled()
  })

  it('the row is a group named by label; no chips, no row', () => {
    const { rerender } = render(<ChipRow chips={three} label="Active filters" onRemove={() => {}} />)
    expect(screen.getByRole('group', { name: 'Active filters' })).toBeInTheDocument()
    rerender(<ChipRow chips={[]} label="Active filters" onRemove={() => {}} />)
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('Clear all ends the row at two or more chips, only when given', () => {
    const onClearAll = vi.fn()
    const { rerender } = render(<ChipRow chips={three.slice(0, 1)} label="Active filters" onRemove={() => {}} onClearAll={onClearAll} />)
    expect(screen.queryByTestId('chips-clear-all')).toBeNull()
    rerender(<ChipRow chips={three.slice(0, 2)} label="Active filters" onRemove={() => {}} onClearAll={onClearAll} />)
    const clear = screen.getByTestId('chips-clear-all')
    expect(clear).toHaveAccessibleName('Clear all filters')
    expect(clear).toHaveTextContent('Clear all')
    fireEvent.click(clear)
    expect(onClearAll).toHaveBeenCalledTimes(1)
    rerender(<ChipRow chips={three} label="Active filters" onRemove={() => {}} />)
    expect(screen.queryByTestId('chips-clear-all')).toBeNull()
    // One chip plus a taxonomy choice is two active filters.
    rerender(<ChipRow chips={three.slice(0, 1)} active={2} label="Active filters" onRemove={() => {}} onClearAll={onClearAll} />)
    expect(screen.getByTestId('chips-clear-all')).toBeInTheDocument()
  })
})
