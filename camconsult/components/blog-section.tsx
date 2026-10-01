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
    <section dir={isArabic ? 'rtl' : 'ltr'} className="bg-[#f8f7f4] px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-gold/60" />{home.blogEyebrow}</p>
            <h2 className="mt-3 font-serif text-4xl leading-[1.1] text-navy sm:text-5xl">{lead} <em className="text-gold">{lastWord}</em></h2>
            <p className="mt-3 max-w-md text-sm text-navy/65">{home.blogText}</p>
          </div>
          <a href={blogHref} className="inline-flex shrink-0 items-center gap-2 border border-navy/70 bg-white px-5 py-3 text-[0.7rem] font-bold uppercase tracking-widest text-navy transition-colors hover:border-gold hover:text-gold">
            {home.blogSeeAll} <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {home.posts.map(([image, category, title, text, meta]) => {
            const [date, duration] = meta.split(' · ')
            return (
              <a key={title} href={blogHref} className="group flex flex-col overflow-hidden border border-[#e8e4da] bg-white transition-shadow hover:shadow-[0_14px_40px_rgba(11,37,69,0.1)]">
                <div className="relative">
                  <img src={image} alt="" width={800} height={800} loading="lazy" decoding="async" className="h-44 w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" />
                  <span className="absolute start-3 top-3 bg-gold px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-navy">{category}</span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="flex items-center gap-2 text-[0.7rem] text-navy/50"><span>{date}</span><span aria-hidden="true">•</span><span>{duration} {ui.readSuffix}</span></p>
                  <h3 className="mt-4 font-serif text-2xl leading-tight text-navy">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-navy/65">{text}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-[#efe9dc] pt-4">
                    <span className="mt-4 text-[0.65rem] font-bold uppercase tracking-widest text-navy">{ui.read}</span>
                    <span className="mt-4 grid size-8 place-items-center rounded-full border border-[#e3dccb] text-navy transition-colors group-hover:border-gold group-hover:bg-gold"><ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" /></span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 bg-navy px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-xl">{ui.newsletterTitle}</p>
            <p className="mt-1 text-xs text-[#9db8e6]">{ui.newsletterText}</p>
          </div>
          {subscribed ? (
            <p className="flex items-center gap-2 text-sm font-medium text-gold"><Check className="size-4 shrink-0" aria-hidden="true" />{footer.newsletterSuccess}</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true) }} className="flex w-full items-center gap-2 rounded-full bg-white/[0.08] p-1.5 ps-5 sm:w-auto sm:min-w-[24rem]">
              <input
                type="email"
                required
                dir="ltr"
                placeholder={footer.newsletterPlaceholder}
                aria-label={footer.newsletterPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button type="submit" className="shrink-0 rounded-full bg-gold px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-navy transition-opacity hover:opacity-90">{footer.newsletterCta}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
