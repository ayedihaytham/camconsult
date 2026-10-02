import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

export function CtaBand({ lang, home }: { lang: Lang; home: ReturnType<typeof getDictionary>['home'] }) {
  const isArabic = lang === 'ar'
  const c = home.ctaBand
  return (
    <section dir={isArabic ? 'rtl' : 'ltr'} className="bg-gold px-6 py-14 text-navy sm:px-10 lg:px-16 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <p className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em]">
          <span className="hidden h-px w-12 bg-navy sm:block" aria-hidden="true" />
          {c.eyebrow}
        </p>
        <h2 className="mt-5 font-serif text-5xl leading-[1.05] sm:text-6xl">
          {c.titleLine1}<br />{c.titleLine2} <em>{c.titleHighlight}</em>
        </h2>
        <p className="mt-6 max-w-xl font-serif text-lg leading-8 text-navy/90">{c.text}</p>

        <a
          href={`/${lang}/contact`}
          className="group relative mt-8 inline-flex items-center gap-4 overflow-hidden border border-navy px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-navy transition-colors duration-300 hover:text-gold motion-reduce:transition-none"
        >
          <span className="absolute inset-0 origin-left scale-x-0 bg-navy transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none" aria-hidden="true" />
          <span className="relative">{c.button}</span>
          <ArrowRight className={cn('relative size-5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none', isArabic && 'rtl-mirror group-hover:-translate-x-1 group-hover:translate-x-0')} aria-hidden="true" />
        </a>

        <p className="mt-6 text-sm font-medium">
          {c.callPrefix}{' '}
          <a href="tel:+21698400368" dir="ltr" className="border-b border-navy/60 hover:border-navy">+216 98 400 368</a>
        </p>
        <p className="mt-1 text-sm font-medium">{c.response}</p>
      </div>
    </section>
  )
}
