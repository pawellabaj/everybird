'use client'
// The React side of local bird names (names.ts is plain TypeScript, so Node scripts can import it without React).
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import type { ListEntry } from '@/lib/list/model'
import { englishNames, loadNames, namesVersion, pickNameLocale, setNames, subscribeNames, topCountry } from './names'

/** Re-render when the names change (a set arrives, the locale changes, the switch flips); returns the version. */
export function useNames(): number {
  return useSyncExternalStore(subscribeNames, namesVersion, () => 0)
}
/** The English switch's value for a component: off on the server and while hydrating, then stored. */
export function useEnNames(): boolean {
  return useSyncExternalStore(subscribeNames, englishNames, () => false)
}

/**
 * Load the names for the UI language, the browser's languages and the list's top country (recomputed when the list
 * changes), and make them current. English clears them and asks for nothing. A failed load leaves what showed before
 * (English). With no list (the landing page's sample carries its own names) the request waits for an idle moment, as
 * the species file does; a list asks at once.
 */
export function useLoadNames(list: readonly ListEntry[]): void {
  const { lang } = useI18n()
  const top = useMemo(() => topCountry(list), [list])
  const empty = list.length === 0
  useEffect(() => {
    const l = pickNameLocale(lang, navigator.languages?.length ? navigator.languages : [navigator.language], top)
    if (!l) { setNames(null); return }
    let live = true
    const run = () => { loadNames(l).then((s) => { if (live) setNames(s) }, () => {}) }
    let stop = () => {}
    if (!empty) run()
    else if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 1500 })
      stop = () => cancelIdleCallback(id)
    } else {
      const id = setTimeout(run, 200)
      stop = () => clearTimeout(id)
    }
    return () => { live = false; stop() }
  }, [lang, top, empty])
}
