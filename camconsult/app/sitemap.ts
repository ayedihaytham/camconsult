import type { MetadataRoute } from 'next'
import { LOCALES } from '@/lib/i18n/locales'
import { SITE_INDEXABLE, SITE_PATHS, languageAlternates, localizedUrl } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_INDEXABLE) return []
  return SITE_PATHS.flatMap((path) => LOCALES.map((lang) => ({
    url: localizedUrl(lang, path),
    alternates: { languages: languageAlternates(path) },
  })))
}
