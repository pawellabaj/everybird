'use client'
import type { ReactNode } from 'react'
import type { Slot } from '@/lib/list/model'
import type { Saved } from '@/lib/list/storage'
import { obsorgExcluded, obsorgNotSpecies } from './obsorg-copy'

// Already at #match the link changes nothing the match report hears: tell it again (it opens on a hashchange).
const reopen = () => requestAnimationFrame(() => window.dispatchEvent(new HashChangeEvent('hashchange')))

/**
 * A source's entries that weren't counted, for its row's status line ("· 10 skipped", SourceRow): entries that aren't
 * species (sp., slashes, hybrids, domestics: `skipped` counts and named `not-species` rows) and rows that couldn't be
 * matched to an eBird species (fixed in the match report, #match). `body` is what "why?" opens: why, in plain words,
 * the names when the import kept them, and the way to the match report. Null when nothing was left out. An
 * observation.org row names its entries by scientific name (the local name after it, muted), and its observations
 * export also counts the records observation.org marks as escapes or uncertain (`sources.obsorg.excluded`).
 */
export function notCounted(saved: Saved, slots: Slot[]): { n: number; body: ReactNode } | null {
  const mine = saved.unmatched.filter((u) => slots.includes(u.slot ?? u.source))
  const named = mine.filter((u) => u.reason === 'not-species')
  const unmatched = mine.filter((u) => u.reason === 'no-match').length
  const groups = slots.reduce((a, s) => a + (saved.skipped?.[s] ?? 0), 0) + named.length
  const obsorg = slots.some((s) => s === 'obsorg' || s === 'obsorg-list')
  const ex = slots.includes('obsorg') ? saved.sources?.obsorg?.excluded : undefined
  const excluded = (ex?.escape ?? 0) + (ex?.uncertain ?? 0)
  const n = groups + unmatched + excluded
  if (!n) return null
  const names: ReactNode[] = obsorg
    ? named.filter((u) => u.sci || u.com).map((u) => (u.sci && u.com ? <>{u.sci}<span className="eb-match-sci"> · {u.com}</span></> : (u.sci ?? u.com)))
    : named.map((u) => u.com ?? u.sci).filter((x): x is string => !!x)
  const excludedLine = ex ? obsorgExcluded(ex.escape, ex.uncertain) : null
  return {
    n,
    body: (
      <>
        {groups > 0 && (
          <>
            {obsorg ? (
              <p className="eb-note">{obsorgNotSpecies(groups)}</p>
            ) : (
              <p className="eb-note">
                {groups.toLocaleString('en-US')} {groups === 1 ? "entry isn't a species" : "entries aren't species"}: birds only identified to a group (like
                “duck sp.”), either/or IDs (like “Greater/Lesser Scaup”) and hybrids. eBird leaves these off life lists too.
              </p>
            )}
            {names.length > 0 && <ul className="eb-note">{names.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </>
        )}
        {excludedLine && <p className="eb-note">{excludedLine}</p>}
        {unmatched > 0 && (
          <p className="eb-note">
            {unmatched.toLocaleString('en-US')} {unmatched === 1 ? "row couldn't" : "rows couldn't"} be matched to this year&apos;s eBird taxonomy.{' '}
            <a href="#match" onClick={reopen}>{unmatched === 1 ? 'Fix it' : 'Fix them'}</a>
          </p>
        )}
      </>
    ),
  }
}
