'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, FileText, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

type LegalKey = 'mentions' | 'privacy' | 'terms' | 'cookies'

export function LegalPages({ lang = 'fr', initialPage = 'mentions' }: { lang?: Lang; initialPage?: LegalKey }) {
  const { legal } = getDictionary(lang)
  const [active, setActive] = useState<LegalKey>(initialPage)
  const page = useMemo(() => legal.pages[active], [active, legal])
  const rtl = lang === 'ar'
  return <main dir={rtl ? 'rtl' : 'ltr'} className="bg-background text-foreground">
    <section className="bg-navy px-6 pb-16 pt-28 text-white sm:px-10 lg:px-16"><div className="mx-auto max-w-7xl"><div className="flex items-center gap-2 text-xs text-white/50"><span>{legal.breadcrumbHome}</span><span>/</span><span className="text-gold">{page.title}</span></div><p className="eyebrow mt-12">{page.label}</p><h1 className="mt-4 max-w-3xl font-serif text-5xl leading-none sm:text-7xl">{page.title}</h1><p className="mt-6 text-sm text-white/65">{legal.updatedLabel} : {page.updated}</p></div></section>
    <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[250px_minmax(0,720px)] lg:gap-20 lg:px-16 lg:py-24">
      <aside className="lg:sticky lg:top-28 lg:self-start"><p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{legal.tocLabel}</p><nav aria-label={legal.tocLabel} className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">{page.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="group inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs text-navy/65 transition-colors hover:border-gold hover:text-navy lg:border-0 lg:px-0"><span className="text-gold">0{index + 1}</span>{section.title}<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl-mirror" /></a>)}</nav><div className="mt-8 hidden border-t border-border pt-6 text-xs leading-5 text-muted-foreground lg:block"><ShieldCheck className="mb-3 size-5 text-gold" />{legal.tocNote}</div></aside>
      <article className="max-w-[720px]"><div className="mb-12 border-b border-border pb-10"><FileText className="size-7 text-gold" /><p className="mt-6 text-lg leading-8 text-muted-foreground">{page.intro}</p></div>{page.sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-border py-10 first:pt-0 last:border-0"><h2 className="font-serif text-3xl text-navy">{section.title}</h2><div className="mt-5 flex flex-col gap-4 text-sm leading-7 text-muted-foreground">{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>)}</article>
    </div>
    <div className="border-y border-border bg-white px-6 py-5 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap gap-2">{legal.nav.map((item) => <button key={item.key} type="button" onClick={() => setActive(item.key as LegalKey)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-200', active === item.key ? 'border-gold bg-gold text-navy' : 'border-border text-navy/60 hover:border-gold hover:text-navy')}>{item.label}</button>)}</div></div>
  </main>
}

export type { LegalKey }
