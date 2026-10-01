'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

const AUTO_ADVANCE_MS = 10_000

type Home = ReturnType<typeof getDictionary>['home']

function ChatVisual({ ui }: { ui: Home['methodUi'] }) {
  const [msg, reply, title, sub] = ui.chat
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-xs text-navy">
      <p className="ms-auto max-w-[85%] rounded-xl bg-[#c9a45c] px-4 py-3 leading-5 shadow-sm">{msg}</p>
      <p className="max-w-[80%] rounded-xl bg-white px-4 py-3 leading-5 shadow-sm">{reply}</p>
      <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
        <span className="grid w-11 shrink-0 overflow-hidden rounded border border-navy/20 text-center">
          <span className="bg-navy py-0.5 text-[0.5rem] font-bold tracking-wider text-white">RDV</span>
          <Check className="mx-auto my-1 size-4" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-[0.7rem] text-navy/60">{sub}</span>
        </span>
      </div>
    </div>
  )
}

const PRIORITY_STYLES = [
  { width: '90%', bar: 'bg-[#b5532f]', text: 'text-[#b5532f]' },
  { width: '70%', bar: 'bg-[#c9a45c]', text: 'text-[#b8923f]' },
  { width: '45%', bar: 'bg-navy', text: 'text-navy' },
  { width: '35%', bar: 'bg-emerald-700', text: 'text-emerald-700' },
]

