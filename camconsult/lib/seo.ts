import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DEFAULT_LOCALE, LOCALES, getDictionary, isLang, type Lang } from '@/lib/i18n'

function siteOrigin() {
  const url = new URL(process.env.SITE_URL || 'https://camconsult.com.tn')
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('SITE_URL must be an HTTP(S) origin without a path, query, or credentials.')
  }
  return url.origin
}

export const SITE_URL = siteOrigin()
// Preview deployments must explicitly set SITE_INDEXABLE=false before building.
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE !== 'false'

export const SITE_PATHS = [
  '', '/services', '/services/revision', '/outils-fiscaux', '/blog',
  '/ressources', '/contact', '/candidature', '/mentions-legales',
  '/confidentialite', '/cgu', '/cookies',
] as const
export type SitePath = (typeof SITE_PATHS)[number]

export function localizedUrl(lang: Lang, path: SitePath = '') {
  return `${SITE_URL}/${lang}${path}`
}

export function languageAlternates(path: SitePath) {
  return {
    ...Object.fromEntries(LOCALES.map((lang) => [lang, localizedUrl(lang, path)])),
    'x-default': localizedUrl(DEFAULT_LOCALE, path),
  }
}

function pageCopy(lang: Lang, path: SitePath) {
  const d = getDictionary(lang)
  switch (path) {
    case '': return d.meta
    case '/services': return d.services
    case '/services/revision': return { title: d.services.detail.revisionTitle, description: d.services.detail.description }
    case '/outils-fiscaux': return { title: d.nav.tools, description: d.fiscalTools.description }
    case '/blog': return d.blog
    case '/ressources': return d.resources
    case '/contact': return d.contact
    case '/candidature': return d.careers
    case '/mentions-legales': return { title: d.legal.pages.mentions.title, description: d.legal.pages.mentions.intro }
    case '/confidentialite': return { title: d.legal.pages.privacy.title, description: d.legal.pages.privacy.intro }
    case '/cgu': return { title: d.legal.pages.terms.title, description: d.legal.pages.terms.intro }
    case '/cookies': return { title: d.legal.pages.cookies.title, description: d.legal.pages.cookies.intro }
  }
}

const OG_LOCALES: Record<Lang, string> = { fr: 'fr_TN', ar: 'ar_TN', en: 'en_US' }

export function getPageMetadata(rawLang: string, path: SitePath): Metadata {
  if (!isLang(rawLang)) notFound()
  const { title: pageTitle, description } = pageCopy(rawLang, path)
  const title = path === '' ? pageTitle : `${pageTitle} | CAMCONSULT`
  const url = localizedUrl(rawLang, path)
  const images = [{ url: `${SITE_URL}/brand/logo-cabinet-navy.png`, alt: 'Cabinet Ayadi Mohamed — CAMCONSULT' }]

  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: 'website', siteName: 'CAMCONSULT', title, description, url,
      locale: OG_LOCALES[rawLang],
      alternateLocale: LOCALES.filter((lang) => lang !== rawLang).map((lang) => OG_LOCALES[lang]),
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export function businessStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AccountingService',
        '@id': `${SITE_URL}/#business`,
        name: 'Cabinet Ayadi Mohamed',
        alternateName: ['CAMCONSULT', 'Cabinet Mohamed Ayadi'],
        url: localizedUrl(DEFAULT_LOCALE),
        logo: `${SITE_URL}/brand/logo-cabinet-navy.png`,
        image: `${SITE_URL}/brand/logo-cabinet-navy.png`,
        telephone: '+21671847608',
        email: 'camcompta@planet.tn',
        address: {
          '@type': 'PostalAddress', streetAddress: '21 Rue Iraq, Lafayette',
          addressLocality: 'Tunis', postalCode: '1001', addressCountry: 'TN',
        },
        openingHoursSpecification: [{
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '08:00', closes: '17:00',
        }],
      },
      {
        '@type': 'WebSite', '@id': `${SITE_URL}/#website`,
        url: SITE_URL, name: 'CAMCONSULT',
        alternateName: ['Cabinet Ayadi Mohamed', 'Cabinet Mohamed Ayadi'],
        inLanguage: [...LOCALES], publisher: { '@id': `${SITE_URL}/#business` },
      },
    ],
  }
}
