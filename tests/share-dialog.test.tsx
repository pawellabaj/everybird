// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareDialog from '@/components/share/ShareDialog'
import * as image from '@/lib/share/image'
import { track } from '@/lib/analytics'
import { downloadBlob } from '@/lib/download'
import type { ListEntry } from '@/lib/list/model'
import { initialState } from '@/lib/list/store'
import { decodeShare } from '@/lib/share/link'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'

// The renderer is replaced by a promise the test resolves, so "busy" is under the test's control.
const renders: { resolve: (b: Blob) => void }[] = []
vi.mock('@/lib/share/image', async (orig) => ({
  ...(await orig<typeof import('@/lib/share/image')>()),
  packForImage: vi.fn(async () => ({ boxes: [] })),
  renderShareImage: vi.fn(() => new Promise<Blob>((resolve) => renders.push({ resolve }))),
  clearStickerCache: vi.fn(),
}))

// The poster is made by a promise the test settles; it records the progress callback, the signal and the opts.
type FakePoster = { size: string; bytes: number; soft: number; missing: number; file: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }
const makes: { opts: { size: string; signal?: AbortSignal; pack?: unknown }; onProgress: (d: number, t: number) => void; resolve: (p: FakePoster) => void; reject: (e: unknown) => void }[] = []
const posterMock = () => ({
  makePoster: vi.fn((opts, onProgress) => new Promise((resolve, reject) => makes.push({ opts, onProgress, resolve, reject }))),
})
vi.mock('@/lib/share/poster', () => posterMock()) // called at the first import, once posterMock exists
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }))
const fakePoster = (over: Partial<FakePoster> = {}): FakePoster => ({
  size: 'A4', bytes: 1, soft: 0, missing: 0,
  file: vi.fn(async (kind: string) => new Blob([kind], { type: kind === 'png' ? 'image/png' : 'application/pdf' })),
  dispose: vi.fn(),
  ...over,
})

const row = (code: string, to: number) => ({ code, com: code, sci: code, ord: 'Struthioniformes', fam: 'Struthionidae', famCom: 'Ostriches', to, g: 100000, gSrc: 'family', st: true, ar: 1, q: true }) as SpeciesRow
const species = buildSpeciesIndex([row('ostric2', 1), row('emu1', 2)])
const regions = { v: 1 as const, countries: { CA: 'Canada' }, sub1: {} }
const entry = (code: string): ListEntry => ({ code, date: '2020-05', place: { country: 'CA' }, heard: false, dead: false, media: false, sources: ['ebird'] })
const stateWith = (list: ListEntry[]) => ({ ...initialState(), list })

beforeEach(() => {
  renders.length = 0
  makes.length = 0
  vi.mocked(track).mockClear()
  vi.mocked(downloadBlob).mockClear()
  vi.mocked(image.packForImage).mockClear()
  vi.mocked(image.renderShareImage).mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState(null, '', '/') })

