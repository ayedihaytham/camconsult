'use client'

import { useEffect, useState } from 'react'
import { getDictionary } from '@/lib/i18n'

type Home = ReturnType<typeof getDictionary>['home']

const DURATION_MS = 1200

/** « 1 200+ » → { target: 1200, sep: ' ', suffix: '+' } : on anime le nombre en
 * gardant le séparateur de milliers et le suffixe de la langue courante. */
function parseValue(value: string) {
  const digits = value.replace(/\D/g, '')
  const sep = value.match(/\d(\D)\d{3}/)?.[1] ?? ''
  const suffix = value.match(/\D+$/)?.[0] ?? ''
  return { target: Number(digits) || 0, sep, suffix }
}

function format(n: number, sep: string) {
  return sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n)
}

function Seal({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 120 120" className="size-24 shrink-0 text-gold" role="img" aria-label={label}>
      <defs>
        <path id="seal-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
      <text fill="currentColor" fontSize="7.5" fontWeight="600">
        <textPath href="#seal-circle" startOffset="0" textLength="270" lengthAdjust="spacing">{label}</textPath>
      </text>
      <text x="60" y="66" textAnchor="middle" fill="currentColor" fontSize="17" className="font-serif">CAM</text>
    </svg>
  )
}

export function BilanCard({ home }: { home: Home }) {
  const b = home.bilan
  const rows = home.stats.slice(0, 3).map((s) => ({ label: s.label, ...parseValue(s.value) }))
  const result = parseValue(home.stats[3].value)
  const [progress, setProgress] = useState(1)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setYear(new Date().getFullYear())
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now()
    setProgress(0)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const shown = (v: { target: number; sep: string; suffix: string }) => `${format(Math.round(v.target * progress), v.sep)}${v.suffix}`

  return (
    <div className="relative">
      <div
        className="relative border border-white/15 bg-[#0f2b52] p-7 shadow-2xl shadow-black/20 lg:mb-4 lg:p-9"
        style={{ clipPath: 'polygon(0 0, calc(100% - 32px) 0, 100% 32px, 100% 100%, 0 100%)' }}
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-white/30 pb-4">
          <h2 className="font-serif text-2xl text-white">{b.title}</h2>
          <p className="shrink-0 pe-6 text-xs tracking-wide text-white/55">{b.exercice.replace('{year}', String(year))}</p>
        </div>

        <div className="flex items-center justify-between border-b border-white/15 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/45">
          <span>{b.post}</span>
          <span>{b.amount}</span>
        </div>

        <ul>
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 border-b border-white/15 py-4">
              <span className="text-sm text-white/90">{row.label}</span>
              <span className="font-serif text-2xl tabular-nums text-gold" dir="ltr">{shown(row)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-4 border-t border-white/60 pt-4">
          <span className="text-sm font-bold text-white">{b.result}</span>
          <span className="border-b-[3px] border-double border-gold font-serif text-4xl tabular-nums leading-none text-gold" dir="ltr">{shown(result)}</span>
        </div>

        <div className="mt-6 flex items-center gap-4 border-t border-dotted border-white/25 pt-6">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg italic leading-snug text-white">« {home.sideQuote} »</p>
            <p className="mt-3 text-xs text-white/55">{b.author}</p>
          </div>
          <Seal label={b.seal} />
        </div>
      </div>
      <span
        className="pointer-events-none absolute right-0 top-0 size-8"
        style={{ background: 'linear-gradient(225deg, transparent 50%, rgba(255,255,255,0.28) 50%)' }}
        aria-hidden="true"
      />
    </div>
  )
}
