'use client'

import { use, useState } from 'react'

import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  Landmark,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PieChart,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Users,
  WalletCards,
} from 'lucide-react'
import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { getDictionary, isLang, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useOpenNow } from '@/lib/business-hours'

type ServiceCategoryId = 'all' | 'quotidien' | 'securiser' | 'decider' | 'demarrer'
const CATEGORY_IDS: ServiceCategoryId[] = ['all', 'quotidien', 'securiser', 'decider', 'demarrer']

const SERVICE_ICONS = [FileText, BarChart3, Landmark, ShieldCheck, Users, Sparkles, Scale, PieChart]
const DIFFERENTIATOR_ICONS = [MessageCircle, Landmark, Users, ShieldCheck, BarChart3, Sparkles]
const TOOL_ICONS = [WalletCards, BarChart3, Users, Scale]
const TRUST_ICONS = [ShieldCheck, CheckCircle2, Sparkles, FileCheck2]

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params)
  const lang: Lang = isLang(rawLang) ? rawLang : 'fr'
  const { home, footer } = getDictionary(lang)
  const isArabic = lang === 'ar'
  const [sent, setSent] = useState(false)
  const p = (path: string) => `/${lang}${path === '/' ? '' : path}`
  const isOpen = useOpenNow()
  const [requestCategory, setRequestCategory] = useState(0)
  const [preferredContact, setPreferredContact] = useState<'phone' | 'email'>('phone')
  const [contactMessage, setContactMessage] = useState('')
  const contactTitleWords = home.contactTitle.trim().split(' ')
  const contactTitleLastWord = contactTitleWords.pop()
  const contactTitleLead = contactTitleWords.join(' ')

  const [serviceCategory, setServiceCategory] = useState<ServiceCategoryId>('all')
  const servicesIndexed = home.services.map((service, index) => ({ ...service, index }))
  const servicesFiltered = serviceCategory === 'all' ? servicesIndexed : servicesIndexed.filter((s) => s.category === serviceCategory)
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0)
  const selectedService = servicesIndexed.find((s) => s.index === selectedServiceIndex) ?? servicesFiltered[0] ?? servicesIndexed[0]
  function chooseCategory(id: ServiceCategoryId) {
    setServiceCategory(id)
    const next = id === 'all' ? servicesIndexed : servicesIndexed.filter((s) => s.category === id)
    if (next.length > 0 && !next.some((s) => s.index === selectedServiceIndex)) setSelectedServiceIndex(next[0].index)
  }
  const servicesTitleWords = home.servicesTitle.trim().split(' ')
  const servicesTitleLastWord = servicesTitleWords.pop()
  const servicesTitleLead = servicesTitleWords.join(' ')

  return (
    <>
      <CamconsultHeader lang={lang} theme="navy" />
      <main>
        <section id="accueil" className="relative overflow-hidden bg-navy px-6 pb-16 pt-10 text-white sm:px-10 sm:pt-12 lg:px-16 lg:pb-20 lg:pt-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto grid max-w-7xl items-start gap-14 lg:grid-cols-[1.1fr_.9fr]">
            <div className="animate-fade-up">
              <p className="eyebrow flex items-center gap-2"><span className="h-px w-6 bg-gold" aria-hidden="true" />{home.heroEyebrow}</p>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-[.98] sm:text-7xl lg:text-7xl">
                {home.heroTitlePre && <>{home.heroTitlePre}{' '}</>}
                <em className="text-gold underline decoration-gold/70 decoration-2 underline-offset-[0.14em]">{home.heroTitleHighlight}</em>{' '}
                {home.heroTitlePost}
              </h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-white/65 sm:text-lg">{home.heroText}</p>
              <div className="mt-6 flex flex-wrap gap-3"><a href={p('/contact')} className="group inline-flex items-center gap-3 rounded-sm bg-gold px-6 py-4 text-xs font-bold uppercase tracking-wider text-navy transition-transform duration-300 hover:-translate-y-0.5">{home.ctaPrimary} <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a><a href={p('/services')} className="inline-flex items-center gap-3 rounded-sm border border-white/25 px-6 py-4 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-300 hover:border-gold hover:text-gold">{home.ctaSecondary}</a></div>
            </div>
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/20 lg:mb-4 lg:p-10">
              <span className="font-serif text-6xl leading-none text-gold/70" aria-hidden="true">&ldquo;</span>
              <p className="-mt-3 max-w-sm font-serif text-3xl leading-tight">{home.sideQuote}</p>
              <div className="mt-8 flex flex-col gap-4 border-y border-white/15 py-6">
                {home.stats.map((stat) => <StatRow key={stat.label} value={stat.value} label={stat.label} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-white px-6 py-7 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10px] font-bold uppercase tracking-[.16em] text-navy/45 sm:justify-between">{home.trustBar.map((label, i) => { const Icon = TRUST_ICONS[i]; return <span key={label} className="flex items-center gap-2"><Icon className="size-4" /> {label}</span> })}</div></section>

        <section id="services" className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 border-b border-border pb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <div>
                <p className="eyebrow">{home.servicesEyebrow}</p>
                <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-navy sm:text-5xl">
                  {servicesTitleLead} <em className="text-gold">{servicesTitleLastWord}</em>
                </h2>
              </div>
              <p className="max-w-xs text-sm leading-6 text-muted-foreground lg:border-l lg:border-border lg:pl-8">{home.servicesText}</p>
            </div>

            <p className="mt-10 text-xs font-bold uppercase tracking-wide text-muted-foreground">{home.servicesFilterLabel}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {CATEGORY_IDS.map((id) => {
                const cat = home.serviceCategories[id]
                const count = id === 'all' ? servicesIndexed.length : servicesIndexed.filter((s) => s.category === id).length
                const active = serviceCategory === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseCategory(id)}
                    aria-pressed={active}
                    className={cn('relative border px-4 py-3 text-left transition-colors', active ? 'border-navy bg-navy text-white' : 'border-border bg-white text-navy hover:border-gold')}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {cat.label}
                      <span className={cn('text-xs font-normal', active ? 'text-white/55' : 'text-muted-foreground')}>{String(count).padStart(2, '0')}</span>
                    </span>
                    <span className={cn('mt-1 block text-xs', active ? 'text-white/70' : 'text-muted-foreground')}>{cat.subtitle}</span>
                    {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gold" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
              <ul className="divide-y divide-border border border-border">
                {servicesFiltered.map((service) => {
                  const active = service.index === selectedService.index
                  return (
                    <li key={service.title}>
                      <button
                        type="button"
                        onClick={() => setSelectedServiceIndex(service.index)}
                        aria-pressed={active}
                        className={cn('flex w-full items-center justify-between gap-4 border-l-4 px-5 py-4 text-left transition-colors', active ? 'border-l-gold bg-[#faf7f0]' : 'border-l-transparent hover:bg-secondary/40')}
                      >
                        <span className="flex min-w-0 items-center gap-4">
                          <span className="shrink-0 font-serif text-sm text-muted-foreground">{String(service.index + 1).padStart(2, '0')}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-serif text-lg text-navy">{service.title}</span>
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{home.serviceCategories[service.category].tag}</span>
                          </span>
                        </span>
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full border transition-colors', active ? 'border-navy text-navy' : 'border-border text-muted-foreground')}>
                          <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="relative overflow-hidden bg-navy p-8 text-white lg:p-10">
                <span className="pointer-events-none absolute -right-2 -top-6 select-none font-serif text-[9rem] leading-none text-white/5" aria-hidden="true">{String(selectedService.index + 1).padStart(2, '0')}</span>
                {(() => {
                  const Icon = SERVICE_ICONS[selectedService.index]
                  return (
                    <span className="relative grid size-11 place-items-center rounded-full border border-white/20">
                      <Icon className="size-5 text-gold" aria-hidden="true" />
                    </span>
                  )
                })()}
                <p className="relative mt-6 text-xs font-bold uppercase tracking-widest text-gold">{home.serviceCategories[selectedService.category].tag}</p>
                <h3 className="relative mt-2 font-serif text-3xl">{selectedService.title}</h3>
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/70">{selectedService.text}</p>
                <ul className="relative mt-8 flex flex-col gap-3 border-t border-white/15 pt-6">
                  {selectedService.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6">
                  <div className="flex flex-wrap items-center gap-5">
                    <a href={p('/services')} className="inline-flex items-center gap-2 rounded-sm bg-gold px-5 py-3 text-xs font-bold uppercase tracking-wider text-navy">
                      {home.servicesMore} <ArrowRight className={cn('size-4', isArabic && 'rtl-mirror')} aria-hidden="true" />
                    </a>
                    <a href={p('/contact')} className="text-xs font-bold uppercase tracking-widest text-white underline underline-offset-4 hover:text-gold">{home.ctaPrimary}</a>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-white/50">{String(selectedService.index + 1).padStart(2, '0')} / {String(servicesIndexed.length).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center"><a href={p('/services')} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.servicesSeeAll} <ArrowRight className={cn('size-4', isArabic && 'rtl-mirror')} aria-hidden="true" /></a></div>
          </div>
        </section>

        <section id="a-propos" className="scroll-mt-20 bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow={home.differenceEyebrow} title={home.differenceTitle} text={home.differenceText} light /><div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">{home.differentiators.map(([title, text], i) => { const Icon = DIFFERENTIATOR_ICONS[i]; return <div key={title} className="bg-navy p-7 transition-colors hover:bg-white/5"><Icon className="size-6 text-gold" /><h3 className="mt-6 font-serif text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div> })}</div></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow={home.methodEyebrow} title={home.methodTitle} text={home.methodText} /><div className="mt-14 grid gap-8 md:grid-cols-4">{home.steps.map(([number, title, text], index) => <div key={number} className="relative"><div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold bg-gold/10 font-serif text-lg text-navy">{number}</span>{index < home.steps.length - 1 && <span className="hidden h-px flex-1 bg-gold/40 md:block" />}</div><h3 className="mt-6 font-serif text-xl text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></div></section>

        <section className="bg-[#f0eee8] px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionIntro eyebrow={home.toolsEyebrow} title={home.toolsTitle} text={home.toolsText} /><a href={p('/outils-fiscaux')} className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.toolsSeeAll} <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{home.tools.map(([title, text], i) => { const Icon = TOOL_ICONS[i]; return <a key={title} href={p('/outils-fiscaux')} className="group border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold"><Icon className="size-6 text-gold" /><h3 className="mt-8 font-serif text-xl text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><ArrowRight className="mt-6 size-4 text-navy transition-transform group-hover:translate-x-1" /></a> })}</div></div></section>

        <section className="px-6 pb-20 sm:px-10 lg:px-16 lg:pb-28"><div className="mx-auto flex max-w-7xl flex-col gap-5 border border-gold bg-gold/10 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10"><div className="flex items-start gap-4"><CalendarDays className="mt-1 size-7 shrink-0 text-gold" /><div><p className="eyebrow">{home.calendarEyebrow}</p><h2 className="mt-2 font-serif text-2xl text-navy">{home.calendarTitle}</h2><p className="mt-2 text-sm text-muted-foreground">{home.calendarText}</p></div></div><a href={p('/outils-fiscaux#calendrier-fiscal')} className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.calendarCta} <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-6"><SectionIntro eyebrow={home.blogEyebrow} title={home.blogTitle} text={home.blogText} /><a href={p('/blog')} className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold md:inline-flex">{home.blogSeeAll} <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-6 md:grid-cols-3">{home.posts.map(([image, category, title, text, date]) => <article key={title} className="group overflow-hidden border border-border bg-background"><img src={image} alt="" width={800} height={800} loading="lazy" decoding="async" className="h-48 w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" /><div className="p-6"><span className="badge badge-gold">{category}</span><h3 className="mt-5 font-serif text-2xl leading-tight text-navy">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><p className="mt-6 text-xs font-semibold text-navy/50">{date}</p></div></article>)}</div></div></section>

        <section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-4xl"><SectionIntro eyebrow={home.faqEyebrow} title={home.faqTitle} text={home.faqText} /><div className="mt-10 divide-y divide-border border-y border-border">{home.faq.map((item) => <details key={item.q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-serif text-xl text-navy"><span>{item.q}</span><ChevronDown className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180" /></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-muted-foreground">{item.a}</p></details>)}</div><a href={p('/ressources')} className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.faqSeeAll} <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_.8fr]">
            <div>
              <p className="eyebrow flex items-center gap-2"><span className="h-px w-6 bg-gold" aria-hidden="true" />{home.contactEyebrow}</p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight sm:text-5xl">
                {contactTitleLead} <em className="text-gold">{contactTitleLastWord}</em>
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">{home.contactText}</p>

              <div className="mt-10 divide-y divide-white/10 border-t border-white/10">
                <a href="tel:+21698400368" className="group flex items-center gap-4 py-4 hover:text-gold">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20"><Phone className="size-4 text-gold" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">{home.contactInfo.phoneLabel}</span>
                    <span className="block font-semibold text-white group-hover:text-gold">98 400 368</span>
                  </span>
                  <ArrowRight className={cn('size-4 shrink-0 text-white/30 transition-colors group-hover:text-gold', isArabic && 'rtl-mirror')} aria-hidden="true" />
                </a>
                <a href="mailto:camcompta@planet.tn" className="group flex items-center gap-4 py-4 hover:text-gold">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20"><Mail className="size-4 text-gold" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">{home.contactInfo.emailLabel}</span>
                    <span className="block truncate font-semibold text-white group-hover:text-gold">camcompta@planet.tn</span>
                  </span>
                  <ArrowRight className={cn('size-4 shrink-0 text-white/30 transition-colors group-hover:text-gold', isArabic && 'rtl-mirror')} aria-hidden="true" />
                </a>
                <a href="https://www.google.com/maps/search/?api=1&query=21+Rue+Iraq%2C+1001+Lafayette%2C+Tunis" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 py-4 hover:text-gold">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20"><MapPin className="size-4 text-gold" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">{home.contactInfo.addressLabel}</span>
                    <span className="block font-semibold text-white group-hover:text-gold">21 Rue Iraq, 1001 Lafayette, Tunis</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-gold" aria-hidden="true" />
                </a>
                <div className="flex items-center gap-4 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20"><CalendarDays className="size-4 text-gold" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">{home.contactInfo.hoursLabel}</span>
                    <span className="block font-semibold text-white">{home.contactHours}</span>
                  </span>
                  {isOpen !== null && (
                    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase', isOpen ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/20 bg-white/5 text-white/50')}>
                      <span className={cn('size-1.5 shrink-0 rounded-full', isOpen ? 'bg-emerald-400' : 'bg-white/40')} aria-hidden="true" />
                      {isOpen ? footer.openShort : footer.closedShort}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-gold bg-white/[0.03] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-2xl text-white">{home.writeToUs}</h3>
                <p className="shrink-0 pt-1 text-[11px] text-white/45">{home.requiredNote}</p>
              </div>

              <form className="mt-6 flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
                <div>
                  <p className="text-xs font-semibold text-white/70">{home.form.requestType} *</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {home.requestCategories.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setRequestCategory(i)}
                        aria-pressed={requestCategory === i}
                        className={cn('rounded-full border px-3 py-2 text-xs font-semibold transition-colors', requestCategory === i ? 'border-gold bg-gold text-navy' : 'border-white/20 bg-transparent text-white/75 hover:border-gold hover:text-gold')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-white/70">
                    {home.form.name} *
                    <span className="relative mt-1.5 block">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
                      <input required id="contact-nom" name="name" autoComplete="name" placeholder={home.form.namePlaceholder} className="field-input border-white/25 bg-white/10 pl-10 text-white placeholder:text-white/50 focus:border-gold focus:ring-1 focus:ring-gold/40" />
                    </span>
                  </label>
                  <label className="block text-xs font-semibold text-white/70">
                    {home.form.email} *
                    <span className="relative mt-1.5 block">
                      <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
                      <input required type="email" id="contact-email" name="email" autoComplete="email" placeholder={home.form.emailPlaceholder} className="field-input border-white/25 bg-white/10 pl-10 text-white placeholder:text-white/50 focus:border-gold focus:ring-1 focus:ring-gold/40" />
                    </span>
                  </label>
                </div>

                <label className="block text-xs font-semibold text-white/70">
                  {home.form.phone} <span className="font-normal text-white/40">{home.form.phoneHint}</span>
                  <span className="relative mt-1.5 block">
                    <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-white/50">
                      <Smartphone className="size-3.5" aria-hidden="true" /> +216
                    </span>
                    <input type="tel" id="contact-telephone" name="phone" autoComplete="tel" placeholder={home.form.phonePlaceholder} className="field-input border-white/25 bg-white/10 pl-16 text-white placeholder:text-white/50 focus:border-gold focus:ring-1 focus:ring-gold/40" />
                  </span>
                </label>

                <label className="block text-xs font-semibold text-white/70">
                  {home.form.message}
                  <span className="relative mt-1.5 block">
                    <textarea
                      required
                      id="contact-message"
                      name="message"
                      placeholder={home.form.messagePlaceholder}
                      rows={4}
                      maxLength={500}
                      value={contactMessage}
                      onChange={(event) => setContactMessage(event.target.value)}
                      className="field-input resize-y border-white/25 bg-white/10 pb-6 text-white placeholder:text-white/50 focus:border-gold focus:ring-1 focus:ring-gold/40"
                    />
                    <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] tabular-nums text-white/40">{contactMessage.length} / 500</span>
                  </span>
                </label>

                <div>
                  <p className="text-xs font-semibold text-white/70">{home.preferredContactLabel}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['phone', 'email'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPreferredContact(method)}
                        aria-pressed={preferredContact === method}
                        className={cn('flex items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition-colors', preferredContact === method ? 'border-gold text-white' : 'border-white/20 text-white/60 hover:border-white/40')}
                      >
                        <span className={cn('size-2.5 shrink-0 rounded-full border', preferredContact === method ? 'border-gold bg-gold' : 'border-white/40')} aria-hidden="true" />
                        {method === 'phone' ? home.preferredByPhone : home.preferredByEmail}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="group mt-1 inline-flex items-center justify-center gap-3 bg-gold px-6 py-4 text-xs font-bold uppercase tracking-widest text-navy">
                  {sent ? home.form.sent : home.form.send} {sent ? <Check className="size-4" aria-hidden="true" /> : <ArrowRight className={cn('size-4 transition-transform group-hover:translate-x-1', isArabic && 'rtl-mirror')} aria-hidden="true" />}
                </button>

                <p className="flex items-center gap-2 text-[11px] text-white/45"><Lock className="size-3 shrink-0" aria-hidden="true" />{home.confidentialityNote}</p>
              </form>
            </div>
          </div>
        </section>

        <section className="bg-gold px-6 py-14 text-navy sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.2em]">{home.finalEyebrow}</p><h2 className="mt-3 font-serif text-4xl">{home.finalTitle}</h2></div><a href={p('/contact')} className="group inline-flex items-center gap-3 border border-navy px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-navy hover:text-gold">{home.finalCta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a></div></section>
      </main>
      <CamconsultFooter lang={lang} />
    </>
  )
}

function StatRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</span>
      <span className="h-px flex-1 border-b border-dotted border-white/25" aria-hidden="true" />
      <span className="shrink-0 font-serif text-3xl text-gold">{value}</span>
    </div>
  )
}

function SectionIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) { return <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className={`mt-4 font-serif text-4xl leading-tight sm:text-5xl ${light ? 'text-white' : 'text-navy'}`}>{title}</h2><p className={`mt-5 text-base leading-7 ${light ? 'text-white/60' : 'text-muted-foreground'}`}>{text}</p></div> }
