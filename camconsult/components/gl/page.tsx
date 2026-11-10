'use client'

import { useEffect, useRef } from 'react'

import { Ico, Title, type TitlePart } from '@/components/gl/parts'
import { initGl } from '@/components/gl/engine'
import { glConfig } from '@/components/gl/config'
import { getDictionary, type Lang } from '@/lib/i18n'

/** Racine d'une page intérieure : applique le langage de l'accueil (polices, couleurs, apparitions au défilement). */
export function PageShell({ lang, children, fab = true }: { lang: Lang; children: React.ReactNode; fab?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLAnchorElement>(null)
  const { nav } = getDictionary(lang)
  useEffect(() => {
    if (!root.current) return
    return initGl(root.current, glConfig(lang, false))
  }, [lang])
  // Le bouton « Prendre rendez-vous » (pastille verte qui pulse) apparaît dès que l'on quitte le haut de la page.
  useEffect(() => {
    const el = btn.current
    if (!el) return
    const on = () => el.classList.toggle('on', scrollY > 320)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  return (
    <div ref={root} className="gl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <noscript>
        <style>{`.gl .hs .w>i{transform:none}.gl .sa:not(.in){opacity:1}`}</style>
      </noscript>
      {children}
      {fab && (
        <a ref={btn} className="fab" href={`/${lang}/contact`} aria-label={nav.bookAppointment}>
          <Ico n="clip" />
          <span>{nav.bookAppointment}</span>
        </a>
      )}
    </div>
  )
}

/** Titre de page : dernier mot en italique, comme sur l'accueil. */
export function lastWordParts(text: string): TitlePart[] {
  const w = text.trim().split(' ')
  if (w.length < 2) return [{ em: text }]
  const last = w.pop() as string
  return [w.join(' ') + ' ', { em: last }]
}

/** Bandeau d'en-tête des pages intérieures : fond marine quadrillé, fil d'Ariane, titre animé mot à mot. */
export function PageHero({ lang, crumbs, eyebrow, title, description, extra, em = true }: { lang: Lang; crumbs?: string[]; eyebrow: string; title: string; description?: string; extra?: React.ReactNode; em?: boolean }) {
  return (
    <header className="ip-hero">
      <div className="ipw">
        {crumbs && crumbs.length > 0 && (
          <div className="crumb">
            <a href={`/${lang}`}>{crumbs[0]}</a>
            {crumbs.slice(1).map((c) => (
              <span key={c}>/ <span style={{ color: '#fff' }}>{c}</span></span>
            ))}
          </div>
        )}
        <p className="eb l">{eyebrow}</p>
        <Title as="h1" parts={em ? lastWordParts(title) : [title]} />
        {description && <p className="d">{description}</p>}
        {extra}
      </div>
    </header>
  )
}
