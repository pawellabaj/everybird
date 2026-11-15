'use client'
// The share dialog: story, post or square image with a live preview, Share image (the system share sheet when it takes
// files, else a download), Download image, Copy link, the optional collage title (Saved.name, verbatim) and the "Show
// latest lifer" switch (on at every open; off gives the row's room to the collage), and last a quiet "Buy me a coffee" link
// (never on the images).
// The link encoder (and its ~111 KB species index) is a separate chunk, fetched when the dialog opens, so a Copy link
// click awaits nothing slow (iOS drops the clipboard permission once a click handler waits on the network).
// Share image and Download wait for the current render: they're disabled while it's busy, so a click has the PNG at hand.
// Print mode makes an A4 to A1 poster (always light): the preview is the poster's 1080-wide image, "Make poster" runs
// makePoster (its chunk is fetched when print mode opens) with progress and Cancel, then Download PNG and Download PDF
// serve the one encode. Changing the size, title or switch, leaving print mode or closing the dialog cancels a make and
// drops a finished poster. Nothing in print mode is counted. The entry is a preview variant (`?v=print:a|b|c`): a 4th
// format (a), a quiet button in the actions (b) or a text line under them (c).
import { ArrowLeft, DeviceMobile, DownloadSimple, FrameCorners, LinkSimple, Printer, ShareNetwork, Square, X, type Icon } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { trapTab, useEscapeCapture, useFocusInAndBack, useHoldTopBar } from '@/components/dialog-utils'
import { track } from '@/lib/analytics'
import { currentTheme, subscribeTheme, type Theme } from '@/lib/theme'
import { COFFEE_URL } from '@/lib/site-meta'
import { downloadBlob } from '@/lib/download'
import { PRINT_CM, PRINT_PX, PRINT_SIZES, printDesignH, type PrintSize } from '@/lib/share/print'
import type { Poster } from '@/lib/share/poster'
import { useVariant } from '@/lib/variants'
import { stripBracket } from '@/lib/import/places'
import { applyFilter, filterKey } from '@/lib/list/filters'
import type { Action, AppState } from '@/lib/list/store'
import {
  IMAGE_SIZE, NAME_MAX_LEN, SHARE_CREDIT, abortError, clearStickerCache, filterLabel as labelFor, imagePackSpec, packForImage, renderShareImage, type CardFormat, type ImageFormat, type ImagePack,
} from '@/lib/share/image'
import type { ShareLevel } from '@/lib/share/link'
import type { makeShareLink as MakeShareLink } from '@/lib/share/make-link'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'
import '@/components/app/app.css'
import '@/components/collage/collage.css'
import './share.css'

type Props = { state: AppState; dispatch: (a: Action) => void; species: SpeciesIndex; regions: Regions; onClose: () => void }

const RENDER_DELAY_MS = 250
const FORMATS: { id: ImageFormat; label: string; hint: string; icon: Icon }[] = [
  { id: 'story', label: 'Story', hint: '9:16', icon: DeviceMobile },
  { id: 'post', label: 'Post', hint: '4:5', icon: FrameCorners },
  { id: 'square', label: 'Square', hint: '1:1', icon: Square },
]
type LinkResult = ReturnType<typeof MakeShareLink>
const loadLinkModule = () => import('@/lib/share/make-link')
type PosterModule = typeof import('@/lib/share/poster')

// Every print string in one place, so they can move to the message files as they are.
const PRINT_TEXT = {
  print: 'Print',
  hint: 'A4–A1', // a range, so an en dash
  size: 'Poster size',
  sizeLine: (s: PrintSize, w: number, h: number, pw: number, ph: number) => `${s} · ${w} × ${h} cm · ${pw} × ${ph} px at 150 dpi`,
  make: 'Make poster',
  making: 'Making the poster',
  cancel: 'Cancel',
  png: 'Download PNG',
  pdf: 'Download PDF',
  ready: (s: PrintSize) => `Your ${s} poster is ready.`,
  saved: (file: string) => `Saved ${file}.`,
  missing: (n: number) => (n === 1
    ? "1 sticker didn't load and is drawn as an outline. Make the poster again to retry."
    : `${n} stickers didn't load and are drawn as outlines. Make the poster again to retry.`),
  soft: 'Some stickers come from smaller files for now, so the biggest birds may print a little soft.',
  failed: "Couldn't make the poster. Try a smaller size.",
  entryButton: 'Print a poster', // variant b
  entryLine: 'Print a poster, A4 to A1', // variant c
  back: 'Share images',
  previewAlt: (s: PrintSize) => `Preview of the ${s} poster`,
}
const readyNote = (p: Poster) =>
  [PRINT_TEXT.ready(p.size), p.soft > 0 ? PRINT_TEXT.soft : '', p.missing > 0 ? PRINT_TEXT.missing(p.missing) : ''].filter(Boolean).join(' ')

