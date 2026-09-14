'use client'

import { use, useState } from 'react'

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PieChart,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'
import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { getDictionary, isLang, type Lang } from '@/lib/i18n'

const SERVICE_ICONS = [FileText, BarChart3, Landmark, ShieldCheck, Users, Sparkles, Scale, PieChart]
const DIFFERENTIATOR_ICONS = [MessageCircle, Landmark, Users, ShieldCheck, BarChart3, Sparkles]
const TOOL_ICONS = [WalletCards, BarChart3, Users, Scale]
const TRUST_ICONS = [ShieldCheck, CheckCircle2, Sparkles, FileCheck2]

export default function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params)
  const lang: Lang = isLang(rawLang) ? rawLang : 'fr'
  const { home } = getDictionary(lang)
  const [sent, setSent] = useState(false)
  const p = (path: string) => `/${lang}${path === '/' ? '' : path}`

  return (
    <>
      <CamconsultHeader lang={lang} theme="navy" />
      <main>
        <section id="accueil" className="relative overflow-hidden bg-navy px-6 pb-20 pt-20 text-white sm:px-10 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="pointer-events-none absolute -right-24 -top-28 size-[30rem] rounded-full border border-gold/20 [background:radial-gradient(circle_at_center,rgba(201,169,106,.14),transparent_65%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
            <div className="animate-fade-up">
              <p className="eyebrow">{home.heroEyebrow}</p>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-[.98] sm:text-7xl lg:text-8xl">{home.heroTitle}</h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-white/65 sm:text-lg">{home.heroText}</p>
              <div className="mt-10 flex flex-wrap gap-3"><a href={p('/contact')} className="group inline-flex items-center gap-3 rounded-sm bg-gold px-6 py-4 text-xs font-bold uppercase tracking-wider text-navy transition-transform duration-300 hover:-translate-y-0.5">{home.ctaPrimary} <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a><a href={p('/services')} className="inline-flex items-center gap-3 rounded-sm border border-white/25 px-6 py-4 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-300 hover:border-gold hover:text-gold">{home.ctaSecondary}</a></div>
            </div>
            <div className="relative min-h-[21rem] border-l border-gold/40 pl-8 lg:mb-4"><div className="absolute -left-3 top-8 grid size-6 place-items-center rounded-full bg-gold text-navy"><Sparkles className="size-3" /></div><p className="max-w-sm font-serif text-3xl leading-tight">{home.sideQuote}</p><div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">{home.stats.map((stat) => <Stat key={stat.label} value={stat.value} label={stat.label} />)}</div></div>
          </div>
        </section>

        <section className="border-b border-border bg-white px-6 py-7 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10px] font-bold uppercase tracking-[.16em] text-navy/45 sm:justify-between">{home.trustBar.map((label, i) => { const Icon = TRUST_ICONS[i]; return <span key={label} className="flex items-center gap-2"><Icon className="size-4" /> {label}</span> })}</div></section>

        <section id="services" className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow={home.servicesEyebrow} title={home.servicesTitle} text={home.servicesText} /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{home.services.map(([title, text], index) => { const Icon = SERVICE_ICONS[index]; return <article key={title} className="group border border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-xl hover:shadow-navy/5"><div className="flex items-center justify-between"><Icon className="size-6 text-gold" /><span className="font-serif text-3xl text-navy/15">0{index + 1}</span></div><h3 className="mt-10 font-serif text-2xl text-navy">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><a href={p('/services')} className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy group-hover:text-gold">{home.servicesMore} <ArrowRight className="size-4" /></a></article> })}</div><div className="mt-10 text-center"><a href={p('/services')} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.servicesSeeAll} <ArrowRight className="size-4" /></a></div></div></section>

        <section className="bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow={home.differenceEyebrow} title={home.differenceTitle} text={home.differenceText} light /><div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">{home.differentiators.map(([title, text], i) => { const Icon = DIFFERENTIATOR_ICONS[i]; return <div key={title} className="bg-navy p-7 transition-colors hover:bg-white/5"><Icon className="size-6 text-gold" /><h3 className="mt-6 font-serif text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div> })}</div></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow={home.methodEyebrow} title={home.methodTitle} text={home.methodText} /><div className="mt-14 grid gap-8 md:grid-cols-4">{home.steps.map(([number, title, text], index) => <div key={number} className="relative"><div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold bg-gold/10 font-serif text-lg text-navy">{number}</span>{index < home.steps.length - 1 && <span className="hidden h-px flex-1 bg-gold/40 md:block" />}</div><h3 className="mt-6 font-serif text-xl text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></div></section>

        <section className="bg-[#f0eee8] px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionIntro eyebrow={home.toolsEyebrow} title={home.toolsTitle} text={home.toolsText} /><a href={p('/outils-fiscaux')} className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.toolsSeeAll} <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{home.tools.map(([title, text], i) => { const Icon = TOOL_ICONS[i]; return <a key={title} href={p('/outils-fiscaux')} className="group border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold"><Icon className="size-6 text-gold" /><h3 className="mt-8 font-serif text-xl text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><ArrowRight className="mt-6 size-4 text-navy transition-transform group-hover:translate-x-1" /></a> })}</div></div></section>

        <section className="px-6 pb-20 sm:px-10 lg:px-16 lg:pb-28"><div className="mx-auto flex max-w-7xl flex-col gap-5 border border-gold bg-gold/10 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10"><div className="flex items-start gap-4"><CalendarDays className="mt-1 size-7 shrink-0 text-gold" /><div><p className="eyebrow">{home.calendarEyebrow}</p><h2 className="mt-2 font-serif text-2xl text-navy">{home.calendarTitle}</h2><p className="mt-2 text-sm text-muted-foreground">{home.calendarText}</p></div></div><a href={p('/outils-fiscaux#calendrier-fiscal')} className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.calendarCta} <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-6"><SectionIntro eyebrow={home.blogEyebrow} title={home.blogTitle} text={home.blogText} /><a href={p('/blog')} className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold md:inline-flex">{home.blogSeeAll} <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-6 md:grid-cols-3">{home.posts.map(([image, category, title, text, date]) => <article key={title} className="group overflow-hidden border border-border bg-background"><img src={image} alt="" className="h-48 w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" /><div className="p-6"><span className="badge badge-gold">{category}</span><h3 className="mt-5 font-serif text-2xl leading-tight text-navy">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><p className="mt-6 text-xs font-semibold text-navy/50">{date}</p></div></article>)}</div></div></section>

        <section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-4xl"><SectionIntro eyebrow={home.faqEyebrow} title={home.faqTitle} text={home.faqText} /><div className="mt-10 divide-y divide-border border-y border-border">{home.faq.map((item) => <details key={item.q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-serif text-xl text-navy"><span>{item.q}</span><ChevronDown className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180" /></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-muted-foreground">{item.a}</p></details>)}</div><a href={p('/ressources')} className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">{home.faqSeeAll} <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_.8fr]"><div><SectionIntro eyebrow={home.contactEyebrow} title={home.contactTitle} text={home.contactText} light /><div className="mt-10 grid gap-4 text-sm text-white/70 sm:grid-cols-2"><a href="tel:+21698400368" className="flex items-center gap-3 hover:text-gold"><Phone className="size-4 text-gold" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="flex items-center gap-3 hover:text-gold"><Mail className="size-4 text-gold" />camcompta@planet.tn</a><span className="flex items-center gap-3"><MapPin className="size-4 text-gold" />21 Rue Iraq, 1001 Lafayette, Tunis</span><span className="flex items-center gap-3"><CalendarDays className="size-4 text-gold" />{home.contactHours}</span></div></div><form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><div className="grid gap-4 sm:grid-cols-2"><input required aria-label={home.form.name} placeholder={home.form.name} className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><input required type="email" aria-label={home.form.email} placeholder={home.form.email} className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /></div><input aria-label={home.form.phone} placeholder={home.form.phone} className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><select aria-label={home.form.requestType} className="field-input border-white/20 bg-white/10 text-white">{home.form.requestTypes.map((option) => <option key={option} className="text-navy">{option}</option>)}</select><textarea required aria-label={home.form.message} placeholder={home.form.message} rows={4} className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><button className="group inline-flex items-center justify-center gap-3 bg-gold px-6 py-4 text-xs font-bold uppercase tracking-widest text-navy">{sent ? home.form.sent : home.form.send} {sent ? <Check className="size-4" /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}</button></form></div></section>

        <section className="bg-gold px-6 py-14 text-navy sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.2em]">{home.finalEyebrow}</p><h2 className="mt-3 font-serif text-4xl">{home.finalTitle}</h2></div><a href={p('/contact')} className="group inline-flex items-center gap-3 border border-navy px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-navy hover:text-gold">{home.finalCta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a></div></section>
      </main>
      <CamconsultFooter lang={lang} />
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="border-t border-white/15 pt-4"><p className="font-serif text-3xl text-gold">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">{label}</p></div> }

function SectionIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) { return <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className={`mt-4 font-serif text-4xl leading-tight sm:text-5xl ${light ? 'text-white' : 'text-navy'}`}>{title}</h2><p className={`mt-5 text-base leading-7 ${light ? 'text-white/60' : 'text-muted-foreground'}`}>{text}</p></div> }
