'use client'

import { useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

export function FaqSection({ lang, home }: { lang: Lang; home: ReturnType<typeof getDictionary>['home'] }) {
  const isArabic = lang === 'ar'
  const [open, setOpen] = useState<number | null>(0)

  const titleWords = home.faqTitle.trim().split(' ')
  const lastWord = titleWords.pop()
  const lead = titleWords.join(' ')

  return (
    <section dir={isArabic ? 'rtl' : 'ltr'} className="bg-muted px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-accent/60" />{home.faqEyebrow}</p>
        <h2 className="mt-3 font-serif text-4xl leading-[1.1] text-foreground sm:text-5xl">{lead} <em className="text-accent-ink">{lastWord}</em></h2>
        <p className="mt-3 text-sm text-muted-foreground">{home.faqText}</p>

        <ul className="mt-8 divide-y divide-border border-y border-t-2 border-b-border border-t-accent/50">
          {home.faq.map((item, i) => {
            const isOpen = open === i
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  className="group flex w-full items-center gap-6 py-5 text-start"
                >
                  <span className="w-5 shrink-0 font-serif text-[0.7rem] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className={cn('flex-1 font-serif text-xl transition-colors sm:text-2xl', isOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{item.q}</span>
                  <ChevronDown className={cn('size-4 shrink-0 text-accent-ink transition-transform duration-300', isOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                <div id={`faq-panel-${i}`} className={cn('grid transition-[grid-template-rows] duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <p className="max-w-xl pb-6 ps-11 text-sm leading-7 text-accent-ink">{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <em className="font-serif text-sm text-muted-foreground">{home.faqUi.notHere}</em>
            <a href="tel:+21698400368" className="font-bold text-foreground hover:text-accent-ink">98 400 368</a>
            <span className="text-accent-ink" aria-hidden="true">•</span>
            <a href="mailto:camcompta@planet.tn" className="font-bold text-foreground hover:text-accent-ink">camcompta@planet.tn</a>
          </p>
          <a href={`/${lang}/ressources`} className="inline-flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-foreground underline-offset-4 hover:text-accent-ink hover:underline">
            {home.faqSeeAll} <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