describe('share dialog', () => {
  it('"Collage title" starts from Settings > Name your collage; editing it changes only this share, never the saved title', async () => {
    const dispatch = vi.fn()
    const state = stateWith([entry('ostric2')])
    state.saved = { ...state.saved, name: "Ada's big year" }
    render(<ShareDialog state={state} dispatch={dispatch} species={species} regions={regions} onClose={() => {}} />)
    const field = screen.getByLabelText('Collage title') as HTMLInputElement
    expect(field.value).toBe("Ada's big year")
    fireEvent.change(field, { target: { value: 'Ada B.' } })
    expect(field.value).toBe('Ada B.')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('disables Share image and Download image while the image renders', async () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    const shareBtn = screen.getByRole('button', { name: 'Share image' }) as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: 'Download image' }) as HTMLButtonElement
    expect(shareBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Copy link' }) as HTMLButtonElement).disabled).toBe(false)
    await waitFor(() => expect(renders).toHaveLength(1))
    await act(async () => renders[0].resolve(new Blob(['png'], { type: 'image/png' })))
    await waitFor(() => expect(shareBtn.disabled).toBe(false))
    expect(dlBtn.disabled).toBe(false)
  })

  it('Share image hands the share sheet the image and the full sticker credit as its text', async () => {
    const share = vi.fn<(d: ShareData) => Promise<void>>(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true })
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    await waitFor(() => expect(renders).toHaveLength(1))
    await act(async () => renders[0].resolve(new Blob(['png'], { type: 'image/png' })))
    const btn = screen.getByRole('button', { name: 'Share image' }) as HTMLButtonElement
    await waitFor(() => expect(btn.disabled).toBe(false))
    fireEvent.click(btn)
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const data = share.mock.calls[0][0]
    expect(data.text).toBe('Stickers: huashu-bird-sticker (CC BY 4.0) github.com/alchaincyf/huashu-bird-sticker')
    expect(data.files?.[0].type).toBe('image/png')
  })

  it('copies a link without the birds the link index does not know, and says so', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<ShareDialog state={stateWith([entry('ostric2'), entry('notabird1'), entry('emu1')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const url = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(url).toMatch(/\/s\/1/)
    expect(decodeShare(url.split('/s/')[1]).birds.map((b) => b.code)).toEqual(['ostric2', 'emu1'])
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Link copied. 1 bird is too new for links and left out.'))
  })

  it('the image and the link carry the collage title verbatim, trimmed (no "\'s birds" added)', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const state = stateWith([entry('ostric2')])
    state.saved = { ...state.saved, name: 'Birds of 2026' }
    render(<ShareDialog state={state} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Collage title'), { target: { value: '  Kenya, 2026  ' } })
    await waitFor(() => expect(vi.mocked(image.renderShareImage).mock.calls.at(-1)?.[0].name).toBe('Kenya, 2026'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const url = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(decodeShare(url.split('/s/')[1])).toMatchObject({ name: 'Kenya, 2026', titled: true })
  })

  it('hands the clipboard a promised item inside the click where ClipboardItem exists (iOS keeps the gesture)', async () => {
    class FakeItem { constructor(readonly items: Record<string, Promise<Blob>>) {} }
    const write = vi.fn(async (items: FakeItem[]) => { await items[0].items['text/plain'] })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('ClipboardItem', FakeItem)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { write, writeText } })
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(write).toHaveBeenCalledTimes(1) // synchronously, before anything is awaited
    const blob = await (write.mock.calls[0][0][0] as FakeItem).items['text/plain']
    expect(await blob.text()).toMatch(/\/s\/1/)
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Link copied.'))
    expect(writeText).not.toHaveBeenCalled()
  })

  it('"Show latest lifer" is a switch, on by default; off re-renders without the row, packed for the taller collage', async () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    const sw = screen.getByRole('switch', { name: 'Show latest lifer' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(renders).toHaveLength(1))
    expect(vi.mocked(image.renderShareImage).mock.calls[0][0].latest).toBe(true)
    await act(async () => renders[0].resolve(new Blob(['on'], { type: 'image/png' })))
    const dl = screen.getByRole('button', { name: 'Download image' }) as HTMLButtonElement
    await waitFor(() => expect(dl.disabled).toBe(false))
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(dl.disabled).toBe(true) // the old image is never downloaded for the new state
    await waitFor(() => expect(renders).toHaveLength(2))
    expect(vi.mocked(image.renderShareImage).mock.calls.at(-1)![0].latest).toBe(false)
    expect(vi.mocked(image.packForImage).mock.calls.at(-1)![2]).toEqual(
      image.imagePackSpec('story', { name: false, filter: false, latest: false, count: 1 }))
  })

  it('turning the switch back on reuses the first pack', async () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    await waitFor(() => expect(renders).toHaveLength(1))
    const sw = screen.getByRole('switch', { name: 'Show latest lifer' })
    fireEvent.click(sw)
    await waitFor(() => expect(renders).toHaveLength(2))
    fireEvent.click(sw)
    await waitFor(() => expect(renders).toHaveLength(3))
    expect(vi.mocked(image.packForImage)).toHaveBeenCalledTimes(2)
  })

  it('with no dated bird in view there is no latest lifer, so no switch', () => {
    render(<ShareDialog state={stateWith([{ ...entry('ostric2'), date: undefined }])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    expect(screen.queryByRole('switch', { name: 'Show latest lifer' })).toBeNull()
  })

  it('each open starts with the switch on', () => {
    const { unmount } = render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Show latest lifer' }))
    unmount()
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Show latest lifer' })).toHaveAttribute('aria-checked', 'true')
  })

  it('ends with a quiet Buy me a coffee link (a plain link, new tab), never part of the image', () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: 'Buy me a coffee' })
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/yusuftaleb')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.querySelector('img, svg')).toBeNull()
  })

  it('has no note about what the link carries (About explains it)', () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    expect(screen.queryByText(/The link opens your whole collage/)).toBeNull()
    expect(screen.queryByText(/never towns or coordinates/)).toBeNull()
  })

  it("the preview box takes the rendered image's format, so it hugs the image", async () => {
    render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    const box = screen.getByTestId('share-preview')
    expect(box).toHaveAttribute('data-format', 'story')
    await waitFor(() => expect(renders).toHaveLength(1))
    await act(async () => renders[0].resolve(new Blob(['png'], { type: 'image/png' })))
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }))
    // Until the post image is ready the box keeps the story's shape around the story image.
    expect(box).toHaveAttribute('data-format', 'story')
    await waitFor(() => expect(renders).toHaveLength(2))
    await act(async () => renders[1].resolve(new Blob(['png'], { type: 'image/png' })))
    await waitFor(() => expect(box).toHaveAttribute('data-format', 'post'))
  })
})

