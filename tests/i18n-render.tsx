// Test helper: render a component in a language, `render(<X />, { wrapper: withI18n('es') })`.
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n/I18nProvider'
import type { Lang } from '@/i18n/langs'
import { en, type Messages } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { nl } from '@/i18n/messages/nl'
import { pt } from '@/i18n/messages/pt'

export const MESSAGES: Record<Lang, Messages> = { en, es, pt, nl }

/** A wrapper for Testing Library's render (or any tree) that provides `lang`'s strings. */
export function withI18n(lang: Lang) {
  function I18nWrapper({ children }: { children?: ReactNode }) {
    return <I18nProvider lang={lang} ui={MESSAGES[lang].ui}>{children}</I18nProvider>
  }
  return I18nWrapper
}