const LEVEL_NOTE: Record<ShareLevel, string> = {
  regions: 'Link copied.',
  countries: 'Link copied. Your list is large, so the link carries countries instead of regions.',
  dates: 'Link copied. Your list is large, so the link carries dates but no places.',
  species: 'Link copied. Your list is large, so the link carries the species only, without dates or places.',
}

/** The page's current theme (light unless the visitor switched to dark): the image follows it. */
function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => 'light' as const)
}

export default function ShareDialog({ state, species, regions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const nameId = useId()
  useEscapeCapture(onClose)
  useFocusInAndBack(ref)
  useHoldTopBar()

  const { list, filter, saved, seen } = state
  const [format, setFormat] = useState<ImageFormat>('story')
  const entry = useVariant('print', ['a', 'b', 'c'] as const)
  const [mode, setMode] = useState<'share' | 'print'>('share')
  const [size, setSize] = useState<PrintSize>('A4')
  const print = mode === 'print'
  const [name, setName] = useState(saved.name ?? '') // starts from Settings > Name your collage
  const [showLatest, setShowLatest] = useState(true)
  const theme = useTheme()

  // What the image shows: the current view (the filter applied), and the filter in words.
  const known = useMemo(() => list.filter((e) => species.byCode.has(e.code)), [list, species])
  const fk = filterKey(filter)
  const shown = useMemo(() => (fk ? applyFilter(known, filter, species, seen) : known), [known, filter, fk, species, seen])
  const label = useMemo(
    () => labelFor(filter, { species, countryName: (iso) => (regions.countries[iso] ? stripBracket(regions.countries[iso]) : iso), regions }),
    [filter, species, regions],
  )
  const hasLatest = useMemo(() => shown.some((e) => e.date), [shown])
  const withLatest = hasLatest && showLatest

  // One pack per format, name-or-not and lifer-or-not while the dialog is open (the view can't change underneath it; a
  // name takes a line off the collage and the latest lifer row gives one back, so each gets its own pack); workers end
  // on close.
  const life = useRef<AbortController | null>(null)
  useEffect(() => {
    const c = new AbortController()
    life.current = c
    return () => { c.abort(); clearStickerCache() }
  }, [])
  const packFor = useMemo(() => {
    const packs = new Map<string, Promise<ImagePack>>()
    return (f: CardFormat, named: boolean, lifer: boolean) => {
      const k = `${f}|${named}|${lifer}`
      let p = packs.get(k)
      if (!p) {
        const spec = imagePackSpec(f, { name: named, filter: !!label, latest: lifer, count: shown.length })
        p = packForImage(shown, species, spec, life.current?.signal)
        packs.set(k, p)
        p.catch(() => packs.delete(k))
      }
      return p
    }
  }, [shown, species, label])

  // The image: re-rendered (debounced) when the format, name, theme or the latest lifer switch changes. `current` is the newest render;
  // a render superseded before it starts rejects with an AbortError. In print mode it is the poster's preview (the
  // size instead of the format, always light, so the theme isn't in its key).
  const [preview, setPreview] = useState<{ url: string; format: CardFormat; size: PrintSize; key: string } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const current = useRef<Promise<Blob> | null>(null)
  /** The finished PNG for `key`, so Share and Download can use it without awaiting anything. */
  const ready = useRef<{ key: string; blob: Blob } | null>(null)
  const previewUrl = useRef<string | null>(null)
  const first = useRef(true)
  const trimmed = name.trim()
  const key = print ? `print|${size}|${trimmed}|${withLatest}` : `${format}|${trimmed}|${theme}|${withLatest}`
  const busy = preview?.key !== key && failedKey !== key
  const failed = failedKey === key
  useEffect(() => {
    let live = true
    let cancel = () => {}
    const delay = first.current ? 0 : RENDER_DELAY_MS
    first.current = false
    const cardFormat: CardFormat = print ? 'print' : format
    const job = new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, delay)
      cancel = () => { clearTimeout(t); reject(abortError('superseded')) }
    })
      .then(() => packFor(cardFormat, !!trimmed, withLatest))
      .then((pack) => renderShareImage({
        format: cardFormat, ...(print ? { printSize: size } : {}), entries: shown, species, filterLabel: label, name: trimmed || undefined,
        theme: print ? 'light' : theme, pack, latest: withLatest, signal: life.current?.signal,
      }))
    current.current = job
    job.then(
      (blob) => {
        if (!live) return
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        ready.current = { key, blob }
        previewUrl.current = URL.createObjectURL(blob)
        setPreview({ url: previewUrl.current, format: cardFormat, size, key })
      },
      (e: unknown) => {
        if (!live || (e as Error)?.name === 'AbortError') return
        console.warn('Everybird share image failed:', e)
        setFailedKey(key)
      },
    )
    return () => { live = false; cancel() }
  }, [key, print, size, format, trimmed, theme, withLatest, packFor, shown, species, label])
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])

  // The link module starts loading as soon as the dialog opens (still out of the main bundle).
  const linkModule = useRef<ReturnType<typeof loadLinkModule> | null>(null)
  useEffect(() => {
    const p = loadLinkModule()
    p.catch(() => { if (linkModule.current === p) linkModule.current = null }) // retried on the click
    linkModule.current = p
  }, [])

  // `print` marks a note about the poster, dropped with the poster.
  const [note, setNote] = useState<{ text: string; error?: boolean; print?: boolean } | null>(null)
  const [manual, setManual] = useState<string | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (manual) manualRef.current?.select() }, [manual])

  // The poster: one make at a time, for `posterKey`. A new key, leaving print mode or closing the dialog cancels the
  // make and drops the poster (its encoder ends with it).
  const posterKey = `print|${size}|${trimmed}|${withLatest}|${fk}`
  const [poster, setPoster] = useState<{ key: string; p: Poster } | null>(null)
  const [making, setMaking] = useState<{ key: string; done: number; total: number } | null>(null)
  const makeCtl = useRef<AbortController | null>(null)
  const posterRef = useRef<Poster | null>(null)
  const posterModule = useRef<Promise<PosterModule> | null>(null)
  const loadPoster = () => {
    const p = import('@/lib/share/poster')
    p.catch(() => { if (posterModule.current === p) posterModule.current = null }) // retried on Make poster
    posterModule.current = p
    return p
  }
  useEffect(() => { if (print && !posterModule.current) loadPoster() }, [print])
  useEffect(() => () => {
    makeCtl.current?.abort()
    makeCtl.current = null
    posterRef.current?.dispose()
    posterRef.current = null
    setPoster(null)
    setMaking(null)
    setNote((n) => (n?.print ? null : n))
  }, [posterKey, print])
  const posterNow = print && poster?.key === posterKey ? poster.p : null
  const makingNow = print && making?.key === posterKey ? making : null

  // Where focus goes once the button that had it is gone (only if it fell to the page or the dialog itself).
  const backRef = useRef<HTMLButtonElement>(null)
  const entryRef = useRef<HTMLButtonElement>(null)
  const makeRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const pngRef = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<'back' | 'entry' | 'make' | 'cancel' | 'png' | null>(null)
  useEffect(() => {
    const want = focusNext.current
    if (!want) return
    focusNext.current = null
    const el = { back: backRef, entry: entryRef, make: makeRef, cancel: cancelRef, png: pngRef }[want].current
    const active = document.activeElement
    if (el && (!active || active === document.body || active === ref.current)) el.focus()
  })

  const switchMode = (m: 'share' | 'print') => {
    if (m === mode) return
    setMode(m)
    setNote(null)
    if (entry !== 'a') focusNext.current = m === 'print' ? 'back' : 'entry'
  }

  const makePoster = async () => {
    makeCtl.current?.abort()
    const ctl = new AbortController()
    makeCtl.current = ctl
    const forKey = posterKey
    setNote(null)
    setMaking({ key: forKey, done: 0, total: 0 })
    focusNext.current = 'cancel'
    try {
      const mod = await (posterModule.current ?? loadPoster())
      const pack = await packFor('print', !!trimmed, withLatest)
      if (ctl.signal.aborted) return
      const p = await mod.makePoster(
        { size, entries: shown, species, filterLabel: label, name: trimmed || undefined, pack, latest: withLatest, signal: ctl.signal },
        (done, total) => { if (!ctl.signal.aborted) setMaking({ key: forKey, done, total }) },
      )
      if (ctl.signal.aborted) { p.dispose(); return }
      makeCtl.current = null
      posterRef.current = p
      setPoster({ key: forKey, p })
      setMaking(null)
      setNote({ text: readyNote(p), print: true })
      focusNext.current = 'png'
    } catch (e) {
      if (ctl.signal.aborted || (e as Error)?.name === 'AbortError') return
      if ((e as Error)?.message !== 'poster-memory') console.warn('Everybird poster failed:', e)
      makeCtl.current = null
      setMaking(null)
      setNote({ text: PRINT_TEXT.failed, error: true, print: true })
      focusNext.current = 'make'
    }
  }
  const cancelPoster = () => {
    makeCtl.current?.abort()
    makeCtl.current = null
    setMaking(null)
    focusNext.current = 'make'
  }
  const savePoster = async (kind: 'png' | 'pdf') => {
    const p = posterNow
    if (!p) return
    const file = `everybird-${p.size.toLowerCase()}.${kind}`
    let blob: Blob
    try {
      blob = await p.file(kind)
    } catch (e) {
      console.warn('Everybird poster file failed:', e)
      if (posterRef.current === p) setNote({ text: PRINT_TEXT.failed, error: true, print: true })
      return
    }
    if (posterRef.current !== p) return // dropped while the file was made: never a stale poster
    downloadBlob(blob, file)
    setNote({ text: PRINT_TEXT.saved(file), print: true })
  }

  const fileName = `everybird-${format}.png`
  /** The newest render's PNG: at hand once it's done (the buttons are disabled before), else waiting for it; null if it failed. */
  const getBlob = async (): Promise<Blob | null> => {
    if (ready.current?.key === key) return ready.current.blob
    for (;;) {
      const p = current.current
      if (!p) return null
      try {
        const b = await p
        if (p === current.current) return b
      } catch {
        if (p === current.current) return null
      }
    }
  }
  const download = async () => {
    const blob = await getBlob()
    if (!blob) return setNote({ text: 'Couldn’t make the image. Try again.', error: true })
    downloadBlob(blob, fileName)
    track('image_downloaded', { format })
    setNote({ text: `Saved ${fileName}.` })
  }
  const share = async () => {
    const blob = await getBlob()
    if (!blob) return setNote({ text: 'Couldn’t make the image. Try again.', error: true })
    const file = new File([blob], fileName, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      try {
        // The image says "stickers by huashu"; the post's text carries the full CC BY 4.0 credit and its link.
        await nav.share({ files: [file], title: 'Everybird', text: SHARE_CREDIT })
        track('shared', { via: format })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return // the birder closed the share sheet: not shared, nothing sent
        // Any other failure: nothing counted as shared; the download below is counted as a download.
      }
    }
    downloadBlob(blob, fileName)
    track('image_downloaded', { format })
    setNote({ text: `Saved ${fileName}. Post it from your photos or files.` })
  }
  const copyLink = async () => {
    setManual(null)
    const mod = (linkModule.current ??= loadLinkModule())
    const making: Promise<LinkResult> = mod.then((m) => m.makeShareLink(list, regions, trimmed || undefined, window.location.origin))
    // Where the clipboard takes a promised item (Safari, Chromium), hand it over now, inside the click, and let the
    // link arrive later. Otherwise writeText after the (normally already loaded) module, then the manual field.
    let copied: Promise<boolean> = Promise.resolve(false)
    const clip = navigator.clipboard
    if (typeof ClipboardItem === 'function' && typeof clip?.write === 'function') {
      try {
        const item = new ClipboardItem({ 'text/plain': making.then((l) => new Blob([l.url], { type: 'text/plain' })) })
        copied = clip.write([item]).then(() => true, () => false)
      } catch {
        // An old ClipboardItem that refuses promises: fall through to writeText.
      }
    }
    let link: LinkResult
    try {
      link = await making
    } catch (e) {
      if ((e as Error)?.name === 'ShareTooLarge') return setNote({ text: 'This list is too large for a link. Share the image instead.', error: true })
      console.warn('Everybird share link failed:', e)
      return setNote({ text: 'Couldn’t make the link. Try again.', error: true })
    }
    const { url, level, dropped } = link
    // Counted once the link exists, whether the clipboard takes it or the birder copies it by hand.
    track('link_copied', { level })
    const missing = dropped ? ` ${dropped === 1 ? '1 bird is' : `${dropped} birds are`} too new for links and left out.` : ''
    let ok = await copied
    if (!ok && typeof clip?.writeText === 'function') ok = await clip.writeText(url).then(() => true, () => false)
    if (ok) return setNote({ text: LEVEL_NOTE[level] + missing })
    setManual(url)
    setNote({ text: `${level === 'regions' ? '' : `${LEVEL_NOTE[level].replace('Link copied. ', '')} `}${missing.trim()}${missing ? ' ' : ''}Copy this link:` })
  }

  const shownCard: CardFormat = preview?.format ?? (print ? 'print' : format)
  const [w, h] = shownCard === 'print' ? [1080, Math.round(printDesignH(preview?.size ?? size))] : IMAGE_SIZE[shownCard]
  const pct = makingNow && makingNow.total > 0 ? Math.round((makingNow.done / makingNow.total) * 100) : 0
  const [cmW, cmH] = PRINT_CM[size]
  const [pxW, pxH] = PRINT_PX[size]
  // The box eases to a new format's shape (data-resizing, share.css), but follows a window resize at once.
  const previewBox = useRef<HTMLDivElement>(null)
  const shownFormat = preview?.format
  const lastShown = useRef(shownFormat)
  useLayoutEffect(() => {
    const el = previewBox.current
    const was = lastShown.current
    lastShown.current = shownFormat
    if (!el || !was || was === shownFormat) return
    el.dataset.resizing = ''
    const t = setTimeout(() => { delete el.dataset.resizing }, 400)
    return () => clearTimeout(t)
  }, [shownFormat])
  return (
    <div className="eb-share-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        className="eb-share"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => trapTab(e, ref.current)}
      >
        <div className="eb-share-head">
          <h2 id={titleId} className="eb-share-title">Share your collage</h2>
          <button type="button" className="eb-share-close" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" focusable="false" weight="bold" />
          </button>
        </div>

        <div className="eb-share-body">
          {/* Its own column on top of the controls beside the preview; above the preview on phones (share.css). In print
              mode under variants b and c, the way back to the share images takes its place. */}
          <div className="eb-share-formats">
            {print && entry !== 'a' ? (
              <button ref={backRef} type="button" className="eb-btn eb-btn-quiet" onClick={() => switchMode('share')}>
                <ArrowLeft aria-hidden="true" focusable="false" />
                {PRINT_TEXT.back}
              </button>
            ) : (
              <div className={entry === 'a' ? 'eb-seg eb-seg-4' : 'eb-seg'} role="group" aria-label="Image format">
                {FORMATS.map(({ id, label: text, hint, icon: Glyph }) => (
                  <button key={id} type="button" className="eb-seg-btn" aria-pressed={!print && format === id} onClick={() => { setFormat(id); switchMode('share') }}>
                    <Glyph aria-hidden="true" focusable="false" />
                    <span className="eb-seg-text">
                      <span className="eb-seg-label">{text}</span>
                      <span className="eb-share-hint">{hint}</span>
                    </span>
                  </button>
                ))}
                {entry === 'a' && (
                  <button type="button" className="eb-seg-btn" aria-pressed={print} onClick={() => switchMode('print')}>
                    <Printer aria-hidden="true" focusable="false" />
                    <span className="eb-seg-text">
                      <span className="eb-seg-label">{PRINT_TEXT.print}</span>
                      <span className="eb-share-hint">{PRINT_TEXT.hint}</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* The box takes the shown image's format (share.css), so it changes shape with the image, not before it; it sits
              centred in an area the story's size, so the controls keep their place in every format. */}
          <div ref={previewBox} className="eb-share-preview" data-format={shownCard} aria-busy={busy} data-testid="share-preview">
            {preview && (
              // A blob URL of the rendered PNG: next/image has nothing to optimise here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url} width={w} height={h}
                alt={preview.format === 'print' ? PRINT_TEXT.previewAlt(preview.size) : `Preview of the ${preview.format} image`}
              />
            )}
            {busy && <span className="eb-share-spin" aria-hidden="true" />}
            {failed && !busy && <p className="eb-error eb-share-failed">Couldn&apos;t make the image.</p>}
          </div>

          <div className="eb-share-controls">
            {print && (
              <div className="eb-share-field">
                <div className="eb-seg eb-share-sizes" role="group" aria-label={PRINT_TEXT.size}>
                  {PRINT_SIZES.map((s) => (
                    <button key={s} type="button" className="eb-seg-btn" aria-pressed={size === s} onClick={() => setSize(s)}>
                      <span className="eb-seg-label">{s}</span>
                    </button>
                  ))}
                </div>
                <p className="eb-note">{PRINT_TEXT.sizeLine(size, cmW, cmH, pxW, pxH)}</p>
              </div>
            )}

            <div className="eb-share-field">
              <label htmlFor={nameId} className="eb-share-label">Collage title</label>
              <input
                id={nameId}
                className="eb-share-input"
                type="text"
                autoComplete="off"
                maxLength={NAME_MAX_LEN}
                placeholder="Optional, shown on the image"
                value={name}
                onChange={(e) => setName(e.target.value)} // this share only: Settings > Name your collage stays as it is
              />
            </div>

            {hasLatest && (
              <button type="button" role="switch" aria-checked={showLatest} className="eb-switch eb-share-switch" onClick={() => setShowLatest((v) => !v)}>
                <span>Show latest lifer</span>
                <span className="eb-track" aria-hidden="true"><span className="eb-knob" /></span>
              </button>
            )}

            {print ? (
              <div className="eb-share-actions">
                {makingNow ? (
                  <div className="eb-share-progress">
                    <div
                      className="eb-share-bar" role="progressbar" aria-label={PRINT_TEXT.making}
                      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                    >
                      <span className="eb-share-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="eb-share-pct" aria-hidden="true">{pct}%</span>
                    <button ref={cancelRef} type="button" className="eb-btn eb-btn-quiet" onClick={cancelPoster}>{PRINT_TEXT.cancel}</button>
                  </div>
                ) : posterNow ? (
                  <>
                    <button ref={pngRef} type="button" className="eb-btn" onClick={() => void savePoster('png')}>
                      <DownloadSimple aria-hidden="true" focusable="false" weight="bold" />
                      {PRINT_TEXT.png}
                    </button>
                    <button type="button" className="eb-btn eb-btn-quiet" onClick={() => void savePoster('pdf')}>
                      <DownloadSimple aria-hidden="true" focusable="false" />
                      {PRINT_TEXT.pdf}
                    </button>
                  </>
                ) : (
                  <button ref={makeRef} type="button" className="eb-btn" onClick={() => void makePoster()}>
                    <Printer aria-hidden="true" focusable="false" weight="bold" />
                    {PRINT_TEXT.make}
                  </button>
                )}
                <button type="button" className="eb-btn eb-btn-quiet" onClick={() => void copyLink()}>
                  <LinkSimple aria-hidden="true" focusable="false" />
                  Copy link
                </button>
              </div>
            ) : (
              <div className="eb-share-actions">
                <button type="button" className="eb-btn" disabled={busy} onClick={() => void share()}>
                  <ShareNetwork aria-hidden="true" focusable="false" weight="bold" />
                  Share image
                </button>
                <button type="button" className="eb-btn eb-btn-quiet" disabled={busy} onClick={() => void download()}>
                  <DownloadSimple aria-hidden="true" focusable="false" />
                  Download image
                </button>
                <button type="button" className="eb-btn eb-btn-quiet" onClick={() => void copyLink()}>
                  <LinkSimple aria-hidden="true" focusable="false" />
                  Copy link
                </button>
                {entry === 'b' && (
                  <button ref={entryRef} type="button" className="eb-btn eb-btn-quiet" onClick={() => switchMode('print')}>
                    <Printer aria-hidden="true" focusable="false" />
                    {PRINT_TEXT.entryButton}
                  </button>
                )}
              </div>
            )}
            {!print && entry === 'c' && (
              <p className="eb-note">
                <button ref={entryRef} type="button" className="eb-share-textlink" onClick={() => switchMode('print')}>{PRINT_TEXT.entryLine}</button>
              </p>
            )}

            <p className={note?.error ? 'eb-error' : 'eb-note'} role="status" data-testid="share-note">{note?.text ?? ''}</p>
            {manual && (
              <input ref={manualRef} className="eb-share-input" type="text" readOnly value={manual} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            )}
            {fk && <p className="eb-note">The image shows the current filter.</p>}
            <p className="eb-note eb-share-coffee">
              <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer">Buy me a coffee</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
