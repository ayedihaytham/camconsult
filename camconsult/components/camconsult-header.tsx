'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Globe2, Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ClientPortalLink } from '@/components/client-portal-link'

export type CamconsultHeaderProps = {
  lang?: 'fr' | 'ar' | 'en'
  theme?: 'light' | 'navy'
  clientPortalUrl?: string
}

const navigation = [
  { fr: 'Accueil', ar: 'الرئيسية', en: 'Home', href: '/' },
  { fr: 'À propos', ar: 'من نحن', en: 'About', href: '/#a-propos' },
  { fr: 'Services', ar: 'الخدمات', en: 'Services', href: '/services' },
  { fr: 'Outils fiscaux', ar: 'الأدوات الضريبية', en: 'Tax tools', href: '/outils-fiscaux' },
  { fr: 'Blog', ar: 'المدونة', en: 'Blog', href: '/blog' },
  { fr: 'Ressources', ar: 'الموارد', en: 'Resources', href: '/ressources' },
  { fr: 'Contact', ar: 'اتصل بنا', en: 'Contact', href: '/contact' },
]

export function CamconsultHeader({ lang = 'fr', theme = 'navy', clientPortalUrl }: CamconsultHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeHref, setActiveHref] = useState('/')
  const isArabic = lang === 'ar'
  const isNavy = theme === 'navy'
  const languageLabel = lang === 'fr' ? 'FR' : lang === 'ar' ? 'AR' : 'EN'
  const siteCopy = { fr: 'Prendre rendez-vous', ar: 'احجز موعداً', en: 'Book an appointment' }[lang]

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setActiveHref(window.location.pathname)
  }, [])

  return (
    <header dir={isArabic ? 'rtl' : 'ltr'} className={cn('sticky top-0 z-50 w-full transition-all duration-300', isScrolled ? 'bg-white/98 shadow-[0_12px_32px_rgba(11,37,69,0.12)] backdrop-blur-lg border-b border-navy/8' : isNavy ? 'border-b border-white/10 bg-gradient-to-b from-navy/95 to-navy/90 backdrop-blur-md' : 'border-b border-navy/8 bg-white/90 backdrop-blur-md')}>
      <div className={cn('mx-auto flex max-w-[1760px] items-center gap-4 px-4 transition-all duration-300 sm:px-6 lg:px-8 2xl:gap-7 2xl:px-10', isScrolled ? 'min-h-16' : 'min-h-[80px]')}>
        
        {/* Logo & Rail — isolated zone, never overlaps navigation */}
        <div className="flex min-w-0 flex-1 items-center gap-0 xl:flex-none xl:min-w-[248px]">
          <div className={cn('h-12 w-px transition-all duration-300', isScrolled ? 'bg-gold/40' : 'bg-gold/60')} aria-hidden="true" />
          <a href="/" className={cn('ml-5 flex shrink-0 items-center gap-2.5', isScrolled || !isNavy ? 'text-navy' : 'text-white')} aria-label={isArabic ? 'CAMCONSULT الرئيسية' : 'CAMCONSULT accueil'}>
            <div className={cn('relative grid size-9 place-items-center rounded-full border-2 transition-all duration-300', isScrolled ? 'border-gold/70 text-gold/70' : 'border-gold text-gold')}>
              <span className="font-serif text-base font-bold">C</span>
              <div className="absolute inset-0 rounded-full animate-pulse opacity-30" style={{ background: 'radial-gradient(circle, #C9A96A 0%, transparent 70%)' }} aria-hidden="true" />
            </div>
            <span className={cn('text-xs font-bold tracking-widest transition-opacity duration-300', isScrolled ? 'opacity-90' : 'opacity-100')}>CAMCONSULT</span>
          </a>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden min-w-0 flex-1 items-center justify-start gap-2 2xl:flex 2xl:gap-4" aria-label={isArabic ? 'التنقل الرئيسي' : lang === 'en' ? 'Main navigation' : 'Navigation principale'}>
          {navigation.map((item) => {
            const isActive = activeHref === item.href || (item.href === '/' && activeHref === '')
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setActiveHref(item.href)}
                className={cn('group relative whitespace-nowrap px-1 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-all duration-200 xl:px-2 xl:text-[11px] xl:tracking-widest 2xl:px-3', isScrolled || !isNavy ? 'text-navy/55 hover:text-navy/85' : 'text-white/60 hover:text-white/90', isActive && cn('font-bold', isScrolled || !isNavy ? 'text-navy' : 'text-white'))}
              >
                {item[lang]}
                <span className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-center bg-gradient-to-r from-transparent via-gold to-transparent transition-all duration-300', isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-70')} />
              </a>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden shrink-0 items-center justify-end gap-3 2xl:flex 2xl:gap-4">
          <span className={cn('mx-1 h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />

          {/* Language Selector */}
          <button
            type="button"
            className={cn('group relative flex min-w-[78px] shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300', isScrolled || !isNavy ? 'border border-navy/10 bg-navy/5 text-navy hover:bg-navy/8' : 'border border-white/15 bg-white/5 text-white hover:bg-white/10')}
            aria-label={isArabic ? 'اختيار اللغة' : lang === 'en' ? 'Choose language' : 'Choisir la langue'}
          >
            <Globe2 className="size-3 text-gold" aria-hidden="true" />
            <span className={cn('rounded-full px-1.5 py-0.5 transition-all duration-200', !isArabic ? 'bg-gold/80 text-navy' : (isScrolled || !isNavy ? 'text-navy/60' : 'text-white/70'))}>{languageLabel}</span>
          </button>

          <span className={cn('h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />
          <div className="shrink-0"><ClientPortalLink href={clientPortalUrl} lang={lang === 'ar' ? 'ar' : 'fr'} compact /></div>
          <span className={cn('h-8 w-px shrink-0 transition-all duration-300', isScrolled ? 'bg-navy/15' : 'bg-white/20')} aria-hidden="true" />

          {/* CTA Button */}
          <a
            href="/contact"
            className="group relative overflow-hidden rounded-lg bg-gradient-to-b from-gold to-gold/90 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] xl:px-4 xl:text-[10px] xl:tracking-widest 2xl:px-5 text-navy shadow-lg shadow-gold/30 transition-all duration-300 hover:shadow-lg hover:shadow-gold/50 hover:scale-105 active:scale-95"
          >
            <span className="relative inline-flex items-center gap-2">
              {siteCopy}
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
          aria-label={isOpen ? (isArabic ? 'إغلاق القائمة' : 'Fermer le menu') : (isArabic ? 'فتح القائمة' : 'Ouvrir le menu')}
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <div
        id="mobile-navigation"
        className={cn('overflow-hidden transition-all duration-300 xl:hidden', isScrolled || !isNavy ? 'border-t border-navy/10 bg-white/95' : 'border-t border-white/10 bg-navy/95', isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0')}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-0 px-6 py-3 sm:px-10" aria-label={isArabic ? 'التنقل للجوال' : lang === 'en' ? 'Mobile navigation' : 'Navigation mobile'}>
          {navigation.map((item) => {
            const isActive = activeHref === item.href || (item.href === '/' && activeHref === '')
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => {
                  setActiveHref(item.href)
                  setIsOpen(false)
                }}
                className={cn('border-b px-2 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200', isScrolled || !isNavy ? 'border-navy/10 text-navy hover:bg-navy/5' : 'border-white/10 text-white hover:bg-white/10', isActive && 'text-gold')}
              >
                {item[lang]}
              </a>
            )
          })}
          <ClientPortalLink href={clientPortalUrl} lang={lang === 'ar' ? 'ar' : 'fr'} />
          <a
            href="/contact"
            onClick={() => setIsOpen(false)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy"
          >
            {siteCopy}
            <ArrowRight className={cn('size-4', isArabic && 'rotate-180')} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  )
}
