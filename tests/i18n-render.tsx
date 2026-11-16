// Test helper: render a component in a language, `render(<X />, { wrapper: withI18n('es') })`.
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n/I18nProvider'
import type { Lang } from '@/i18n/langs'
import { MESSAGES } from '@/i18n/server'

export { MESSAGES }

/** A wrapper for Testing Library's render (or any tree) that provides `lang`'s strings. */
export function withI18n(lang: Lang) {
  function I18nWrapper({ children }: { children?: ReactNode }) {
    return <I18nProvider lang={lang} ui={MESSAGES[lang].ui}>{children}</I18nProvider>
  }
  return I18nWrapper
}
