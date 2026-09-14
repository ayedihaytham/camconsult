export const LOCALES = ['fr', 'ar', 'en'] as const
export type Lang = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Lang = 'fr'

export function isLang(value: string): value is Lang {
  return (LOCALES as readonly string[]).includes(value)
}