describe('share dialog: print mode', () => {
  const open = () => render(<ShareDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
  const toPrint = () => fireEvent.click(screen.getByRole('button', { name: /^Print/ }))
  const startMake = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(1))
  }

  it('variant a: Print is a 4th format; choosing it shows Poster size A4–A1, A4 pressed, and Make poster', async () => {
    open()
    const formats = screen.getByRole('group', { name: 'Image format' })
    expect(formats).toHaveClass('eb-seg-4')
    expect(formats.querySelectorAll('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: /^Print/ }).textContent).toBe('PrintA4–A1')
    expect(screen.queryByRole('group', { name: 'Poster size' })).toBeNull()
    toPrint()
    expect(screen.getByRole('button', { name: /^Print/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Story/ })).toHaveAttribute('aria-pressed', 'false')
    const sizes = screen.getByRole('group', { name: 'Poster size' })
    expect([...sizes.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual(
      [['A4', 'true'], ['A3', 'false'], ['A2', 'false'], ['A1', 'false']])
    expect(screen.getByText('A4 · 21 × 29.7 cm · 1240 × 1754 px at 150 dpi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make poster' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share image' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A2' }))
    expect(screen.getByText('A2 · 42 × 59.4 cm · 2480 × 3508 px at 150 dpi')).toBeInTheDocument()
    // The preview is the poster's, always light, at the chosen size.
    await waitFor(() => expect(vi.mocked(image.renderShareImage).mock.calls.at(-1)?.[0]).toMatchObject({ format: 'print', printSize: 'A2', theme: 'light' }))
    await act(async () => renders.at(-1)!.resolve(new Blob(['png'], { type: 'image/png' })))
    await waitFor(() => expect(screen.getByTestId('share-preview')).toHaveAttribute('data-format', 'print'))
    const img = screen.getByAltText('Preview of the A2 poster')
    expect(img).toHaveAttribute('width', '1080')
    expect(img).toHaveAttribute('height', String(Math.round(1080 * 3508 / 2480)))
    // A share format leaves print mode.
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }))
    expect(screen.queryByRole('group', { name: 'Poster size' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Share image' })).toBeInTheDocument()
  })

  it.each([
    ['b', 'Print a poster'],
    ['c', 'Print a poster, A4 to A1'],
  ])('variant %s: a "%s" entry opens print mode; Share images goes back', async (v, label) => {
    history.replaceState(null, '', `/?v=print:${v}`)
    open()
    const formats = screen.getByRole('group', { name: 'Image format' })
    expect(formats).not.toHaveClass('eb-seg-4')
    expect(formats.querySelectorAll('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByRole('group', { name: 'Poster size' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Image format' })).toBeNull()
    const back = screen.getByRole('button', { name: 'Share images' })
    await waitFor(() => expect(back).toHaveFocus())
    expect(screen.queryByRole('button', { name: label })).toBeNull()
    fireEvent.click(back)
    expect(screen.getByRole('group', { name: 'Image format' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Poster size' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: label })).toHaveFocus())
  })

  it('Make poster shows a progressbar with Cancel; when done, Download PNG and Download PDF save everybird-a4.png/.pdf at once', async () => {
    open()
    toPrint()
    await startMake()
    expect(makes[0].opts.size).toBe('A4')
    expect(makes[0].opts.pack).toEqual({ boxes: [] }) // the dialog's print pack, so makePoster doesn't pack again
    const bar = screen.getByRole('progressbar', { name: 'Making the poster' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make poster' })).toBeNull()
    act(() => makes[0].onProgress(1, 4))
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    expect(screen.getByText('25%')).toBeInTheDocument()
    const p = fakePoster()
    await act(async () => makes[0].resolve(p))
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByTestId('share-note').textContent).toBe('Your A4 poster is ready.')
    const png = screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement
    const pdf = screen.getByRole('button', { name: 'Download PDF' }) as HTMLButtonElement
    expect(png.disabled).toBe(false)
    expect(pdf.disabled).toBe(false)
    fireEvent.click(png)
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('everybird-a4.png')
    expect(screen.getByTestId('share-note').textContent).toBe('Saved everybird-a4.png.')
    fireEvent.click(pdf)
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    expect(vi.mocked(downloadBlob).mock.calls[1][1]).toBe('everybird-a4.pdf')
    expect(p.file.mock.calls.map((c) => c[0])).toEqual(['png', 'pdf'])
  })

  it('Cancel aborts the make and shows Make poster again', async () => {
    open()
    toPrint()
    await startMake()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(makes[0].opts.signal?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: 'Make poster' })).toBeInTheDocument()
    await act(async () => makes[0].reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })))
    expect(screen.getByTestId('share-note').textContent).toBe('') // a cancel stays quiet
  })

  it('changing the size during a make aborts it (signal aborted) and shows Make poster again; no stale poster downloads', async () => {
    open()
    toPrint()
    await startMake()
    fireEvent.click(screen.getByRole('button', { name: 'A3' }))
    expect(makes[0].opts.signal?.aborted).toBe(true)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Make poster' })).toBeInTheDocument()
    // The old make finishing anyway is dropped, never offered.
    const stale = fakePoster()
    await act(async () => makes[0].resolve(stale))
    expect(stale.dispose).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull()
    // A finished poster is dropped by a new title too.
    await startMakeAgain()
    const p = fakePoster({ size: 'A3' })
    await act(async () => makes[1].resolve(p))
    expect(screen.getByTestId('share-note').textContent).toBe('Your A3 poster is ready.')
    fireEvent.change(screen.getByLabelText('Collage title'), { target: { value: 'Kenya' } })
    expect(p.dispose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull()
    expect(screen.getByTestId('share-note').textContent).toBe('')
    expect(downloadBlob).not.toHaveBeenCalled()

    async function startMakeAgain() {
      fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
      await waitFor(() => expect(makes).toHaveLength(2))
      expect(makes[1].opts.size).toBe('A3')
    }
  })

  it('leaving print mode aborts a make (variant a) and drops a finished poster (variant b)', async () => {
    const first = open()
    toPrint()
    await startMake()
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }))
    expect(makes[0].opts.signal?.aborted).toBe(true)
    first.unmount()

    makes.length = 0
    history.replaceState(null, '', '/?v=print:b')
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Print a poster' }))
    await startMake()
    const p = fakePoster()
    await act(async () => makes[0].resolve(p))
    fireEvent.click(screen.getByRole('button', { name: 'Share images' }))
    expect(p.dispose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Print a poster' }))
    expect(screen.getByRole('button', { name: 'Make poster' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull()
  })

  it('closing the dialog aborts the make and disposes the poster', async () => {
    const first = open()
    toPrint()
    await startMake()
    first.unmount()
    expect(makes[0].opts.signal?.aborted).toBe(true)

    makes.length = 0
    const second = open()
    toPrint()
    await startMake()
    const p = fakePoster()
    await act(async () => makes[0].resolve(p))
    expect(p.dispose).not.toHaveBeenCalled()
    second.unmount()
    expect(p.dispose).toHaveBeenCalledTimes(1)
  })

  it('soft > 0 shows the smaller-files note; missing > 0 the outlines note; a poster-memory error the try-a-smaller-size note', async () => {
    open()
    toPrint()
    await startMake()
    await act(async () => makes[0].resolve(fakePoster({ soft: 3, missing: 1 })))
    expect(screen.getByTestId('share-note').textContent).toBe(
      'Your A4 poster is ready. Some stickers come from smaller files for now, so the biggest birds may print a little soft. '
      + '1 sticker didn’t load and is drawn as an outline. Make the poster again to retry.')

    fireEvent.click(screen.getByRole('button', { name: 'A2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(2))
    await act(async () => makes[1].resolve(fakePoster({ size: 'A2', missing: 5 })))
    expect(screen.getByTestId('share-note').textContent).toBe(
      'Your A2 poster is ready. 5 stickers didn’t load and are drawn as outlines. Make the poster again to retry.')

    fireEvent.click(screen.getByRole('button', { name: 'A1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(3))
    await act(async () => makes[2].reject(new Error('poster-memory')))
    const note = screen.getByTestId('share-note')
    expect(note.textContent).toBe('Couldn’t make the poster. Try a smaller size.')
    expect(note).toHaveClass('eb-error')
    expect(screen.getByRole('button', { name: 'Make poster' })).toBeInTheDocument()

    // Any other failure says to try again.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(4))
    await act(async () => makes[3].reject(new Error('worker died')))
    expect(screen.getByTestId('share-note').textContent).toBe('Couldn’t make the poster. Try again.')
    warn.mockRestore()
  })

  it('announces the make in the status note, and a cancel clears it', async () => {
    open()
    toPrint()
    await startMake()
    expect(screen.getByTestId('share-note').textContent).toBe('Making the poster.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('share-note').textContent).toBe('')
  })

  it('a make that finishes after the dialog closed is disposed', async () => {
    const view = open()
    toPrint()
    await startMake()
    view.unmount()
    const p = fakePoster()
    await act(async () => makes[0].resolve(p))
    expect(p.dispose).toHaveBeenCalledTimes(1)
  })

  it('a poster whose file fails is dropped: the error note and Make poster come back, focused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    open()
    toPrint()
    await startMake()
    const p = fakePoster({ file: vi.fn(async () => { throw new Error('encoder gone') }) })
    await act(async () => makes[0].resolve(p))
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make poster' })).toHaveFocus())
    expect(p.dispose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull()
    const note = screen.getByTestId('share-note')
    expect(note.textContent).toBe('Couldn’t make the poster. Try again.')
    expect(note).toHaveClass('eb-error')
    expect(downloadBlob).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('Make again shows only when stickers are missing, and starts a new make', async () => {
    open()
    toPrint()
    await startMake()
    await act(async () => makes[0].resolve(fakePoster()))
    expect(screen.queryByRole('button', { name: 'Make again' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(2))
    const p = fakePoster({ size: 'A3', missing: 2 })
    await act(async () => makes[1].resolve(p))
    fireEvent.click(screen.getByRole('button', { name: 'Make again' }))
    expect(p.dispose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(makes).toHaveLength(3))
    expect(makes[2].opts.size).toBe('A3')
    expect(screen.getByRole('progressbar', { name: 'Making the poster' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull()
  })

  it('Copy link in print mode sends nothing', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    open()
    toPrint()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Link copied.'))
    expect(track).not.toHaveBeenCalled()
  })

  it('in share mode Download image is still counted', async () => {
    open()
    await waitFor(() => expect(renders).toHaveLength(1))
    await act(async () => renders[0].resolve(new Blob(['png'], { type: 'image/png' })))
    const dl = screen.getByRole('button', { name: 'Download image' }) as HTMLButtonElement
    await waitFor(() => expect(dl.disabled).toBe(false))
    fireEvent.click(dl)
    await waitFor(() => expect(track).toHaveBeenCalledWith('image_downloaded', { format: 'story' }))
  })

  it('print mode ignores the share format and the theme: switching to print renders once, light', async () => {
    open()
    await waitFor(() => expect(renders).toHaveLength(1))
    toPrint()
    await waitFor(() => expect(renders).toHaveLength(2))
    expect(vi.mocked(image.renderShareImage).mock.calls[1][0]).toMatchObject({ format: 'print', theme: 'light' })
  })

  it('print mode sends no analytics', async () => {
    open()
    toPrint()
    await startMake()
    act(() => makes[0].onProgress(1, 1))
    await act(async () => makes[0].resolve(fakePoster()))
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    expect(track).not.toHaveBeenCalled()
  })
})

describe('share dialog: the poster module fails to load', () => {
  it('a failed import of the poster module shows the error, and Make poster retries it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // The poster module fails twice, as a chunk that didn't load would: the load when print mode opens, then the one
    // Make poster retries. A fresh dialog module picks the factory up.
    const fail = { left: 2 }
    vi.doMock('@/lib/share/poster', () => {
      if (fail.left > 0) {
        fail.left--
        throw new Error('chunk failed to load')
      }
      return posterMock()
    })
    vi.resetModules()
    const { default: FreshDialog } = await import('@/components/share/ShareDialog')
    render(<FreshDialog state={stateWith([entry('ostric2')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^Print/ }))
    await waitFor(() => expect(fail.left).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Couldn’t make the poster. Try again.'))
    expect(makes).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make poster' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Make poster' }))
    await waitFor(() => expect(makes).toHaveLength(1))
    expect(screen.getByTestId('share-note').textContent).toBe('Making the poster.')
    warn.mockRestore()
    vi.doMock('@/lib/share/poster', posterMock)
  })
})
