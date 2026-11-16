'use client'
// The share dialog: story, post or square image with a live preview, Share image (the system share sheet when it takes
// files, else a download), Download image, Copy link, the optional collage title (Saved.name, verbatim) and the "Show
// latest lifer" switch (on at every open; off gives the row's room to the collage), and last a quiet "Buy me a coffee" link
// (never on the images).
// The link encoder (and its ~111 KB species index) is a separate chunk, fetched when the dialog opens, so a Copy link
// click awaits nothing slow (iOS drops the clipboard permission once a click handler waits on the network).
// Share image and Download wait for the current render: they're disabled while it's busy, so a click has the PNG at hand.
// Every word is the UI language's (ui.share), the image's too; the credit line, the share text (SHARE_CREDIT), the
// download names and the link stay the same in every language (a link carries no language).
import { DeviceMobile, DownloadSimple, FrameCorners, LinkSimple, ShareNetwork, Square, X, type Icon } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { trapTab, useEscapeCapture, useFocusInAndBack, useHoldTopBar } from '@/components/dialog-utils'
import { fmt, plural } from '@/i18n/core'
import { formatInt } from '@/i18n/format'
import { useI18n } from '@/i18n/I18nProvider'
import { countryName, regionsIn } from '@/lib/i18n-places'
import { track } from '@/lib/analytics'
import { currentTheme, subscribeTheme, type Theme } from '@/lib/theme'
import { COFFEE_URL } from '@/lib/site-meta'
import { downloadBlob } from '@/lib/download'
import { applyFilter, filterKey } from '@/lib/list/filters'
import type { Action, AppState } from '@/lib/list/store'
import {
  IMAGE_SIZE, NAME_MAX_LEN, SHARE_CREDIT, abortError, clearStickerCache, filterLabel as labelFor, imagePackSpec, packForImage, renderShareImage, type ImageFormat, type ImagePack,
} from '@/lib/share/image'
import type { ShareLevel } from '@/lib/share/link'
import type { makeShareLink as MakeShareLink } from '@/lib/share/make-link'
import type { SpeciesIndex } from '@/lib/species/load'
import { displayName, familyName } from '@/lib/species/names'
import { useNames } from '@/lib/species/use-names'
import type { Regions } from '@/lib/species/types'
import '@/components/app/app.css'
import '@/components/collage/collage.css'
import './share.css'

type Props = { state: AppState; dispatch: (a: Action) => void; species: SpeciesIndex; regions: Regions; onClose: () => void }

const RENDER_DELAY_MS = 250
const FORMATS: { id: ImageFormat; hint: string; icon: Icon }[] = [
  { id: 'story', hint: '9:16', icon: DeviceMobile },
  { id: 'post', hint: '4:5', icon: FrameCorners },
  { id: 'square', hint: '1:1', icon: Square },
]
type LinkResult = ReturnType<typeof MakeShareLink>
const loadLinkModule = () => import('@/lib/share/make-link')

/** Why a link carries less than the regions (a large list), or nothing for a full link. */
const levelReason = (level: ShareLevel, t: ReturnType<typeof useI18n>['t']) => (level === 'regions' ? '' : t.share.level[level])

/** The page's current theme (light unless the visitor switched to dark): the image follows it. */
function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => 'light' as const)
}

