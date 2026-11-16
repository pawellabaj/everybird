// Every user-facing observation.org string on Settings (the rows, their panels, the notes, the skipped entries, the
// match report, the import errors), in one place so a later i18n layer can lift them. The brand is always lower case,
// "observation.org", also at the start of a title or sentence.
import type { ObsOrgDetails } from '@/lib/list/storage'

const num = (x: number) => x.toLocaleString('en-US')

export const OBSORG_GROUP = 'observation.org files'
export const OBSORG_INPUT = 'observation.org file'
export const OBSORG_CHOOSE = 'Choose your observation.org file'
export const OBSORG_HOWTO = 'How do I get this file?'

/** One row per export: the life list (Observed species) in 'obsorg-list', the observations in 'obsorg'. */
export const OBSORG_ROWS = {
  'obsorg-list': {
    title: 'observation.org life list',
    guide: "Your Observed species list from observation.org. It gives each bird's first date, but no places.",
    help: 'On observation.org: open Observed species, choose Birds and Life list, then Export as CSV. Everybird reads the CSV, not the Excel file.',
    what: 'your observation.org life list',
  },
  obsorg: {
    title: 'observation.org observations',
    guide: 'Every bird observation you made on observation.org. It places each bird by country and province, so Places can filter them.',
    help: 'On observation.org: open your Observations, choose Birds, then Export as CSV. Everybird reads the CSV, not the Excel file.',
    what: 'your observation.org observations',
  },
} as const

/** A connected row's name when the browser gave no file name. */
export const OBSORG_FALLBACK: Record<ObsOrgDetails['kind'], string> = {
  'species-list': 'observation.org Observed species',
  observations: 'observation.org observations export',
}

/** Under the rows while only the life list is on the list; the link (OBSORG_PLACES.add) sits between the two parts. */
export const OBSORG_NOTE = {
  lead: 'Your observation.org life list has no places, so Places can\'t filter these birds.',
  tail: ' to place each bird by country and province.',
} as const

/** The import errors (use-import-jobs.ts `readFile`). */
export const OBSORG_ERRORS = {
  unknown: "Couldn't read this file. Use observation.org's Observed species export or your observations export, as a CSV.",
  xlsx: 'This is the Excel file. On observation.org, export as CSV and add that file instead.',
  noBirds: 'No birds in this file. On observation.org, choose Birds before you export.',
  damaged: "Couldn't read this file. It may be damaged or not an observation.org export.",
} as const

/** "why?" under an observation.org row: the entries that aren't species. */
export function obsorgNotSpecies(n: number): string {
  return `${num(n)} ${n === 1 ? "entry isn't a species" : "entries aren't species"}: birds only identified to a group (like “Motacilla spec.”), either/or IDs, hybrids, forms and varieties.`
}

/** "why?" under the observations row: records observation.org marks as escapes or uncertain. Null when there are none. */
export function obsorgExcluded(escape: number, uncertain: number): string | null {
  if (!escape && !uncertain) return null
  const esc = escape ? `${num(escape)} ${escape === 1 ? 'observation marked as an escape' : 'observations marked as escapes'}` : ''
  const unc = uncertain ? (escape ? `${num(uncertain)} marked uncertain` : `${num(uncertain)} ${uncertain === 1 ? 'observation' : 'observations'} marked uncertain`) : ''
  const one = (escape ? escape : uncertain) === 1 && !(escape && uncertain)
  return `${[esc, unc].filter(Boolean).join(' and ')} ${one ? "isn't" : "aren't"} counted.`
}

/** The match report's place for an observation.org row. */
export const obsorgWhere = (row: number, lifeList: boolean) => (lifeList ? `observation.org life list row ${row}` : `observation.org row ${row}`)
