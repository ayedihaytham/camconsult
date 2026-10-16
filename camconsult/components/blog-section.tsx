'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

export function BlogSection({ lang, dict }: { lang: Lang; dict: ReturnType<typeof getDictionary> }) {
  const { home, footer } = dict
  const ui = home.blogUi
  const isArabic = lang === 'ar'
  const [subscribed, setSubscribed] = useState(false)
  const blogHref = `/${lang}/blog`

  const titleWords = home.blogTitle.trim().split(' ')
  const lastWord = titleWords.pop()
  const lead = titleWords.join(' ')

  return (
    <section dir={isArabic ? 'rtl' : 'ltr'} className="bg-background px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-accent/60" />{home.blogEyebrow}</p>
            <h2 className="mt-3 font-serif text-4xl leading-[1.1] text-foreground sm:text-5xl">{lead} <em className="text-accent-ink">{lastWord}</em></h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{home.blogText}</p>
          </div>
          <a href={blogHref} className="inline-flex shrink-0 items-center gap-2 border border-foreground/70 bg-card px-5 py-3 text-[0.7rem] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-accent hover:text-accent-ink">
            {home.blogSeeAll} <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {home.posts.map(([image, category, title, text, meta]) => {
            const [date, duration] = meta.split(' · ')
            return (
              <a key={title} href={blogHref} className="group flex flex-col overflow-hidden border border-muted bg-card transition-shadow hover:shadow-hover">
                <div className="relative">
                  <img src={image} alt="" width={800} height={800} loading="lazy" decoding="async" className="h-44 w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" />
                  <span className="absolute start-3 top-3 bg-accent px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-accent-foreground">{category}</span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="flex items-center gap-2 text-[0.7rem] text-muted-foreground"><span>{date}</span><span aria-hidden="true">•</span><span>{duration} {ui.readSuffix}</span></p>
                  <h3 className="mt-4 font-serif text-2xl leading-tight text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-accent-soft pt-4">
                    <span className="mt-4 text-[0.65rem] font-bold uppercase tracking-widest text-foreground">{ui.read}</span>
                    <span className="mt-4 grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-accent-foreground"><ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" /></span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 bg-feature px-6 py-5 text-feature-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-xl">{ui.newsletterTitle}</p>
            <p className="mt-1 text-xs text-feature-muted">{ui.newsletterText}</p>
          </div>
          {subscribed ? (
            <p className="flex items-center gap-2 text-sm font-medium text-accent-ink"><Check className="size-4 shrink-0" aria-hidden="true" />{footer.newsletterSuccess}</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true) }} className="flex w-full items-center gap-2 rounded-full bg-feature-foreground/[0.08] p-1.5 ps-5 shadow-field sm:w-auto sm:min-w-[24rem]">
              <input
                type="email"
                required
                dir="ltr"
                placeholder={footer.newsletterPlaceholder}
                aria-label={footer.newsletterPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-feature-foreground placeholder:text-feature-foreground focus:outline-none"
              />
              <button type="submit" className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-accent-foreground transition-opacity hover:opacity-90">{footer.newsletterCta}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
