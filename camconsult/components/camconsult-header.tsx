'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Briefcase, Check, ChevronDown, Globe2, Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ClientPortalLink } from '@/components/client-portal-link'
import { getDictionary, LOCALES, type Lang } from '@/lib/i18n'

export type CamconsultHeaderProps = {
  lang?: Lang
  theme?: 'light' | 'navy'
  clientPortalUrl?: string
}

const LANGUAGE_NAMES: Record<Lang, string> = { fr: 'Français', ar: 'العربية', en: 'English' }
const LANGUAGE_SHORT: Record<Lang, string> = { fr: 'FR', ar: 'AR', en: 'EN' }

function withLocale(lang: Lang, href: string) {
  if (href === '/') return `/${lang}`
  if (href.startsWith('/#')) return `/${lang}${href.slice(1)}`
  return `/${lang}${href}`
}

export function CamconsultHeader({ lang = 'fr', theme = 'navy', clientPortalUrl }: CamconsultHeaderProps) {
  const dict = getDictionary(lang)
  const pathname = usePathname()
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [activeHref, setActiveHref] = useState('/')
  const langMenuRef = useRef<HTMLDivElement>(null)
  const isArabic = lang === 'ar'
  const isNavy = theme === 'navy'

  const navigation = [
    { label: dict.nav.home, href: '/' },
    { label: dict.nav.about, href: '/#a-propos' },
    { label: dict.nav.services, href: '/services' },
    { label: dict.nav.tools, href: '/outils-fiscaux' },
    { label: dict.nav.blog, href: '/blog' },
    { label: dict.nav.resources, href: '/ressources' },
  ]

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setActiveHref(window.location.pathname)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function switchLanguage(next: Lang) {
    setLangMenuOpen(false)
    const rest = pathname.replace(/^\/(fr|ar|en)/, '') || '/'
    router.push(`/${next}${rest === '/' ? '' : rest}`)
  }

  const sepClass = cn('h-6 w-px shrink-0', !isNavy ? 'bg-navy/15' : 'bg-white/15')

  return (
    <header dir={isArabic ? 'rtl' : 'ltr'} className={cn('sticky top-0 z-50 w-full transition-all duration-300 backdrop-blur-md', isNavy ? cn('border-b border-white/10 bg-navy/95', isScrolled && 'shadow-[0_12px_32px_rgba(0,0,0,0.25)]') : cn('border-b border-navy/8 bg-white/90', isScrolled && 'shadow-[0_12px_32px_rgba(11,37,69,0.12)]'))}>
      <div className={cn('mx-auto flex max-w-[1760px] items-center gap-6 px-4 transition-all duration-300 sm:px-6 lg:px-8 xl:px-10', isScrolled ? 'min-h-[60px]' : 'min-h-[68px]')}>

        {/* Logo */}
        <a href={withLocale(lang, '/')} className={cn('flex shrink-0 items-center gap-3', !isNavy ? 'text-navy' : 'text-white')} aria-label={`CAMCONSULT — ${dict.nav.home}`}>
          <span className={cn('grid size-9 place-items-center rounded border', !isNavy ? 'border-navy/25' : 'border-white/35')}>
            <img
              src={!isNavy ? '/brand/logo-mark-light.png' : '/brand/logo-mark-dark.png'}
              alt="CAMCONSULT"
              className="size-6 object-contain"
            />
          </span>
          <span className="text-xs font-bold tracking-[0.2em]">CAMCONSULT</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex 2xl:gap-3" aria-label={dict.nav.mainNavLabel}>
          {navigation.map((item) => {
            const href = withLocale(lang, item.href)
            const isActive = activeHref === href || (item.href === '/' && (activeHref === '' || activeHref === `/${lang}`))
            return (
              <a
                key={item.href}
                href={href}
                onClick={() => setActiveHref(href)}
                className={cn('group relative shrink-0 whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200', !isNavy ? 'text-navy/60 hover:text-navy' : 'text-white/65 hover:text-white', isActive && cn('font-bold', !isNavy ? 'text-navy' : 'text-white'))}
              >
                {item.label}
                <span className={cn('absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gold transition-opacity duration-200', isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')} aria-hidden="true" />
              </a>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden shrink-0 items-center justify-end gap-4 xl:flex">
          {/* Language Selector */}
          <div ref={langMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors', !isNavy ? 'text-navy/70 hover:text-navy' : 'text-white/70 hover:text-white')}
              aria-label={dict.nav.chooseLanguage}
              aria-expanded={langMenuOpen}
            >
              <Globe2 className="size-3.5 text-gold" aria-hidden="true" />
              {LANGUAGE_SHORT[lang]}
              <ChevronDown className={cn('size-3 transition-transform', langMenuOpen && 'rotate-180')} aria-hidden="true" />
            </button>
            {langMenuOpen && (
              <div className="absolute end-0 top-full z-50 mt-3 w-40 overflow-hidden rounded-2xl border border-navy/10 bg-white p-1.5 shadow-pop" role="menu">
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="menuitem"
                    onClick={() => switchLanguage(code)}
                    className={cn('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors', code === lang ? 'bg-gold/15 text-navy' : 'text-navy/70 hover:bg-navy/5 hover:text-navy')}
                  >
                    {LANGUAGE_NAMES[code]}
                    {code === lang && <Check className="size-3.5 text-gold" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className={sepClass} aria-hidden="true" />
          <div className="shrink-0"><ClientPortalLink href={clientPortalUrl} lang={lang} compact /></div>

          {/* Job Application */}
          <a
            href={withLocale(lang, '/candidature')}
            title={dict.nav.jobApplicationTooltip}
            className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors', !isNavy ? 'text-navy/70 hover:text-navy' : 'text-white/70 hover:text-white')}
          >
            <Briefcase className="size-3.5 text-gold" aria-hidden="true" />
            {dict.nav.jobApplication}
          </a>

          {/* CTA Button */}
          <a
            href={withLocale(lang, '/contact')}
            className="group inline-flex shrink-0 items-center gap-2 rounded-sm bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-navy transition-opacity hover:opacity-90"
          >
            {dict.nav.bookAppointment}
            <ArrowRight className={cn('size-3.5 transition-transform duration-300 group-hover:translate-x-0.5', isArabic && 'rotate-180')} aria-hidden="true" />
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn('ml-auto grid size-10 shrink-0 place-items-center rounded-lg border transition-all duration-300 xl:hidden', !isNavy ? 'border-navy/15 text-navy hover:bg-navy/5' : 'border-white/20 text-white hover:bg-white/10')}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          aria-label={isOpen ? dict.nav.closeMenu : dict.nav.openMenu}
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <div
        id="mobile-navigation"
        className={cn('overflow-hidden transition-all duration-300 xl:hidden', !isNavy ? 'border-t border-navy/10 bg-white/95' : 'border-t border-white/10 bg-navy/95', isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0')}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-0 px-6 py-3 sm:px-10" aria-label={dict.nav.mobileNavLabel}>
          {navigation.map((item) => {
            const href = withLocale(lang, item.href)
            const isActive = activeHref === href || (item.href === '/' && (activeHref === '' || activeHref === `/${lang}`))
            return (
              <a
                key={item.href}
                href={href}
                onClick={() => {
                  setActiveHref(href)
                  setIsOpen(false)
                }}
                className={cn('border-b px-2 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200', !isNavy ? 'border-navy/10 text-navy hover:bg-navy/5' : 'border-white/10 text-white hover:bg-white/10', isActive && 'text-gold')}
              >
                {item.label}
              </a>
            )
          })}
          <div className="mt-3 flex flex-wrap gap-2 border-b border-navy/10 px-2 py-3">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => { switchLanguage(code); setIsOpen(false) }}
                className={cn('rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors', code === lang ? 'border-gold bg-gold text-navy' : !isNavy ? 'border-navy/15 text-navy/60' : 'border-white/20 text-white/70')}
              >
                {LANGUAGE_SHORT[code]}
              </button>
            ))}
          </div>
          <ClientPortalLink href={clientPortalUrl} lang={lang} />
          <a
            href={withLocale(lang, '/candidature')}
            onClick={() => setIsOpen(false)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-gold bg-transparent px-4 py-3 text-xs font-bold uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-navy"
          >
            <Briefcase className="size-4" aria-hidden="true" />
            {dict.nav.jobApplication}
          </a>
          <a
            href={withLocale(lang, '/contact')}
            onClick={() => setIsOpen(false)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy"
          >
            {dict.nav.bookAppointment}
            <ArrowRight className={cn('size-4', isArabic && 'rotate-180')} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  )
}
