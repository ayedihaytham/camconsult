'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Camera, Check, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientPortalLink } from '@/components/client-portal-link'
import { useOpenNow } from '@/lib/business-hours'
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
  const isOpen = useOpenNow()
  const [subscribed, setSubscribed] = useState(false)

  function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubscribed(true)
  }

  const navigation = [
    { label: dict.nav.home, href: '/' },
    { label: dict.nav.about, href: '/#a-propos' },
    { label: dict.nav.services, href: '/services' },
    { label: dict.nav.tools, href: '/outils-fiscaux' },
    { label: dict.nav.blog, href: '/blog' },
    { label: dict.nav.resources, href: '/ressources' },
    { label: dict.nav.jobApplication, href: '/candidature' },
  ]

  const legal = [
    { label: dict.footer.legal.mentions, href: '/mentions-legales' },
    { label: dict.footer.legal.privacy, href: '/confidentialite' },
    { label: dict.footer.legal.terms, href: '/cgu' },
    { label: dict.footer.legal.cookies, href: '/cookies' },
  ]

  const [addressLine1, ...addressRest] = dict.footer.address.split(', ')
  const addressLine2 = addressRest.join(', ')
  const taglineWords = dict.footer.tagline.trim().split(' ')
  const taglineLastWord = taglineWords.pop()
  const taglineLead = taglineWords.join(' ')

  return (
    <footer id="contact" dir={isArabic ? 'rtl' : 'ltr'} className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 pt-12 sm:px-10 lg:px-16">
        {/* Calendrier fiscal — inscription aux rappels d'échéances */}
        <div className="flex flex-col gap-5 rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <CalendarDays className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-serif text-lg leading-tight text-white">{dict.footer.taxCalendar}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-white/60">{dict.footer.taxCalendarText}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {subscribed ? (
              <p className="flex items-center gap-2 text-sm font-medium text-gold">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {dict.footer.newsletterSuccess}
              </p>
            ) : (
              <form onSubmit={submitNewsletter} className="flex items-center gap-2">
                <input
                  type="email"
                  required
                  placeholder={dict.footer.newsletterPlaceholder}
                  aria-label={dict.footer.newsletterPlaceholder}
                  className="h-11 w-full min-w-0 rounded-full border border-white/25 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:border-gold focus:outline-none sm:w-52"
                />
                <button
                  type="submit"
                  className="h-11 shrink-0 rounded-full bg-white px-5 text-xs font-bold uppercase tracking-wider text-navy transition-colors hover:bg-gold"
                >
                  {dict.footer.newsletterCta}
                </button>
              </form>
            )}
            <a
              href={withLocale(lang, '/outils-fiscaux#calendrier-fiscal')}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold underline-offset-4 hover:text-white hover:underline"
            >
              {dict.footer.newsletterSeeCalendar}
              <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-10 grid gap-12 border-b border-white/15 pb-14 lg:grid-cols-[1.35fr_0.8fr_1.15fr_1.15fr] lg:gap-10">
          <div>
            <a href={withLocale(lang, '/')} className="inline-flex items-center gap-3 text-white" aria-label="CAMCONSULT">
              <span className="grid size-11 place-items-center"><img src="/brand/logo-mark-dark.png" alt="CAMCONSULT" className="size-9 object-contain" /></span>
              <span className="text-sm font-semibold tracking-[0.28em]">CAMCONSULT</span>
            </a>
            <p className="mt-6 max-w-xs text-sm leading-7 text-white/65">{taglineLead} <em className="text-gold">{taglineLastWord}</em></p>
            {isOpen !== null && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                <span className={cn('size-2 shrink-0 rounded-full', isOpen ? 'bg-emerald-400' : 'bg-white/30')} aria-hidden="true" />
                {(isOpen ? dict.footer.openLabel : dict.footer.closedLabel).replace('{time}', isOpen ? dict.footer.timeClose : dict.footer.timeOpen)}
              </div>
            )}
            <div className="mt-7 flex items-center gap-2">
              {[
                { label: dict.footer.phoneMobile, icon: Phone, href: 'tel:+21698400368' },
                { label: 'Email', icon: Mail, href: 'mailto:camcompta@planet.tn' },
                { label: 'Instagram', icon: Camera, href: '#reseaux' },
              ].map(({ label, icon: Icon, href }) => <a key={label} href={href} aria-label={label} className="grid size-9 place-items-center rounded-xl border border-white/20 text-white/65 transition-colors duration-200 hover:border-gold hover:text-gold"><Icon className="size-4" /></a>)}
            </div>
          </div>

          <div><h2 className="footer-heading">{dict.footer.navHeading}</h2><nav className="mt-6 flex flex-col items-start gap-3">{navigation.map((item) => <a key={item.href} href={withLocale(lang, item.href)} className="footer-link">{item.label}</a>)}</nav></div>

          <div><h2 className="footer-heading">{dict.footer.servicesHeading}</h2><nav className="mt-6 grid gap-3">{dict.footer.services.map((label) => <a key={label} href={withLocale(lang, '/services')} className="footer-link">{label}</a>)}</nav></div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
            <h2 className="footer-heading">{dict.footer.contactHeading}</h2>
            <div className="mt-6 text-sm text-white/70">
              <p className="font-semibold text-white">{addressLine1}</p>
              {addressLine2 && <p className="mt-0.5 text-white/60">{addressLine2}</p>}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dict.footer.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-gold underline underline-offset-4 hover:text-white"
              >
                {dict.footer.directions}
                <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
              </a>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                <a href="tel:+21671847608" className="block">
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-white/45">{dict.footer.phoneFixed}</span>
                  <span className="mt-1 block font-medium text-white hover:text-gold">71 847 608</span>
                </a>
                <a href="tel:+21698400368" className="block">
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-white/45">{dict.footer.phoneMobile}</span>
                  <span className="mt-1 block font-medium text-white hover:text-gold">98 400 368</span>
                </a>
              </div>

              <a href="mailto:camcompta@planet.tn" className="mt-4 block hover:text-white">
                camcompta@planet.tn
              </a>
              <p className="mt-3 font-medium text-gold">{dict.footer.hours}</p>
            </div>
            <div className="mt-6"><ClientPortalLink href={clientPortalUrl} lang={lang} /></div>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} CAMCONSULT. {dict.footer.copyright}</p><nav className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={dict.footer.legalLinksLabel}>{legal.map((item, index) => <span key={item.href} className="flex items-center gap-3"><a href={withLocale(lang, item.href)} className="transition-colors hover:text-gold">{item.label}</a>{index < legal.length - 1 && <span aria-hidden="true" className="text-gold/70">·</span>}</span>)}</nav></div>
      </div>
    </footer>
  )
}
