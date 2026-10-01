'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

type Home = ReturnType<typeof getDictionary>['home']

const DUE_DAY = 28 // déclaration périodique de TVA : le 28 du mois, 23 h 59 (heure de Tunis, UTC+1)

function nextDeadline(now: Date) {
  let due = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), DUE_DAY, 22, 59)
  if (due < now.getTime()) due = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, DUE_DAY, 22, 59)
  return new Date(due)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function DeadlineSection({ lang, home }: { lang: Lang; home: Home }) {
  const isArabic = lang === 'ar'
  const ui = home.deadlineUi
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-US' : 'fr-FR'
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const due = nextDeadline(now ?? new Date())
  // Rien n'est affiché avant le montage : la page est pré-rendue et la date dépend du jour de la visite.
  const dueLabel = (options: Intl.DateTimeFormatOptions) => !now ? '' : new Intl.DateTimeFormat(locale, { ...options, timeZone: 'Africa/Tunis' }).format(due)
  const remaining = now ? Math.max(0, due.getTime() - now.getTime()) : 0
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)

  const [lead, ...rest] = home.calendarTitle.split(':')
  const highlight = rest.join(':').trim()

  function downloadReminder() {
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const day = new Date(due.getTime() - 3_600_000)
    const date = `${day.getUTCFullYear()}${pad(day.getUTCMonth() + 1)}${pad(day.getUTCDate())}`
    const next = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1))
    const dateEnd = `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CAMCONSULT//Calendrier fiscal//FR', 'BEGIN:VEVENT',
      `UID:tva-${date}@camconsult`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${dateEnd}`,
      `SUMMARY:${ui.reminderTitle}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ui.reminderTitle}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'echeance-tva.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section dir={isArabic ? 'rtl' : 'ltr'} className="relative overflow-hidden bg-navy px-6 py-12 text-white sm:px-10 lg:px-16 lg:py-16">
      <span className="pointer-events-none absolute -bottom-10 end-6 select-none font-serif text-[16rem] leading-none text-white/[0.04]" aria-hidden="true">{DUE_DAY}</span>
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[auto_1fr_auto] lg:gap-14">
        <div className="relative mx-auto w-40 shrink-0 lg:mx-0">
          <div className="absolute inset-0 translate-x-2 translate-y-2 rounded bg-[#c9a45c]" aria-hidden="true" />
          <div className="relative overflow-hidden rounded bg-[#fbf9f4] text-navy shadow-lg">
            <p className="bg-navy py-1.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.25em] text-white">{dueLabel({ month: 'long' })}</p>
            <p className="pt-3 text-center font-serif text-6xl leading-none">{dueLabel({ day: 'numeric' }) || DUE_DAY}</p>
            <p className="mt-3 border-t border-[#e3dccb] py-1.5 text-center text-[0.65rem] capitalize text-navy/60">{dueLabel({ weekday: 'long' })}</p>
          </div>
        </div>

        <div>
          <p className="eyebrow flex items-center gap-2"><CalendarDot />{home.calendarEyebrow}</p>
          <h2 className="mt-3 max-w-md font-serif text-3xl leading-tight sm:text-4xl">
            {lead}{highlight && <>: <em className="text-gold">{highlight}</em></>}
          </h2>
          <p className="mt-3 text-sm text-[#9db8e6]">{home.calendarText}</p>
          <div className="mt-6 flex items-center gap-3 text-[0.65rem] font-semibold text-white/70" aria-hidden="true">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-gold" />{ui.today}</span>
            <span className="h-px flex-1 bg-white/25" />
            <span className="flex items-center gap-2 text-white"><span className="size-2.5 rotate-45 bg-white" />{ui.due}</span>
          </div>
        </div>

        <div className="w-full lg:w-72">
          <div className="grid grid-cols-3 divide-x divide-white/15 rounded bg-white/[0.07] py-4 text-center rtl:divide-x-reverse">
            {[[days, ui.days], [hours, ui.hours], [minutes, ui.minutes]].map(([value, label]) => (
              <div key={label}>
                <p className="font-serif text-3xl tabular-nums text-gold">{now ? pad(Number(value)) : '--'}</p>
                <p className="mt-1 text-[0.55rem] font-semibold uppercase tracking-widest text-white/50">{label}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={downloadReminder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm bg-gold px-5 py-3 text-xs font-bold uppercase tracking-wider text-navy hover:opacity-90">
            <Bell className="size-4" aria-hidden="true" /> {ui.remind}
          </button>
          <a href={`/${lang}/outils-fiscaux#calendrier-fiscal`} className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white underline-offset-4 hover:text-gold hover:underline">
            {home.calendarCta} <ArrowRight className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}

function CalendarDot() {
  return <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
}
