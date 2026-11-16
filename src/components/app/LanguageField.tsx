'use client'
// Settings > Your data, first: the language select (in both preview variants of `lang`), and under it, when the UI
// isn't English, "Show bird names in English". The language lives in the `everybird-lang` cookie (chooseLang); the
// names switch in localStorage `everybird:en-names`, per device. Neither touches the saved list, backups or links.
import { useId, useSyncExternalStore } from 'react'
import { SettingRow } from '@/components/import/RulesSwitches'
import { chooseLang } from '@/i18n/choose'
import { useI18n } from '@/i18n/I18nProvider'
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

/** The English-names switch's storage key: "1" when on, absent when off. */
export const EN_NAMES_KEY = 'everybird:en-names'

const listeners = new Set<() => void>()
/** This page's value when storage refuses a write (private modes, blocked site data). */
let memory: boolean | null = null

/** Whether bird names show in English on this device. */
export function readEnNames(): boolean {
  if (memory !== null) return memory
  try {
    return localStorage.getItem(EN_NAMES_KEY) === '1'
  } catch {
    return false
  }
}

export function writeEnNames(on: boolean): void {
  try {
    if (on) localStorage.setItem(EN_NAMES_KEY, '1')
    else localStorage.removeItem(EN_NAMES_KEY)
    memory = null
  } catch {
    memory = on
  }
  for (const f of listeners) f()
}

function subscribe(f: () => void): () => void {
  listeners.add(f)
  const onStorage = (e: StorageEvent) => { if (e.key === EN_NAMES_KEY || e.key === null) f() }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(f)
    window.removeEventListener('storage', onStorage)
  }
}

/** The switch's value for a component: off on the server and while hydrating (pages are prerendered), then stored. */
export function useEnNames(): boolean {
  return useSyncExternalStore(subscribe, readEnNames, () => false)
}

/** "Show bird names in English" (a SettingRow), only when the UI isn't English. Task 9 makes the names follow it. */
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
