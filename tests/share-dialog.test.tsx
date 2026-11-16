// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareDialog from '@/components/share/ShareDialog'
import * as image from '@/lib/share/image'
import type { ListEntry } from '@/lib/list/model'
import { initialState } from '@/lib/list/store'
import { decodeShare } from '@/lib/share/link'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'
import { downloadBlob } from '@/lib/download'
import { LANGS } from '@/i18n/langs'
import { MESSAGES, withI18n } from './i18n-render'

// The renderer is replaced by a promise the test resolves, so "busy" is under the test's control.
const renders: { resolve: (b: Blob) => void }[] = []
vi.mock('@/lib/share/image', async (orig) => ({
  ...(await orig<typeof import('@/lib/share/image')>()),
  packForImage: vi.fn(async () => ({ boxes: [] })),
  renderShareImage: vi.fn(() => new Promise<Blob>((resolve) => renders.push({ resolve }))),
  clearStickerCache: vi.fn(),
}))
vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }))

const row = (code: string, to: number) => ({ code, com: code, sci: code, ord: 'Struthioniformes', fam: 'Struthionidae', famCom: 'Ostriches', to, g: 100000, gSrc: 'family', st: true, ar: 1, q: true }) as SpeciesRow
const species = buildSpeciesIndex([row('ostric2', 1), row('emu1', 2)])
const regions = { v: 1 as const, countries: { CA: 'Canada' }, sub1: {} }
const entry = (code: string): ListEntry => ({ code, date: '2020-05', place: { country: 'CA' }, heard: false, dead: false, media: false, sources: ['ebird'] })
const stateWith = (list: ListEntry[]) => ({ ...initialState(), list })

beforeEach(() => {
  renders.length = 0
  vi.mocked(image.packForImage).mockClear()
  vi.mocked(image.renderShareImage).mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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

  it('the link is the same in every language (a link carries no language, its places stay English)', async () => {
    const urls: string[] = []
    for (const lang of LANGS) {
      const writeText = vi.fn(async () => {})
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      const state = stateWith([entry('ostric2'), entry('emu1')])
      state.saved = { ...state.saved, name: 'Aves de 2026' }
      render(<ShareDialog state={state} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />, { wrapper: withI18n(lang) })
      fireEvent.click(screen.getByRole('button', { name: MESSAGES[lang].ui.share.copyLink }))
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      urls.push((writeText.mock.calls[0] as unknown as [string])[0])
      cleanup()
      vi.unstubAllGlobals()
    }
    expect(new Set(urls).size).toBe(1)
    expect(decodeShare(urls[0].split('/s/')[1]).places).toEqual(['Canada'])
  })

  it('in Spanish: the labels, the image strings, the filter label, and an English download name', async () => {
    const es = MESSAGES.es.ui
    const state = stateWith([entry('ostric2')])
    state.filter = { countries: ['CA'] }
    render(<ShareDialog state={state} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByRole('heading', { name: 'Comparte tu collage' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Formato de imagen' })).toBeInTheDocument()
    for (const label of ['Historia', 'Publicación', 'Cuadrado']) expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Mostrar la última especie nueva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título del collage')).toBeInTheDocument()
    expect(screen.getByText('La imagen muestra el filtro actual.')).toBeInTheDocument()
    await waitFor(() => expect(renders).toHaveLength(1))
    const opts = vi.mocked(image.renderShareImage).mock.calls[0][0]
    expect(opts.strings).toBe(es)
    expect(opts.filterLabel).toBe('Canadá')
    await act(async () => renders[0].resolve(new Blob(['png'], { type: 'image/png' })))
    const dl = screen.getByRole('button', { name: 'Descargar imagen' }) as HTMLButtonElement
    await waitFor(() => expect(dl.disabled).toBe(false))
    fireEvent.click(dl)
    await waitFor(() => expect(vi.mocked(downloadBlob)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('everybird-story.png')
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Se guardó everybird-story.png.'))
  })

  it('in Spanish: the copied note, with a bird left out', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<ShareDialog state={stateWith([entry('ostric2'), entry('notabird1')])} dispatch={() => {}} species={species} regions={regions} onClose={() => {}} />, { wrapper: withI18n('es') })
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    await waitFor(() => expect(screen.getByTestId('share-note').textContent).toBe('Enlace copiado. 1 ave es demasiado nueva para los enlaces y se dejó fuera.'))
  })
})