export default function ShareDialog({ state, species, regions, onClose }: Props) {
  const names = useNames()
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const nameId = useId()
  useEscapeCapture(onClose)
  useFocusInAndBack(ref)
  useHoldTopBar()
  const { lang, t } = useI18n()

  const { list, filter, saved, seen } = state
  const [format, setFormat] = useState<ImageFormat>('story')
  const [name, setName] = useState(saved.name ?? '') // starts from Settings > Name your collage
  const [showLatest, setShowLatest] = useState(true)
  const theme = useTheme()

  // What the image shows: the current view (the filter applied), and the filter in words, in the UI language (countries
  // named by regionsIn; the link below is made from the English `regions`, so it is the same in every language).
  const known = useMemo(() => list.filter((e) => species.byCode.has(e.code)), [list, species])
  const fk = filterKey(filter)
  const shown = useMemo(() => (fk ? applyFilter(known, filter, species, seen) : known), [known, filter, fk, species, seen])
  const label = useMemo(() => {
    const named = regionsIn(regions, lang)
    return labelFor(filter, { species, countryName: (iso) => countryName(iso, lang, regions), regions: named, familyName }, t)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `names` is read through the module, not a prop
  }, [filter, species, regions, lang, t, names])
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
    return (f: ImageFormat, named: boolean, lifer: boolean) => {
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
  // a render superseded before it starts rejects with an AbortError.
  const [preview, setPreview] = useState<{ url: string; format: ImageFormat; key: string } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const current = useRef<Promise<Blob> | null>(null)
  /** The finished PNG for `key`, so Share and Download can use it without awaiting anything. */
  const ready = useRef<{ key: string; blob: Blob } | null>(null)
  const previewUrl = useRef<string | null>(null)
  const first = useRef(true)
  const trimmed = name.trim()
  const key = `${format}|${trimmed}|${theme}|${withLatest}|${lang}|${names}`
  const busy = preview?.key !== key && failedKey !== key
  const failed = failedKey === key
  useEffect(() => {
    let live = true
    let cancel = () => {}
    const delay = first.current ? 0 : RENDER_DELAY_MS
    first.current = false
    const job = new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, delay)
      cancel = () => { clearTimeout(t); reject(abortError('superseded')) }
    })
      .then(() => packFor(format, !!trimmed, withLatest))
      .then((pack) => renderShareImage({ format, entries: shown, species, filterLabel: label, name: trimmed || undefined, theme, pack, latest: withLatest, strings: t, nameOf: displayName, signal: life.current?.signal }))
    current.current = job
    job.then(
      (blob) => {
        if (!live) return
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        ready.current = { key, blob }
        previewUrl.current = URL.createObjectURL(blob)
        setPreview({ url: previewUrl.current, format, key })
      },
      (e: unknown) => {
        if (!live || (e as Error)?.name === 'AbortError') return
        console.warn('Everybird share image failed:', e)
        setFailedKey(key)
      },
    )
    return () => { live = false; cancel() }
  }, [key, format, trimmed, theme, withLatest, packFor, shown, species, label, t])
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])

  // The link module starts loading as soon as the dialog opens (still out of the main bundle).
  const linkModule = useRef<ReturnType<typeof loadLinkModule> | null>(null)
  useEffect(() => {
    const p = loadLinkModule()
    p.catch(() => { if (linkModule.current === p) linkModule.current = null }) // retried on the click
    linkModule.current = p
  }, [])

  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)
  const [manual, setManual] = useState<string | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (manual) manualRef.current?.select() }, [manual])

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
    if (!blob) return setNote({ text: t.share.imageFailed, error: true })
    downloadBlob(blob, fileName)
    track('image_downloaded', { format })
    setNote({ text: fmt(t.share.saved, { file: fileName }) })
  }
  const share = async () => {
    const blob = await getBlob()
    if (!blob) return setNote({ text: t.share.imageFailed, error: true })
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
    setNote({ text: fmt(t.share.savedPost, { file: fileName }) })
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
      if ((e as Error)?.name === 'ShareTooLarge') return setNote({ text: t.share.tooLarge, error: true })
      console.warn('Everybird share link failed:', e)
      return setNote({ text: t.share.linkFailed, error: true })
    }
    const { url, level, dropped } = link
    // Counted once the link exists, whether the clipboard takes it or the birder copies it by hand.
    track('link_copied', { level })
    // The note's sentences, joined by a space: why the link carries less (a large list), then the birds left out.
    const why = [levelReason(level, t), dropped ? plural(t.share.dropped, dropped, { n: formatInt(dropped, t.num) }) : ''].filter(Boolean)
    let ok = await copied
    if (!ok && typeof clip?.writeText === 'function') ok = await clip.writeText(url).then(() => true, () => false)
    if (ok) return setNote({ text: [t.share.copied, ...why].join(' ') })
    setManual(url)
    setNote({ text: [...why, t.share.copyThis].join(' ') })
  }

  const [w, h] = IMAGE_SIZE[preview?.format ?? format]
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
          <h2 id={titleId} className="eb-share-title">{t.share.title}</h2>
          <button type="button" className="eb-share-close" aria-label={t.collage.close} onClick={onClose}>
            <X aria-hidden="true" focusable="false" weight="bold" />
          </button>
        </div>

        <div className="eb-share-body">
          {/* Its own column on top of the controls beside the preview; above the preview on phones (share.css). */}
          <div className="eb-share-formats">
            <div className="eb-seg" role="group" aria-label={t.share.formats}>
              {FORMATS.map(({ id, hint, icon: Glyph }) => (
                <button key={id} type="button" className="eb-seg-btn" aria-pressed={format === id} onClick={() => setFormat(id)}>
                  <Glyph aria-hidden="true" focusable="false" />
                  <span className="eb-seg-text">
                    <span className="eb-seg-label">{t.share.format[id]}</span>
                    <span className="eb-share-hint">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* The box takes the shown image's format (share.css), so it changes shape with the image, not before it; it sits
              centred in an area the story's size, so the controls keep their place in every format. */}
          <div ref={previewBox} className="eb-share-preview" data-format={preview?.format ?? format} aria-busy={busy} data-testid="share-preview">
            {preview && (
              // A blob URL of the rendered PNG: next/image has nothing to optimise here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} width={w} height={h} alt={t.share.preview[preview.format]} />
            )}
            {busy && <span className="eb-share-spin" aria-hidden="true" />}
            {failed && !busy && <p className="eb-error eb-share-failed">{t.share.failed}</p>}
          </div>

          <div className="eb-share-controls">
            <div className="eb-share-field">
              <label htmlFor={nameId} className="eb-share-label">{t.share.nameLabel}</label>
              <input
                id={nameId}
                className="eb-share-input"
                type="text"
                autoComplete="off"
                maxLength={NAME_MAX_LEN}
                placeholder={t.share.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)} // this share only: Settings > Name your collage stays as it is
              />
            </div>

            {hasLatest && (
              <button type="button" role="switch" aria-checked={showLatest} className="eb-switch eb-share-switch" onClick={() => setShowLatest((v) => !v)}>
                <span>{t.share.showLatest}</span>
                <span className="eb-track" aria-hidden="true"><span className="eb-knob" /></span>
              </button>
            )}

            <div className="eb-share-actions">
              <button type="button" className="eb-btn" disabled={busy} onClick={() => void share()}>
                <ShareNetwork aria-hidden="true" focusable="false" weight="bold" />
                {t.share.shareImage}
              </button>
              <button type="button" className="eb-btn eb-btn-quiet" disabled={busy} onClick={() => void download()}>
                <DownloadSimple aria-hidden="true" focusable="false" />
                {t.share.download}
              </button>
              <button type="button" className="eb-btn eb-btn-quiet" onClick={() => void copyLink()}>
                <LinkSimple aria-hidden="true" focusable="false" />
                {t.share.copyLink}
              </button>
            </div>

            <p className={note?.error ? 'eb-error' : 'eb-note'} role="status" data-testid="share-note">{note?.text ?? ''}</p>
            {manual && (
              <input ref={manualRef} className="eb-share-input" type="text" readOnly value={manual} aria-label={t.share.linkField} onFocus={(e) => e.currentTarget.select()} />
            )}
            {fk && <p className="eb-note">{t.share.filtered}</p>}
            <p className="eb-note eb-share-coffee">
              <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer">{t.shell.footer.coffee}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
