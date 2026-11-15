'use client'
// The UI language for client components. The root layout passes its language's `ui` (plain data from
// messages/<lang>.ts); components read it with useI18n(): `const { lang, t } = useI18n()`, then `t.shell.nav.about`.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Lang } from './langs'
import { EN_UI, type Ui } from './messages/en'

type I18n = { lang: Lang; t: Ui }

/** No provider means English: components not yet wrapped (and their tests) keep rendering today's English text until
 *  the layouts mount the provider. Defaulting rather than throwing is deliberate. */
const ENGLISH: I18n = { lang: 'en', t: EN_UI }

const I18nContext = createContext<I18n>(ENGLISH)

export function I18nProvider({ lang, ui, children }: { lang: Lang; ui: Ui; children: ReactNode }) {
  const value = useMemo(() => ({ lang, t: ui }), [lang, ui])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** The current language and its strings (English when no provider is mounted). */
export function useI18n(): I18n {
  return useContext(I18nContext)
}
