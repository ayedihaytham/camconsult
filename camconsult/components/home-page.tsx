'use client'

import { useState } from 'react'

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
import { BalanceSection } from '@/components/balance-section'
import { HomeToolsSection } from '@/components/home-tools-section'
import { DeadlineSection } from '@/components/deadline-section'
import { BlogSection } from '@/components/blog-section'
import { FaqSection } from '@/components/faq-section'
import { CtaBand } from '@/components/cta-band'
import { BilanCard } from '@/components/bilan-card'
import { MethodSection } from '@/components/method-section'
import { getDictionary, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useOpenNow } from '@/lib/business-hours'


const SERVICE_ICONS = [FileText, BarChart3, Landmark, ShieldCheck, Users, Sparkles, Scale, PieChart]
const TRUST_ICONS = [ShieldCheck, CheckCircle2, Sparkles, FileCheck2]

export default function HomePage({ lang }: { lang: Lang }) {
  const dict = getDictionary(lang)
  const { home, footer } = dict
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

  const servicesIndexed = home.services.map((service, index) => ({ ...service, index }))
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0)
  const selectedService = servicesIndexed[selectedServiceIndex] ?? servicesIndexed[0]
  const servicesTitleWords = home.servicesTitle.trim().split(' ')
  const servicesTitleLastWord = servicesTitleWords.pop()
  const servicesTitleLead = servicesTitleWords.join(' ')

  return (
    <>
      <CamconsultHeader lang={lang} theme="navy" />
      <main>
        <section id="accueil" className="relative overflow-hidden bg-feature px-6 pb-16 pt-10 text-feature-foreground sm:px-10 sm:pt-12 lg:px-16 lg:pb-20 lg:pt-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'var(--hero-grid)',
              backgroundSize: '48px 48px',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto grid max-w-7xl items-start gap-14 lg:grid-cols-[1.1fr_.9fr]">
            <div className="animate-fade-up">
              <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-accent/60" aria-hidden="true" />{home.heroEyebrow}</p>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-[.98] sm:text-7xl lg:text-7xl">
                {home.heroTitlePre && <>{home.heroTitlePre}{' '}</>}
                <span className="relative inline-block">
                  <em className="text-accent-ink">{home.heroTitleHighlight}</em>
                  <svg aria-hidden="true" className="pointer-events-none absolute -bottom-[0.1em] left-0 h-[0.2em] w-full text-accent-ink" viewBox="0 0 200 14" preserveAspectRatio="none">
                    <path d="M2 5 Q100 15 198 3 Q100 8 2 5 Z" fill="currentColor" />
                  </svg>
                </span>{' '}
                {home.heroTitlePost}
              </h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-feature-muted sm:text-lg">{home.heroText}</p>
              <div className="mt-6 flex flex-wrap gap-3"><a href={p('/contact')} className="group inline-flex items-center gap-3 rounded-sm bg-accent px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent-foreground transition-transform duration-300 hover:-translate-y-0.5">{home.ctaPrimary} <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a><a href={p('/services')} className="inline-flex items-center gap-3 rounded-sm border border-feature-input px-6 py-4 text-xs font-bold uppercase tracking-wider text-feature-foreground transition-colors duration-300 hover:border-accent hover:text-accent-ink">{home.ctaSecondary}</a></div>
            </div>
            <BilanCard home={home} />
          </div>
        </section>

        <section className="border-t-[3px] border-foreground/20 bg-muted px-6 sm:px-10 lg:px-16">
          <div className="mx-auto grid max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
            {home.trustBar.map((label, i) => {
              const Icon = TRUST_ICONS[i]
              return (
                <div key={label} className="flex items-center gap-3 border-foreground/10 px-6 py-7 lg:[&:not(:first-child)]:border-l">
                  <Icon className="size-5 shrink-0 text-accent-ink" aria-hidden="true" />
                  <span className="font-serif text-xl leading-tight text-foreground">{label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section id="services" className="px-6 pb-10 pt-5 sm:px-10 lg:px-16 lg:pb-12 lg:pt-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <div>
                <p className="eyebrow">{home.servicesEyebrow}</p>
                <h2 className="mt-2 max-w-2xl font-serif text-3xl leading-tight text-foreground sm:text-4xl">
                  {servicesTitleLead} <em className="text-accent-ink">{servicesTitleLastWord}</em>
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
              <ul className="divide-y divide-border border border-border">
                {servicesIndexed.map((service) => {
                  const active = service.index === selectedService.index
                  return (
                    <li key={service.title}>
                      <button
                        type="button"
                        onClick={() => setSelectedServiceIndex(service.index)}
                        aria-pressed={active}
                        className={cn('flex w-full items-center justify-between gap-4 border-l-4 px-5 py-3 text-left transition-colors', active ? 'border-l-accent bg-accent-soft' : 'border-l-transparent hover:bg-secondary/40')}
                      >
                        <span className="flex min-w-0 items-center gap-4">
                          <span className="shrink-0 font-serif text-sm text-muted-foreground">{String(service.index + 1).padStart(2, '0')}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-serif text-lg text-foreground">{service.title}</span>
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{home.serviceCategories[service.category].tag}</span>
                          </span>
                        </span>
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full border transition-colors', active ? 'border-foreground text-foreground' : 'border-border text-muted-foreground')}>
                          <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="relative overflow-hidden bg-feature p-6 text-feature-foreground lg:p-7">
                <span className="pointer-events-none absolute -right-2 -top-6 select-none font-serif text-[9rem] leading-none text-feature-foreground/5" aria-hidden="true">{String(selectedService.index + 1).padStart(2, '0')}</span>
                {(() => {
                  const Icon = SERVICE_ICONS[selectedService.index]
                  return (
                    <span className="relative grid size-11 place-items-center rounded-full border border-feature-foreground/20">
                      <Icon className="size-5 text-accent-ink" aria-hidden="true" />
                    </span>
                  )
                })()}
                <p className="relative mt-4 text-xs font-bold uppercase tracking-widest text-accent-ink">{home.serviceCategories[selectedService.category].tag}</p>
                <h3 className="relative mt-2 font-serif text-3xl">{selectedService.title}</h3>
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-feature-muted">{selectedService.text}</p>
                <ul className="relative mt-5 flex flex-col gap-2 border-t border-feature-foreground/15 pt-4">
                  {selectedService.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-feature-muted">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-feature-foreground/15 pt-4">
                  <div className="flex flex-wrap items-center gap-5">
                    <a href={p('/services')} className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wider text-accent-foreground">
                      {home.servicesMore} <ArrowRight className={cn('size-4', isArabic && 'rtl-mirror')} aria-hidden="true" />
                    </a>
                    <a href={p('/contact')} className="text-xs font-bold uppercase tracking-widest text-feature-foreground underline underline-offset-4 hover:text-accent-ink">{home.ctaPrimary}</a>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-feature-muted">{String(selectedService.index + 1).padStart(2, '0')} / {String(servicesIndexed.length).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center"><a href={p('/services')} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground hover:text-accent-ink">{home.servicesSeeAll} <ArrowRight className={cn('size-4', isArabic && 'rtl-mirror')} aria-hidden="true" /></a></div>
          </div>
        </section>

        <BalanceSection lang={lang} home={home} />

        <MethodSection lang={lang} home={home} />

        <HomeToolsSection lang={lang} dict={dict} />

        <DeadlineSection lang={lang} home={home} />

        <BlogSection lang={lang} dict={dict} />

        <FaqSection lang={lang} home={home} />

        <section className="bg-feature px-6 py-12 text-feature-foreground sm:px-10 lg:px-16 lg:py-8">
          <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[1fr_.8fr] lg:gap-14">
            <div>
              <div>
              <p className="eyebrow flex items-center gap-2 leading-none"><span className="h-px w-6 bg-accent" aria-hidden="true" />{home.contactEyebrow}</p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight sm:text-5xl">
                {contactTitleLead} <em className="text-accent-ink">{contactTitleLastWord}</em>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-feature-muted">{home.contactText}</p>
              </div>

              <div className="mt-8 divide-y divide-feature-foreground/10 border-t border-feature-foreground/10">
                <a href="tel:+21698400368" className="group flex items-center gap-4 py-4 hover:text-accent-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-feature-foreground/20"><Phone className="size-4 text-accent-ink" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-feature-muted">{home.contactInfo.phoneLabel}</span>
                    <span className="block font-semibold text-feature-foreground group-hover:text-accent-ink">98 400 368</span>
                  </span>
                  <ArrowRight className={cn('size-4 shrink-0 text-feature-muted transition-colors group-hover:text-accent-ink', isArabic && 'rtl-mirror')} aria-hidden="true" />
                </a>
                <a href="mailto:camcompta@planet.tn" className="group flex items-center gap-4 py-4 hover:text-accent-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-feature-foreground/20"><Mail className="size-4 text-accent-ink" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-feature-muted">{home.contactInfo.emailLabel}</span>
                    <span className="block truncate font-semibold text-feature-foreground group-hover:text-accent-ink">camcompta@planet.tn</span>
                  </span>
                  <ArrowRight className={cn('size-4 shrink-0 text-feature-muted transition-colors group-hover:text-accent-ink', isArabic && 'rtl-mirror')} aria-hidden="true" />
                </a>
                <a href="https://www.google.com/maps/search/?api=1&query=21+Rue+Iraq%2C+1001+Lafayette%2C+Tunis" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 py-4 hover:text-accent-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-feature-foreground/20"><MapPin className="size-4 text-accent-ink" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-feature-muted">{home.contactInfo.addressLabel}</span>
                    <span className="block font-semibold text-feature-foreground group-hover:text-accent-ink">21 Rue Iraq, 1001 Lafayette, Tunis</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-feature-muted transition-colors group-hover:text-accent-ink" aria-hidden="true" />
                </a>
                <div className="flex items-center gap-4 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-feature-foreground/20"><CalendarDays className="size-4 text-accent-ink" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-feature-muted">{home.contactInfo.hoursLabel}</span>
                    <span className="block font-semibold text-feature-foreground">{home.contactHours}</span>
                  </span>
                  {isOpen !== null && (
                    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase', isOpen ? 'border-success/30 bg-success/10 text-success' : 'border-feature-foreground/20 bg-feature-foreground/5 text-feature-muted')}>
                      <span className={cn('size-1.5 shrink-0 rounded-full', isOpen ? 'bg-success' : 'bg-feature-foreground/40')} aria-hidden="true" />
                      {isOpen ? footer.openShort : footer.closedShort}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-accent bg-feature-foreground/[0.03] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-2xl text-feature-foreground">{home.writeToUs}</h3>
                <p className="shrink-0 pt-1 text-[11px] text-feature-muted">{home.requiredNote}</p>
              </div>

              <form className="mt-4 flex flex-col gap-3.5" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
                <div>
                  <p className="text-xs font-semibold text-feature-muted">{home.form.requestType} *</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {home.requestCategories.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setRequestCategory(i)}
                        aria-pressed={requestCategory === i}
                        className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', requestCategory === i ? 'border-accent bg-accent text-accent-foreground' : 'border-feature-foreground/20 bg-transparent text-feature-muted hover:border-accent hover:text-accent-ink')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-feature-muted">
                    {home.form.name} *
                    <span className="relative mt-1.5 block">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-feature-muted" aria-hidden="true" />
                      <input required id="contact-nom" name="name" autoComplete="name" placeholder={home.form.namePlaceholder} className="field-input border-feature-input bg-feature-foreground/10 pl-10 text-feature-foreground placeholder:text-feature-foreground focus:border-ring focus:ring-1 focus:ring-accent/40" />
                    </span>
                  </label>
                  <label className="block text-xs font-semibold text-feature-muted">
                    {home.form.email} *
                    <span className="relative mt-1.5 block">
                      <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-feature-muted" aria-hidden="true" />
                      <input required type="email" id="contact-email" name="email" autoComplete="email" placeholder={home.form.emailPlaceholder} className="field-input border-feature-input bg-feature-foreground/10 pl-10 text-feature-foreground placeholder:text-feature-foreground focus:border-ring focus:ring-1 focus:ring-accent/40" />
                    </span>
                  </label>
                </div>

                <label className="block text-xs font-semibold text-feature-muted">
                  {home.form.phone} <span className="font-normal text-feature-muted">{home.form.phoneHint}</span>
                  <span className="relative mt-1.5 block">
                    <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-feature-muted">
                      <Smartphone className="size-3.5" aria-hidden="true" /> +216
                    </span>
                    <input type="tel" id="contact-telephone" name="phone" autoComplete="tel" placeholder={home.form.phonePlaceholder} className="field-input border-feature-input bg-feature-foreground/10 pl-16 text-feature-foreground placeholder:text-feature-foreground focus:border-ring focus:ring-1 focus:ring-accent/40" />
                  </span>
                </label>

                <label className="block text-xs font-semibold text-feature-muted">
                  {home.form.message}
                  <span className="relative mt-1.5 block">
                    <textarea
                      required
                      id="contact-message"
                      name="message"
                      placeholder={home.form.messagePlaceholder}
                      rows={3}
                      maxLength={500}
                      value={contactMessage}
                      onChange={(event) => setContactMessage(event.target.value)}
                      className="field-input resize-y border-feature-input bg-feature-foreground/10 pb-6 text-feature-foreground placeholder:text-feature-foreground focus:border-ring focus:ring-1 focus:ring-accent/40"
                    />
                    <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] tabular-nums text-feature-muted">{contactMessage.length} / 500</span>
                  </span>
                </label>

                <div>
                  <p className="text-xs font-semibold text-feature-muted">{home.preferredContactLabel}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['phone', 'email'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPreferredContact(method)}
                        aria-pressed={preferredContact === method}
                        className={cn('flex items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition-colors', preferredContact === method ? 'border-accent text-feature-foreground' : 'border-feature-foreground/20 text-feature-muted hover:border-feature-foreground/40')}
                      >
                        <span className={cn('size-2.5 shrink-0 rounded-full border', preferredContact === method ? 'border-accent bg-accent' : 'border-feature-foreground/40')} aria-hidden="true" />
                        {method === 'phone' ? home.preferredByPhone : home.preferredByEmail}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="group mt-1 inline-flex items-center justify-center gap-3 bg-accent px-6 py-4 text-xs font-bold uppercase tracking-widest text-accent-foreground">
                  {sent ? home.form.sent : home.form.send} {sent ? <Check className="size-4" aria-hidden="true" /> : <ArrowRight className={cn('size-4 transition-transform group-hover:translate-x-1', isArabic && 'rtl-mirror')} aria-hidden="true" />}
                </button>

                <p className="flex items-center gap-2 text-[11px] text-feature-muted"><Lock className="size-3 shrink-0" aria-hidden="true" />{home.confidentialityNote}</p>
              </form>
            </div>
          </div>
        </section>

        <CtaBand lang={lang} home={home} />
      </main>
      <CamconsultFooter lang={lang} />
    </>
  )
}

function SectionIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) { return <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className={`mt-4 font-serif text-4xl leading-tight sm:text-5xl ${light ? 'text-feature-foreground' : 'text-foreground'}`}>{title}</h2><p className={`mt-5 text-base leading-7 ${light ? 'text-feature-muted' : 'text-muted-foreground'}`}>{text}</p></div> }
