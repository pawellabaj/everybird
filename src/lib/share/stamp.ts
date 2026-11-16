// The date stamp at the end of the share images' footer line: "… · stickers by huashu · 14 Nov 2026", the date the
// image was made, with no prefix. Imports only @/lib/format, so e2e specs and the About demo can import it without the
// canvas code in image.ts.
import { MONTHS } from '@/lib/format'

/** The words of a stamp: the 12 short month names, January first. A language is one of these. */
export type StampStrings = { months: readonly string[] }

/** English, with the short months the rest of the site uses ("Sep 2026"). */
export const STAMP_EN: StampStrings = { months: MONTHS }

/** "14 Nov 2026" from `d`'s local date (no leading zero); '' for an invalid date. */
export function stampDate(d: Date, s: StampStrings = STAMP_EN): string {
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${s.months[d.getMonth()]} ${d.getFullYear()}`
}

/** `line` ending with the stamp after a middle dot; `line` alone when there is no stamp. */
export function withStamp(line: string, stamp: string): string {
  return stamp ? `${line} · ${stamp}` : line
}
