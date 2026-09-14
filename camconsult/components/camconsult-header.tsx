'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, Globe2, Menu, X } from 'lucide-react'

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
    { label: dict.nav.contact, href: '/contact' },
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

  return (
    <header dir={isArabic ? 'rtl' : 'ltr'} className={cn('sticky top-0 z-50 w-full transition-all duration-300', isScrolled ? 'bg-white/98 shadow-[0_12px_32px_rgba(11,37,69,0.12)] backdrop-blur-lg border-b border-navy/8' : isNavy ? 'border-b border-white/10 bg-gradient-to-b from-navy/95 to-navy/90 backdrop-blur-md' : 'border-b border-navy/8 bg-white/90 backdrop-blur-md')}>
      <div className={cn('mx-auto flex max-w-[1760px] items-center gap-4 px-4 transition-all duration-300 sm:px-6 lg:px-8 2xl:gap-7 2xl:px-10', isScrolled ? 'min-h-16' : 'min-h-[80px]')}>

        {/* Logo & Rail — isolated zone, never overlaps navigation */}
        <div className="flex min-w-0 flex-1 items-center gap-0 xl:flex-none xl:min-w-[210px]">
          <div className={cn('h-12 w-px transition-all duration-300', isScrolled ? 'bg-gold/40' : 'bg-gold/60')} aria-hidden="true" />
          <a href={withLocale(lang, '/')} className={cn('ml-5 flex shrink-0 items-center gap-2.5', isScrolled || !isNavy ? 'text-navy' : 'text-white')} aria-label={`CAMCONSULT — ${dict.nav.home}`}>
            <div className="relative grid size-9 place-items-center">
              <div className="absolute inset-0 rounded-full animate-pulse opacity-30" style={{ background: 'radial-gradient(circle, #C9A96A 0%, transparent 70%)' }} aria-hidden="true" />
              <img
                src={isScrolled || !isNavy ? '/brand/logo-mark-light.png' : '/brand/logo-mark-dark.png'}
                alt="CAMCONSULT"
                className="relative size-8 object-contain"
              />
            </div>
            <span className={cn('text-xs font-bold tracking-widest transition-opacity duration-300', isScrolled ? 'opacity-90' : 'opacity-100')}>CAMCONSULT</span>
          </a>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden min-w-0 flex-1 items-center justify-start gap-0.5 overflow-hidden 2xl:flex 2xl:gap-1" aria-label={dict.nav.mainNavLabel}>
          {navigation.map((item) => {
            const href = withLocale(lang, item.href)
            const isActive = activeHref === href || (item.href === '/' && (activeHref === '' || activeHref === `/${lang}`))
            return (
              <a
                key={item.href}
                href={href}
                onClick={() => setActiveHref(href)}
                className={cn('group relative shrink-0 whitespace-nowrap px-1 py-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 xl:px-1.5 xl:text-[10px] 2xl:px-2 2xl:text-[11px] 2xl:tracking-wide', isScrolled || !isNavy ? 'text-navy/55 hover:text-navy/85' : 'text-white/60 hover:text-white/90', isActive && cn('font-bold', isScrolled || !isNavy ? 'text-navy' : 'text-white'))}
              >
                {item.label}
                <span className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-center bg-gradient-to-r from-transparent via-gold to-transparent transition-all duration-300', isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-70')} />
              </a>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden shrink-0 items-center justify-end gap-2 2xl:flex 2xl:gap-3">
          <span className={cn('mx-1 h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />

          {/* Language Selector */}
          <div ref={langMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              className={cn('group relative flex min-w-[78px] items-center justify-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300', isScrolled || !isNavy ? 'border border-navy/10 bg-navy/5 text-navy hover:bg-navy/8' : 'border border-white/15 bg-white/5 text-white hover:bg-white/10')}
              aria-label={dict.nav.chooseLanguage}
              aria-expanded={langMenuOpen}
            >
              <Globe2 className="size-3 text-gold" aria-hidden="true" />
              <span className="rounded-full bg-gold/80 px-1.5 py-0.5 text-navy">{LANGUAGE_SHORT[lang]}</span>
              <ChevronDown className={cn('size-2.5 transition-transform', langMenuOpen && 'rotate-180')} aria-hidden="true" />
            </button>
            {langMenuOpen && (
              <div className="absolute end-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-navy/10 bg-white p-1.5 shadow-pop" role="menu">
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

          <span className={cn('h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />
          <div className="shrink-0"><ClientPortalLink href={clientPortalUrl} lang={lang} compact /></div>
          <span className={cn('h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />

          {/* CTA Button */}
          <a
            href={withLocale(lang, '/contact')}
            className="group relative overflow-hidden rounded-lg bg-gradient-to-b from-gold to-gold/90 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] xl:px-4 xl:text-[10px] xl:tracking-widest 2xl:px-5 text-navy shadow-lg shadow-gold/30 transition-all duration-300 hover:shadow-lg hover:shadow-gold/50 hover:scale-105 active:scale-95"
          >
            <span className="relative inline-flex items-center gap-2">
              {dict.nav.bookAppointment}
              <ArrowRight className={cn('size-3.5 transition-transform duration-300 group-hover:translate-x-0.5', isArabic && 'rotate-180')} aria-hidden="true" />
            </span>
            <div className="absolute inset-0 -left-full bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-all duration-500 group-hover:left-full group-hover:opacity-20" />
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn('ml-auto grid size-10 shrink-0 place-items-center rounded-lg border transition-all duration-300 2xl:hidden', isScrolled || !isNavy ? 'border-navy/15 text-navy hover:bg-navy/5' : 'border-white/20 text-white hover:bg-white/10')}
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
        className={cn('overflow-hidden transition-all duration-300 2xl:hidden', isScrolled || !isNavy ? 'border-t border-navy/10 bg-white/95' : 'border-t border-white/10 bg-navy/95', isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0')}
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
                className={cn('border-b px-2 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200', isScrolled || !isNavy ? 'border-navy/10 text-navy hover:bg-navy/5' : 'border-white/10 text-white hover:bg-white/10', isActive && 'text-gold')}
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
                className={cn('rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors', code === lang ? 'border-gold bg-gold text-navy' : isScrolled || !isNavy ? 'border-navy/15 text-navy/60' : 'border-white/20 text-white/70')}
              >
                {LANGUAGE_SHORT[code]}
              </button>
            ))}
          </div>
          <ClientPortalLink href={clientPortalUrl} lang={lang} />
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
