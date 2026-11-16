'use client'
// Settings > Your data, first: the language select (in both preview variants of `lang`), and under it, when the UI
// isn't English, "Show bird names in English". The language lives in the `everybird-lang` cookie (chooseLang); the
// names switch in localStorage `everybird:en-names`, per device. Neither touches the saved list, backups or links.
import { useId } from 'react'
import { SettingRow } from '@/components/import/RulesSwitches'
import { chooseLang } from '@/i18n/choose'
import { useI18n } from '@/i18n/I18nProvider'
import { englishNames, setEnglishNames, useEnNames } from '@/lib/species/names'
import { HTML_LANG, isLang, LANG_NAMES, LANGS } from '@/i18n/langs'

export function LanguageField() {
  const { lang, t } = useI18n()
  const id = useId()
  return (
    <div className="eb-namefield eb-langfield">
      <label htmlFor={id} className="eb-namefield-label">{t.settings.language}</label>
      <span className="eb-select">
        <select
          id={id}
          className="eb-input"
          value={lang}
          onChange={(e) => {
            const v = e.target.value
            if (isLang(v) && v !== lang) chooseLang(v)
          }}
        >
          {LANGS.map((l) => (
            <option key={l} value={l} lang={HTML_LANG[l]}>{LANG_NAMES[l]}</option>
          ))}
        </select>
      </span>
    </div>
  )
}

export { EN_NAMES_KEY, useEnNames } from '@/lib/species/names'
export const readEnNames = englishNames
export const writeEnNames = setEnglishNames

/** "Show bird names in English" (a SettingRow), only when the UI isn't English. The names follow it (species/names.ts). */
export function EnglishNamesSwitch() {
  const { lang, t } = useI18n()
  const on = useEnNames()
  if (lang === 'en') return null
  return (
    <ul className="eb-setgroup eb-langnames">
      <SettingRow label={t.settings.enNames.label} note={t.settings.enNames.note} checked={on} onChange={writeEnNames} />
    </ul>
  )
}
