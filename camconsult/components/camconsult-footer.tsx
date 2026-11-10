'use client'

import { useEffect, useRef } from 'react'

import { Ico } from '@/components/gl/parts'
import { NewsletterForm } from '@/components/gl/newsletter'
import { initGl } from '@/components/gl/engine'
import { glConfig } from '@/components/gl/config'
import { getDictionary, type Lang } from '@/lib/i18n'

export type CamconsultFooterProps = {
  lang?: Lang
  clientPortalUrl?: string
  /** Accueil : le pied de page vit dans la racine de la page, qui anime déjà tout. */
  home?: boolean
}

const DEFAULT_PORTAL = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://cabinet.camconsult.com.tn/login'

/** Pied de page de la maquette : colonnes sur fond marine profond, barre légale, + calendrier fiscal, réseaux et espace client du site d'origine. */
export function CamconsultFooter({ lang = 'fr', clientPortalUrl = DEFAULT_PORTAL, home = false }: CamconsultFooterProps) {
  const dict = getDictionary(lang)
  const root = useRef<HTMLDivElement>(null)
  const L = (path: string) => `/${lang}${path === '/' ? '' : path}`
  const isExternal = /^https?:\/\//i.test(clientPortalUrl)

  useEffect(() => {
    if (home || !root.current) return
    return initGl(root.current, glConfig(lang, false))
  }, [home, lang])

  const navigation = [
    { label: dict.nav.home, href: L('/') },
    { label: dict.nav.about, href: `/${lang}#bilan` },
    { label: dict.nav.services, href: L('/services') },
    { label: dict.nav.tools, href: L('/outils-fiscaux') },
    { label: dict.nav.blog, href: L('/blog') },
    { label: dict.nav.resources, href: L('/ressources') },
    { label: dict.nav.jobApplication, href: L('/candidature') },
  ]
  const legal = [
    { label: dict.footer.legal.mentions, href: L('/mentions-legales') },
    { label: dict.footer.legal.privacy, href: L('/confidentialite') },
    { label: dict.footer.legal.terms, href: L('/cgu') },
    { label: dict.footer.legal.cookies, href: L('/cookies') },
  ]
  const [addr1, ...addrRest] = dict.footer.address.split(', ')

  return (
    <div ref={root} className={home ? undefined : 'gl gl-contents'} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <footer className="foot" id="contact-footer">
        <div className="wrap">
          <div className="nlb">
            <div>
              <b>{dict.footer.taxCalendar}</b>
              <p>{dict.footer.taxCalendarText}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 20px', alignItems: 'center' }}>
              <NewsletterForm placeholder={dict.footer.newsletterPlaceholder} cta={dict.footer.newsletterCta} success={dict.footer.newsletterSuccess} />
              <a href={L('/outils-fiscaux#calendrier-fiscal')}>{dict.footer.newsletterSeeCalendar} →</a>
            </div>
          </div>

          <div className="cm-foot">
            <div>
              <a href={home ? '#hero' : L('/')} aria-label="Cabinet Ayadi Mohamed">
                <img src="/brand/logo-cabinet-white.png" alt="Cabinet Ayadi Mohamed — Accounting & Consulting" width={1500} height={382} style={{ width: 210, height: 'auto' }} />
              </a>
              <p style={{ marginTop: 16, opacity: 0.75, maxWidth: '30ch' }}>{dict.footer.tagline}</p>
              <span className="cm-open badge" data-open>
                <i />
                <span data-open-txt>{dict.footer.hours}</span>
              </span>
              <div className="soc">
                <a href="tel:+21698400368" aria-label={dict.footer.phoneMobile}><Ico n="phone" /></a>
                <a href="mailto:camcompta@planet.tn" aria-label="Email"><Ico n="mail" /></a>
                <a href="#reseaux" aria-label="Instagram"><Ico n="insta" /></a>
              </div>
            </div>
            <div>
              <h4>{dict.footer.navHeading}</h4>
              <ul>
                {navigation.map((n) => (
                  <li key={n.href}><a href={n.href}>{n.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{dict.footer.servicesHeading}</h4>
              <ul>
                {dict.footer.services.map((s) => (
                  <li key={s}><a href={L('/services')}>{s}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{dict.footer.contactHeading}</h4>
              <address>
                {addr1}
                {addrRest.length > 0 && <><br />{addrRest.join(', ')}</>}
                <br />
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dict.footer.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sky)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                  {dict.footer.directions}
                </a>
                <span className="ph2">
                  <a href="tel:+21671847608"><small>{dict.footer.phoneFixed}</small><span dir="ltr">71 847 608</span></a>
                  <a href="tel:+21698400368"><small>{dict.footer.phoneMobile}</small><span dir="ltr">98 400 368</span></a>
                </span>
                <a href="mailto:camcompta@planet.tn">camcompta@planet.tn</a>
                <br />
                <span className="hrs">{dict.footer.hours}</span>
              </address>
              <a className="portal" href={clientPortalUrl} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})} title={dict.clientPortal.tooltip}>
                <Ico n="lock" />
                {dict.clientPortal.label}
              </a>
            </div>
          </div>
          <div className="cm-foot-b">
            <nav aria-label={dict.footer.legalLinksLabel}>
              {legal.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </nav>
            <span>© {new Date().getFullYear()} CAMCONSULT. {dict.footer.copyright}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
