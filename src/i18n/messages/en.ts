// English: the source of truth for every language. `Messages` is this file's shape, so es.ts, pt.ts and nl.ts fail
// `tsc` when a key is missing, and tests/i18n.test.ts fails when one is extra, empty or left in English.
//
// Values are plain data: strings with `{name}` variables and `<tag>chunk</tag>` markup (src/i18n/core.ts `fmt`,
// `rich`), `{ one, other }` plurals (`plural`) and arrays of strings. No functions, so `ui` can cross from a server
// layout to the client I18nProvider.
//
// `ui` is everything client code renders; `page` is server-only (About's prose, page metadata) and never reaches the
// provider. One key per area, in this order; a later task adds its area as a new key at the end of `ui` (collage,
// filters, card, landing, shared, places, settings, import, share, orders, ...) or of `page`, in all four files at once.
import type { Plural } from '../core'

const ui = {
  /** Number separators (src/i18n/format.ts): grouped from 4 digits. */
  num: { group: ',', decimal: '.' },
  /** Dates: the 12 short months, January first (= src/lib/format.ts MONTHS), and the share stamp's lead ("As of 14 Nov 2026"). */
  date: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    asOf: 'As of',
  },
  /** The count's label under the number (Tally, share images, link previews). At most 8 characters: the hole is sized for it. */
  count: { label: 'species' },
  /** The top bar (TopBar, ThemeToggle) and the footer (SiteFooter) on every page. */
  shell: {
    nav: {
      /** The nav's aria-label. */
      label: 'Everybird',
      collage: 'Collage',
      settings: 'Settings',
      about: 'About',
    },
    /** The theme switch's aria-label. */
    darkMode: 'Dark mode',
    footer: {
      credits: 'All credits',
      madeBy: 'Made by Yusuf Taleb',
      coffee: 'Buy me a coffee',
      /** The GitHub link's aria-label. */
      github: 'Everybird on GitHub',
    },
  },
}

const page = {}

export const en = { ui, page }

/** English's client strings alone: the provider's fallback imports this, not `en`, so `page` stays off the client. */
export const EN_UI = ui

/** A messages type with its string literals widened: strings stay strings, plurals `Plural`, string arrays `readonly string[]`. */
export type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : T extends Plural
      ? [Exclude<keyof T, keyof Plural>] extends [never]
        ? Plural
        : { [K in keyof T]: Widen<T[K]> }
      : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof en>
export type Ui = Messages['ui']
