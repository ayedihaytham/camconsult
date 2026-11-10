import { getDictionary, type Lang } from '@/lib/i18n'
import type { GlConfig } from '@/components/gl/engine'

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', ar: 'ar-TN' }

/** Réglages du moteur d'animation, tirés du dictionnaire de la langue courante. */
export function glConfig(lang: Lang, home: boolean): GlConfig {
  const { footer, gl } = getDictionary(lang)
  return {
    locale: LOCALE[lang],
    home,
    ledger: gl.ledger,
    openText: footer.openLabel.replace('{time}', footer.timeClose),
    closedText: footer.closedLabel.replace('{time}', footer.timeOpen),
    reminderAdded: gl.deadline.added,
    thanks: gl.form.thanks,
    orPhone: gl.form.orPhone,
  }
}
