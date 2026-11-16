'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'

type Options = {
  /** The address's anchor, without "#" (MYEBIRDDATA_PLACES.anchor "add-mydata", OBSORG_PLACES.anchor "add-obsorg"). */
  anchor: string
  /** The group's buttons are disabled (a file is being read): a request is held until they aren't. */
  off: boolean
  /** The target file is on the list: its Replace takes focus instead of the Add panel opening. */
  connected: boolean
  /** Opens the target row's Add panel. */
  open: () => void
  /** The Add panel's picker ("Choose your … file"), focused once the panel is shown. */
  picker: RefObject<HTMLButtonElement | null>
  /** The connected row's Replace. */
  replace: RefObject<HTMLButtonElement | null>
}

/**
 * One file row a Places note points to (EbirdDrop's MyEBirdData at #add-mydata, ObsOrgDrop's observations at
 * #add-obsorg): the returned `go(scroll)` opens the row's Add panel and focuses its picker, or, with the file on the
 * list, focuses its Replace. Arriving at the anchor does the same, scrolled into view: read once on mount (the Places
 * panel's link is a client navigation; the router writes the URL after this mounts and fires no hashchange, so it is
 * read as MatchReport reads #match) and on every hashchange. A request while a file is read waits for the read to end,
 * and is taken up only while the address still names the anchor (not if the birder has since gone to #match or #tick).
 */
export function useAnchorTarget({ anchor, off, connected, open, picker, replace }: Options): (scroll: boolean) => void {
  // Set to focus the picker once its panel is shown (it is `hidden` until this render commits); `scroll` centres it
  // first (arrival from another page).
  const [toPicker, setToPicker] = useState<{ scroll: boolean } | null>(null)
  // A request while a file is being read (the buttons are disabled): taken up once the read is done.
  const pending = useRef<boolean | null>(null)

  const go = (scroll: boolean) => {
    if (off) {
      pending.current = scroll
      return
    }
    if (connected) replace.current?.focus()
    else {
      open()
      setToPicker({ scroll })
    }
  }
  useEffect(() => {
    if (!toPicker) return
    if (toPicker.scroll) picker.current?.scrollIntoView?.({ block: 'center' })
    picker.current?.focus()
  }, [toPicker, picker])
  const goRef = useRef(go)
  useEffect(() => { goRef.current = go })
  useEffect(() => {
    if (off || pending.current === null) return
    const scroll = pending.current
    pending.current = null
    // use-import-jobs lands the file and goes idle in one batch, so the rows have already folded their panels here.
    if (window.location.hash === `#${anchor}`) goRef.current(scroll)
  }, [off, anchor])
  useEffect(() => {
    const onHash = () => { if (window.location.hash === `#${anchor}`) goRef.current(true) }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [anchor])
  return go
}
