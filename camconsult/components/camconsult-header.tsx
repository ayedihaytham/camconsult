'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { Ico } from '@/components/gl/parts'
import { initGl } from '@/components/gl/engine'
import { glConfig } from '@/components/gl/config'
import { getDictionary, LOCALES, type Lang } from '@/lib/i18n'

export type CamconsultHeaderProps = {
  lang?: Lang
  /** Conservé pour compatibilité : le nouvel en-tête s'adapte tout seul au fond qui passe dessous. */
  theme?: 'light' | 'navy'
  clientPortalUrl?: string
  /** Accueil : l'en-tête est fixe et suit les scènes ; ailleurs il reste collé en haut de la page. */
  home?: boolean
}

const LANG_LABEL: Record<Lang, string> = { fr: 'FR', ar: 'عربي', en: 'EN' }
const DEFAULT_PORTAL = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://cabinet.camconsult.com.tn/login'

/** En-tête à deux niveaux de la maquette : bandeau d'information (ouvert/fermé, téléphone, langues) puis barre de navigation. */
export function CamconsultHeader({ lang = 'fr', clientPortalUrl = DEFAULT_PORTAL, home = false }: CamconsultHeaderProps) {
  const dict = getDictionary(lang)
  const pathname = usePathname()
  const [menu, setMenu] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const isExternal = /^https?:\/\//i.test(clientPortalUrl)
  const L = (path: string) => `/${lang}${path === '/' ? '' : path}`
  // Sur l'accueil, les entrées pointent vers les sections ; ailleurs vers l'accueil + section.
  const A = (id: string) => (home ? `#${id}` : `/${lang}#${id}`)

  const nav: Array<{ label: string; href: string; n?: string }> = [
    { label: dict.nav.home, href: home ? '#hero' : L('/'), n: 'hero' },
    { label: dict.nav.about, href: A('bilan'), n: 'bilan' },
    { label: dict.nav.services, href: A('services'), n: 'services' },
    { label: dict.nav.tools, href: A('outils'), n: 'outils' },
    { label: dict.nav.blog, href: L('/blog') },
    { label: dict.nav.resources, href: L('/ressources') },
  ]

  const rest = pathname.replace(/^\/(fr|ar|en)/, '') || ''

  // Hors accueil : en-tête compact après quelques pixels de défilement + barre de progression de lecture.
  useEffect(() => {
    if (home) return
    const hdr = root.current?.querySelector('.hdr') as HTMLElement | null
    if (!hdr) return
    const on = () => {
      const y = scrollY
      hdr.classList.toggle('cmp', y > 80)
      const m = document.documentElement.scrollHeight - innerHeight
      hdr.style.setProperty('--sp', (m > 0 ? y / m : 0).toFixed(4))
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [home, pathname])

  // Hors accueil, le moteur léger ne gère que l'état ouvert/fermé et les boutons magnétiques.
  useEffect(() => {
    if (home || !root.current) return
    return initGl(root.current, glConfig(lang, false))
  }, [home, lang])

  useEffect(() => {
    const hdr = root.current?.querySelector('.hdr')
    if (!hdr || !home) {
      if (hdr) hdr.classList.toggle('iv', menu)
      return
    }
  }, [menu, home])

  const portal = (
    <a href={clientPortalUrl} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})} title={dict.clientPortal.tooltip} aria-label={`${dict.clientPortal.label} — ${dict.clientPortal.tooltip}`}>
      <Ico n="lock" />
      {dict.clientPortal.label}
    </a>
  )

  return (
    <div ref={root} className={home ? undefined : 'gl gl-contents'} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className={home ? 'hdr' : 'hdr st'}>
        <div className="strip">
          <span className="cm-open" data-open>
            <i />
            <span data-open-txt>{dict.footer.hours}</span>
          </span>
          <span className="tl">
            <a href="tel:+21698400368" dir="ltr">+216 98 400 368</a>
            {portal}
            <a href={L('/candidature')} title={dict.nav.jobApplicationTooltip}>{dict.nav.jobApplication}</a>
            <span className="lng" role="group" aria-label={dict.nav.chooseLanguage}>
              {LOCALES.map((code) => (
                <a key={code} href={`/${code}${rest}`} hrefLang={code} lang={code} aria-current={code === lang ? 'true' : undefined}>
                  {LANG_LABEL[code]}
                </a>
              ))}
            </span>
          </span>
        </div>
        <div className="cap">
          <a className="lg" href={home ? '#hero' : L('/')} aria-label={`Cabinet Ayadi Mohamed — ${dict.nav.home}`}>
            <img src="/brand/logo-cabinet-white.png" alt="Cabinet Ayadi Mohamed" width={1500} height={382} />
            <img src="/brand/logo-cabinet-navy.png" alt="" width={1500} height={382} aria-hidden="true" />
          </a>
          <nav id="cnav" aria-label={dict.nav.mainNavLabel}>
            <span className="ind" aria-hidden="true" />
            {nav.map((item) => (
              <a key={item.label} href={item.href} data-n={item.n}>{item.label}</a>
            ))}
          </nav>
          <a className="pill" href={home ? '#contact' : L('/contact')}>
            {dict.nav.bookAppointment}
            <span className="ar"><Ico n="arrow" /></span>
          </a>
          <button type="button" className="burger" aria-label={menu ? dict.nav.closeMenu : dict.nav.openMenu} aria-expanded={menu} aria-controls="mnav" onClick={() => setMenu((v) => !v)}>
            <Ico n={menu ? 'x' : 'menu'} />
          </button>
        </div>
      </header>
      <nav id="mnav" className={'mnav' + (menu ? ' open' : '')} aria-label={dict.nav.mobileNavLabel} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false) }}>
        {nav.map((item) => (
          <a key={item.label} href={item.href}>{item.label}</a>
        ))}
        <a href={home ? '#contact' : L('/contact')}>{dict.nav.bookAppointment}</a>
        <div className="sub">
          {LOCALES.map((code) => (
            <a key={code} href={`/${code}${rest}`} hrefLang={code} lang={code} aria-current={code === lang ? 'true' : undefined}>{LANG_LABEL[code]}</a>
          ))}
          <a href={clientPortalUrl} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{dict.clientPortal.label}</a>
          <a href={L('/candidature')}>{dict.nav.jobApplication}</a>
        </div>
      </nav>
    </div>
  )
}
