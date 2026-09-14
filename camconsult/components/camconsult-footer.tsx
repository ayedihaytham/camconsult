'use client'

import { ArrowRight, Globe2, Mail, Phone, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientPortalLink } from '@/components/client-portal-link'
import { getDictionary, type Lang } from '@/lib/i18n'

export type CamconsultFooterProps = {
  lang?: Lang
  clientPortalUrl?: string
}

function withLocale(lang: Lang, href: string) {
  if (href === '/') return `/${lang}`
  if (href.startsWith('/#')) return `/${lang}${href.slice(1)}`
  return `/${lang}${href}`
}

export function CamconsultFooter({ lang = 'fr', clientPortalUrl }: CamconsultFooterProps) {
  const dict = getDictionary(lang)
  const isArabic = lang === 'ar'

  const navigation = [
    { label: dict.nav.home, href: '/' },
    { label: dict.nav.about, href: '/#a-propos' },
    { label: dict.nav.services, href: '/services' },
    { label: dict.nav.tools, href: '/outils-fiscaux' },
    { label: dict.nav.blog, href: '/blog' },
    { label: dict.nav.resources, href: '/ressources' },
    { label: dict.nav.contact, href: '/contact' },
  ]

  const legal = [
    { label: dict.footer.legal.mentions, href: '/mentions-legales' },
    { label: dict.footer.legal.privacy, href: '/confidentialite' },
    { label: dict.footer.legal.terms, href: '/cgu' },
    { label: dict.footer.legal.cookies, href: '/cookies' },
  ]

  return (
    <footer id="contact" dir={isArabic ? 'rtl' : 'ltr'} className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="grid gap-12 border-b border-white/15 pb-14 lg:grid-cols-[1.35fr_0.8fr_1.15fr_1.15fr] lg:gap-10">
          <div>
            <a href={withLocale(lang, '/')} className="inline-flex items-center gap-3 text-white" aria-label="CAMCONSULT">
              <span className="grid size-11 place-items-center"><img src="/brand/logo-mark-dark.png" alt="CAMCONSULT" className="size-9 object-contain" /></span>
              <span className="text-sm font-semibold tracking-[0.28em]">CAMCONSULT</span>
            </a>
            <p className="mt-6 max-w-xs text-sm leading-7 text-white/65">{dict.footer.tagline}</p>
            <div className="mt-7 flex items-center gap-2">
              {[{ label: 'LinkedIn', icon: Globe2 }, { label: 'Site web', icon: Globe2 }, { label: 'Avis clients', icon: ShieldCheck }].map(({ label, icon: Icon }) => <a key={label} href="#reseaux" aria-label={label} className="grid size-9 place-items-center rounded-full border border-white/20 text-white/65 transition-colors duration-200 hover:border-gold hover:text-gold"><Icon className="size-4" /></a>)}
            </div>
          </div>

          <div><h2 className="footer-heading">{dict.footer.navHeading}</h2><nav className="mt-6 flex flex-col items-start gap-3">{navigation.map((item) => <a key={item.href} href={withLocale(lang, item.href)} className="footer-link">{item.label}</a>)}</nav></div>

          <div><h2 className="footer-heading">{dict.footer.servicesHeading}</h2><nav className="mt-6 grid gap-3">{dict.footer.services.map((label) => <a key={label} href={withLocale(lang, '/services')} className="footer-link">{label}</a>)}</nav></div>

          <div><h2 className="footer-heading">{dict.footer.contactHeading}</h2><div className="mt-6 flex flex-col gap-4 text-sm text-white/70"><a href="#adresse" className="footer-contact"><Globe2 className="size-4 shrink-0 text-gold" />{dict.footer.address}</a><a href="tel:+21671847608" className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />71 847 608</a><a href="tel:+21698400368" className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="footer-contact"><Mail className="size-4 shrink-0 text-gold" />camcompta@planet.tn</a><span className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />{dict.footer.hours}</span></div><div className="mt-7"><ClientPortalLink href={clientPortalUrl} lang={lang} /></div></div>
        </div>

        <a href={withLocale(lang, '/outils-fiscaux#calendrier-fiscal')} className="group flex flex-col gap-3 border-b border-white/15 py-6 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-3 font-semibold text-gold"><span className="h-px w-8 bg-gold" />{dict.footer.taxCalendar}</span><span className="flex items-center gap-2 text-white/65 transition-colors group-hover:text-white">{dict.footer.taxCalendarText}<ArrowRight className={cn('size-4 text-gold transition-transform duration-300 group-hover:translate-x-1', isArabic && 'rtl-mirror')} /></span></a>

        <div className="flex flex-col gap-4 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} CAMCONSULT. {dict.footer.copyright}</p><nav className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={dict.footer.legalLinksLabel}>{legal.map((item, index) => <span key={item.href} className="flex items-center gap-3"><a href={withLocale(lang, item.href)} className="transition-colors hover:text-gold">{item.label}</a>{index < legal.length - 1 && <span aria-hidden="true" className="text-gold/70">·</span>}</span>)}</nav></div>
      </div>
    </footer>
  )
}
