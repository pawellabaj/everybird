/** Global IUCN Red List categories, in the checklist's display order. */
export const IUCN_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'] as const
export type IucnCat = (typeof IUCN_CATS)[number]

export const THREATENED: readonly IucnCat[] = ['VU', 'EN', 'CR']
export const IUCN_SOURCE = 'BirdLife v10 via AviList v2026'

export const IUCN_NAMES: Record<IucnCat, string> = {
  LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered',
  CR: 'Critically Endangered', EW: 'Extinct in the Wild', EX: 'Extinct', DD: 'Data Deficient',
}

/** The Red List chart's category colours; text passes WCAG AA on each fill. */
export const IUCN_COLORS: Record<IucnCat, { fill: string; text: string }> = {
  LC: { fill: '#60c659', text: '#1e1e24' }, NT: { fill: '#cce226', text: '#1e1e24' },
  VU: { fill: '#f9e814', text: '#1e1e24' }, EN: { fill: '#fc7f3f', text: '#1e1e24' },
  CR: { fill: '#d81e05', text: '#ffffff' }, EW: { fill: '#542344', text: '#ffffff' },
  EX: { fill: '#000000', text: '#ffffff' }, DD: { fill: '#d1d1c6', text: '#1e1e24' },
}

export function isIucnCat(x: unknown): x is IucnCat {
  return typeof x === 'string' && (IUCN_CATS as readonly string[]).includes(x)
}

/** Keep the category alone: possibly-extinct flags (PE, PEW) still mean CR. */
export function parseIucn(raw: unknown): IucnCat | undefined {
  if (typeof raw !== 'string') return undefined
  const cat = /^(LC|NT|VU|EN|CR|EW|EX|DD)(?: \([A-Z]+\))?$/.exec(raw.trim())?.[1]
  return isIucnCat(cat) ? cat : undefined
}