function PrioritiesVisual({ ui }: { ui: Home['methodUi'] }) {
  const { title, tag, rows, levels } = ui.priorities
  return (
    <div className="w-full max-w-sm rounded-xl bg-white p-5 text-navy shadow-lg">
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-lg">{title}</p>
        <p className="text-[0.65rem] text-navy/50">{tag}</p>
      </div>
      <div className="mt-4 space-y-3.5">
        {rows.map((row, i) => (
          <div key={row}>
            <div className="flex items-center justify-between text-xs">
              <span>{row}</span>
              <span className={cn('font-semibold', PRIORITY_STYLES[i].text)}>{levels[i]}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-[#ece7da]">
              <div className={cn('h-full rounded-full', PRIORITY_STYLES[i].bar)} style={{ width: PRIORITY_STYLES[i].width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LetterVisual({ ui }: { ui: Home['methodUi'] }) {
  const { brand, title, fields, signed, stamp } = ui.letter
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-md bg-[#c9a45c]" aria-hidden="true" />
      <div className="relative rounded-md bg-[#fbf9f4] p-6 text-navy shadow-lg">
        <p className="text-[0.6rem] font-bold tracking-[0.2em] text-[#b8923f]">{brand}</p>
        <p className="mt-2 font-serif text-xl">{title}</p>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-1 w-full rounded bg-[#e3dccb]" />
          <div className="h-1 w-[90%] rounded bg-[#e3dccb]" />
          <div className="h-1 w-[65%] rounded bg-[#e3dccb]" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {fields.map((field) => (
            <span key={field} className="rounded border border-[#e3dccb] bg-white px-2 py-1.5 text-center text-[0.65rem]">{field}</span>
          ))}
        </div>
        <div className="mt-5 flex items-end justify-between">
          <p className="border-b border-navy/40 pb-0.5 font-serif text-sm italic">{signed}</p>
          <span className="grid size-12 -rotate-12 place-items-center rounded-full border border-[#b8923f] text-[0.5rem] font-bold uppercase tracking-wider text-[#b8923f]">{stamp}</span>
        </div>
      </div>
    </div>
  )
}

const BAR_HEIGHTS = [38, 48, 42, 56, 62, 78]

function MonthlyVisual({ ui }: { ui: Home['methodUi'] }) {
  const { title, example, months, checks } = ui.monthly
  return (
    <div className="w-full max-w-sm rounded-xl bg-white p-5 text-navy shadow-lg">
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-lg">{title}</p>
        <p className="text-[0.65rem] text-[#b8923f] underline underline-offset-2">{example}</p>
      </div>
      <div className="mt-4 flex h-28 items-end gap-2 border-b border-[#ece7da] pb-0">
        {BAR_HEIGHTS.map((h, i) => (
          <span key={i} className={cn('flex-1 rounded-t', i === BAR_HEIGHTS.length - 1 ? 'bg-[#c9a45c]' : 'bg-[#e3dccb]')} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 text-center text-[0.6rem] text-navy/50">
        {months.map((m) => <span key={m} className="flex-1">{m}</span>)}
      </div>
      <ul className="mt-4 space-y-2 text-xs">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span className="grid size-4 place-items-center rounded-full bg-emerald-700 text-white"><Check className="size-2.5" aria-hidden="true" /></span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MethodSection({ lang, home }: { lang: Lang; home: Home }) {
  const isArabic = lang === 'ar'
  const [active, setActive] = useState(0)
  const total = home.steps.length
  const ui = home.methodUi

  // Rotation automatique ; repart de zéro à chaque changement d'étape (clic compris).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % total), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [active, total])

  const go = (index: number) => setActive((index + total) % total)

  const titleWords = home.methodTitle.trim().split(' ')
  const lastWord = titleWords.pop()
  const lead = titleWords.join(' ')
  const [number, stepTitle, stepText] = home.steps[active]
  const visuals = [ChatVisual, PrioritiesVisual, LetterVisual, MonthlyVisual]
  const Visual = visuals[active]
  const PrevIcon = isArabic ? ArrowRight : ArrowLeft
  const NextIcon = isArabic ? ArrowLeft : ArrowRight

  return (
    <section id="methode" className="bg-[#f4f1ea] px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-gold/60" />{home.methodEyebrow}</p>
            <h2 className="mt-3 max-w-xl font-serif text-4xl leading-[1.1] text-navy sm:text-5xl">{lead} <em className="text-gold">{lastWord}</em></h2>
          </div>
          <p className="max-w-xs border-s border-navy/25 ps-4 text-sm leading-6 text-navy/70">{home.methodText}</p>
        </div>

        <ol className="relative mt-10 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          {home.steps.map(([n, title, text], index) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => go(index)}
                aria-current={index === active ? 'step' : undefined}
                className="group block w-full text-start"
              >
                <span className="flex items-center gap-3">
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-full border font-serif text-sm transition-colors', index === active ? 'border-navy bg-navy text-gold' : 'border-gold/60 bg-white text-navy/70 group-hover:border-navy')}>{n}</span>
                  <span className="hidden h-px flex-1 bg-navy/15 lg:block" aria-hidden="true" />
                </span>
                <span className={cn('mt-3 block font-serif text-xl transition-colors', index === active ? 'text-navy' : 'text-navy/55 group-hover:text-navy')}>{title}</span>
                <span className="mt-1 block max-w-[16rem] text-xs leading-5 text-navy/60">{text}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-8 overflow-hidden rounded bg-navy text-white lg:grid lg:grid-cols-[1fr_1fr]">
          <div className="relative p-7 sm:p-10">
            <span className="pointer-events-none absolute end-6 top-2 select-none font-serif text-[8rem] leading-none text-white/[0.06]" aria-hidden="true">{number}</span>
            <div key={active} className="relative animate-fade-up">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold">{ui.stepOf.replace('{n}', number).replace('{total}', String(total).padStart(2, '0'))}</p>
              <h3 className="mt-4 font-serif text-3xl sm:text-4xl">{stepTitle}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-white/75">{stepText}</p>
              <div className="mt-5 border-t border-white/15 pt-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#7f98c8]">{ui.obtain}</p>
                <p className="mt-2 max-w-sm text-sm font-semibold leading-6">{ui.outcomes[active]}</p>
              </div>
            </div>
            <div className="relative mt-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => go(active - 1)} aria-label={ui.prev} className="grid size-10 place-items-center rounded-full border border-white/30 text-white transition-colors hover:border-gold hover:text-gold"><PrevIcon className="size-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => go(active + 1)} aria-label={ui.next} className="grid size-10 place-items-center rounded-full bg-gold text-navy transition-opacity hover:opacity-90"><NextIcon className="size-4" aria-hidden="true" /></button>
              </div>
              <button type="button" onClick={() => go(0)} className="text-[0.7rem] font-bold uppercase tracking-widest text-gold underline underline-offset-4 hover:text-white">{ui.start} →</button>
            </div>
          </div>
          <div className="grid min-h-[17rem] place-items-center bg-white/[0.05] p-7 sm:p-10">
            <div key={active} className="flex w-full justify-center animate-fade-up"><Visual ui={ui} /></div>
          </div>
        </div>
      </div>
    </section>
  )
}
