import fr from './fr'
import ar from './ar'
import en from './en'
import type { Dictionary } from './fr'
import { LOCALES, DEFAULT_LOCALE, isLang, type Lang } from './locales'

const dictionaries: Record<Lang, Dictionary> = { fr, ar, en }

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang] ?? dictionaries[DEFAULT_LOCALE]
}

export { LOCALES, DEFAULT_LOCALE, isLang }
export type { Lang, Dictionary }
