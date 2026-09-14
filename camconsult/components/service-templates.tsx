'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronDown,
  FileText,
  Lightbulb,
  LineChart,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getDictionary, type Lang } from '@/lib/i18n'

function Breadcrumb({ home, current }: { home: string; current: string }) {
  return <div className="flex items-center gap-2 text-xs text-white/55"><span>{home}</span><span>/</span><span className="text-gold">{current}</span></div>
}

function TemplateHero({ home, eyebrow, title, description }: { home: string; eyebrow: string; title: string; description: string }) {
  return <section className="bg-navy px-6 pb-14 pt-28 text-white sm:px-10 lg:px-16"><div className="mx-auto max-w-7xl"><Breadcrumb home={home} current={title} /><p className="eyebrow mt-12">{eyebrow}</p><h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[1.05] sm:text-7xl">{title}</h1><p className="mt-7 max-w-2xl text-base leading-7 text-white/65">{description}</p></div></section>
}

export function ServicesTemplate({ lang = 'fr' }: { lang?: Lang }) {
  const { services } = getDictionary(lang)
  const isArabic = lang === 'ar'
  const Arrow = isArabic ? ArrowLeft : ArrowRight
  return <div dir={isArabic ? 'rtl' : 'ltr'}><TemplateHero home={services.breadcrumbHome} eyebrow={services.eyebrow} title={services.title} description={services.description} /><section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{services.list.map((item, index) => { const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length]; return <article key={item.key} className="group flex min-h-[285px] flex-col rounded-sm border border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-xl hover:shadow-navy/5"><div className="flex items-start justify-between"><Icon className="size-7 text-gold" aria-hidden="true" /><span className="badge border border-gold/40 text-[9px] text-navy">{item.audience}</span></div><h2 className="mt-10 font-serif text-2xl text-navy">{item.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p><a href={`/${lang}/services/revision`} className="mt-auto inline-flex items-center gap-2 pt-7 text-[11px] font-bold uppercase tracking-[0.14em] text-navy transition-colors group-hover:text-gold">{services.seeDetail} <Arrow className="transition-transform group-hover:translate-x-1 rtl-mirror" data-icon="inline-end" /></a></article> })}</div></div></section></div>
}

export function ServiceDetailTemplate({ lang = 'fr', serviceTitle }: { lang?: Lang; serviceTitle?: string }) {
  const { services } = getDictionary(lang)
  const { detail } = services
  const isArabic = lang === 'ar'
  const [openFaq, setOpenFaq] = useState(0)
  const Arrow = isArabic ? ArrowLeft : ArrowRight
  const title = serviceTitle ?? detail.revisionTitle
  return <div id="detail" dir={isArabic ? 'rtl' : 'ltr'}><TemplateHero home={services.breadcrumbHome} eyebrow={detail.eyebrow} title={title} description={detail.description} /><div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 sm:px-10 lg:grid-cols-[1fr_340px] lg:gap-20 lg:px-16 lg:py-28"><div><section><p className="eyebrow">{detail.descriptionEyebrow}</p><h2 className="mt-4 font-serif text-4xl text-navy">{detail.descriptionTitle}</h2><div className="mt-7 max-w-2xl space-y-4 text-sm leading-7 text-muted-foreground">{detail.descriptionBody.map((p) => <p key={p}>{p}</p>)}</div></section><section className="mt-20"><p className="eyebrow">{detail.audienceEyebrow}</p><h2 className="mt-4 font-serif text-3xl text-navy">{detail.audienceTitle}</h2><ul className="mt-7 grid gap-4 sm:grid-cols-2">{detail.audience.map((item) => <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground"><Check className="size-4 shrink-0 text-gold" />{item}</li>)}</ul></section><section className="mt-20"><p className="eyebrow">{detail.deliverablesEyebrow}</p><h2 className="mt-4 font-serif text-3xl text-navy">{detail.deliverablesTitle}</h2><div className="mt-7 grid gap-4 sm:grid-cols-2">{detail.deliverables.map((item) => <div key={item} className="flex items-start gap-4 rounded-sm border border-border bg-white p-5"><FileText className="size-5 shrink-0 text-gold" /><span className="text-sm leading-6 text-navy">{item}</span></div>)}</div></section><section className="mt-20"><p className="eyebrow">FAQ</p><div className="mt-5 divide-y divide-border border-y border-border">{detail.faq.map((item, index) => <div key={item.q}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex w-full items-center justify-between gap-6 py-5 text-start font-semibold text-navy"><span>{item.q}</span><ChevronDown className={cn('size-5 shrink-0 text-gold transition-transform', openFaq === index && 'rotate-180')} /></button>{openFaq === index && <p className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground">{item.a}</p>}</div>)}</div></section></div><aside className="h-fit lg:sticky lg:top-28"><div className="rounded-sm bg-navy p-7 text-white"><p className="eyebrow">{detail.sidebarEyebrow}</p><h2 className="mt-4 font-serif text-3xl">{detail.sidebarTitle}</h2><p className="mt-4 text-sm leading-6 text-white/60">{detail.sidebarText}</p><Button className="group mt-7 w-full justify-between">{detail.sidebarCta} <Arrow className="transition-transform group-hover:translate-x-1 rtl-mirror" data-icon="inline-end" /></Button><div className="mt-8 border-t border-white/15 pt-6 text-sm leading-7 text-white/65"><p>+216 71 847 608</p><p>camcompta@planet.tn</p><p>Tunis</p></div></div>{title === detail.revisionTitle && <div className="mt-4 border border-gold/60 bg-[#f2eadb] p-6"><div className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-navy" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-navy">{detail.legalScopeLabel}</p><p className="mt-3 text-sm leading-6 text-navy/70">{detail.legalScopeText}</p></div></div></div>}</aside></div></div>
}

const SERVICE_ICONS = [Calculator, Lightbulb, ShieldCheck, Scale, Users, BriefcaseBusiness, Sparkles, LineChart]
