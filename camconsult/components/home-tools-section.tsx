'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

type Dict = ReturnType<typeof getDictionary>
const RATES = [19, 13, 7]

function Cell({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="px-4 py-3 first:ps-0">
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#7f98c8]">{label}</p>
      <p className={cn('mt-1.5 font-serif text-xl tabular-nums sm:text-2xl', gold ? 'text-gold' : 'text-white')}>{value}</p>
    </div>
  )
}

function AmountInput({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <label className="mt-5 block">
      <span className="text-[0.65rem] font-semibold text-[#7f98c8]">{label}</span>
      <span className="mt-1.5 flex items-center rounded bg-white/[0.07] px-4">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          dir="ltr"
          className="h-12 min-w-0 flex-1 bg-transparent font-serif text-xl text-white focus:outline-none"
        />
        <span className="text-[0.65rem] font-semibold text-white/60">{unit}</span>
      </span>
    </label>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn('rounded-full px-4 py-1.5 text-xs font-bold transition-colors', active ? 'bg-white text-navy' : 'bg-white/10 text-white/80 hover:bg-white/20')}>
      {children}
    </button>
  )
}

export function HomeToolsSection({ lang, dict }: { lang: Lang; dict: Dict }) {
  const { home, fiscalTools: t } = dict
  const ui = home.toolsUi
  const isArabic = lang === 'ar'
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-US' : 'fr-FR'
  const fmt = (v: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

  const [active, setActive] = useState(0)
  const [mode, setMode] = useState<'ht' | 'ttc'>('ht')
  const [tvaAmount, setTvaAmount] = useState('1000')
  const [rate, setRate] = useState(19)
  const [income, setIncome] = useState('120000')
  const [salary, setSalary] = useState('5000')
  const [statusIndex, setStatusIndex] = useState(0)

  const num = (v: string) => Number(v.replace(',', '.')) || 0
  const amount = num(tvaAmount)
  const ht = mode === 'ht' ? amount : amount / (1 + rate / 100)
  const vat = ht * rate / 100
  const ttc = ht + vat

  // Mêmes tranches indicatives que la page Outils fiscaux : 0 % jusqu'à 50 000, 20 % jusqu'à 100 000, 35 % au-delà.
  const incomeValue = num(income)
  const incomeTax = Math.max(0, Math.min(incomeValue, 100000) - 50000) * 0.2 + Math.max(0, incomeValue - 100000) * 0.35
  const gross = num(salary)

  const status = t.statuts.statuses[statusIndex]
  const titleWords = home.toolsTitle.trim().split(' ')
  const lastWord = titleWords.pop()
  const lead = titleWords.join(' ')
  const unit = ui.currency
  const resultsRow = 'mt-6 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 rtl:divide-x-reverse'

  return (
    <section id="outils" className="scroll-mt-20 bg-[#f0eee8] px-6 py-14 sm:px-10 lg:px-16 lg:py-20" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-gold/60" />{home.toolsEyebrow}</p>
            <h2 className="mt-3 max-w-xl font-serif text-4xl leading-[1.1] text-navy sm:text-5xl">{lead} <em className="text-gold">{lastWord}</em></h2>
          </div>
          <p className="max-w-xs border-s border-gold/60 ps-4 text-sm leading-6 text-navy/70">{home.toolsText}</p>
        </div>

        <div className="mt-8 grid overflow-hidden rounded bg-white shadow-[0_18px_60px_rgba(11,37,69,0.12)] lg:grid-cols-[0.8fr_1.2fr]">
          <ul className="divide-y divide-border">
            {home.tools.map(([name, text], i) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={active === i}
                  className={cn('flex w-full items-center gap-4 border-s-[3px] px-5 py-5 text-start transition-colors', active === i ? 'border-s-gold bg-[#f7f3ea]' : 'border-s-transparent hover:bg-secondary/40')}
                >
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-full font-serif text-xs', active === i ? 'bg-navy text-gold' : 'bg-[#ece7da] text-navy/55')}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg text-navy">{name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-navy/60">{text}</span>
                  </span>
                  <ArrowRight className={cn('size-3.5 shrink-0 text-navy/30', isArabic && 'rtl-mirror')} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div className="bg-navy p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-serif text-2xl sm:text-3xl">{home.tools[active][0]}</h3>
              <span className="rounded-sm bg-gold px-2 py-1 text-[0.55rem] font-bold uppercase tracking-widest text-navy">{ui.live}</span>
            </div>

            {active === 0 && (
              <>
                <div className="mt-5 grid grid-cols-2 overflow-hidden rounded bg-white/[0.07] text-xs font-bold">
                  {(['ht', 'ttc'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cn('py-3 transition-colors', mode === m ? 'bg-gold text-navy' : 'text-white/80 hover:text-white')}>
                      {m === 'ht' ? ui.htToTtc : ui.ttcToHt}
                    </button>
                  ))}
                </div>
                <AmountInput label={mode === 'ht' ? ui.amountHt : ui.amountTtc} value={tvaAmount} onChange={setTvaAmount} unit={unit} />
                <p className="mt-5 text-[0.65rem] font-semibold text-[#7f98c8]">{t.tva.rate}</p>
                <div className="mt-2 flex gap-2">
                  {RATES.map((r) => <Pill key={r} active={rate === r} onClick={() => setRate(r)}>{r} %</Pill>)}
                </div>
                <div className={resultsRow}>
                  <Cell label={ui.resHt} value={fmt(ht)} />
                  <Cell label={ui.resVat.replace('{rate}', String(rate))} value={fmt(vat)} gold />
                  <Cell label={ui.resTtc} value={fmt(ttc)} />
                </div>
              </>
            )}

            {active === 1 && (
              <>
                <AmountInput label={t.is.incomeLabel} value={income} onChange={setIncome} unit={unit} />
                <div className={resultsRow}>
                  <Cell label={ui.taxable} value={fmt(incomeValue)} />
                  <Cell label={t.is.resultTax} value={fmt(incomeTax)} gold />
                  <Cell label={t.is.resultRate} value={`${incomeValue ? (incomeTax / incomeValue * 100).toFixed(1) : '0.0'} %`} />
                </div>
              </>
            )}

            {active === 2 && (
              <>
                <AmountInput label={t.cnss.salaryLabel} value={salary} onChange={setSalary} unit={unit} />
                <div className={resultsRow}>
                  <Cell label={t.cnss.resultEmployee} value={fmt(gross * 0.09)} />
                  <Cell label={t.cnss.resultEmployer} value={fmt(gross * 0.16)} gold />
                  <Cell label={t.cnss.resultCost} value={fmt(gross * 1.16)} />
                </div>
              </>
            )}

            {active === 3 && (
              <>
                <div className="mt-5 flex gap-2">
                  {t.statuts.statuses.map((s, i) => <Pill key={s.name} active={statusIndex === i} onClick={() => setStatusIndex(i)}>{s.name}</Pill>)}
                </div>
                <p className="mt-4 text-sm text-white/70">{status.target}</p>
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded bg-white/10">
                  {[status.capital, status.liability, status.tax, status.governance].map((value, i) => (
                    <div key={i} className="bg-navy px-4 py-3">
                      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#7f98c8]">{t.statuts.rows[i]}</p>
                      <p className="mt-1.5 text-sm font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6">
              <a href={`/${lang}/contact`} className="inline-flex items-center gap-2 rounded-sm bg-gold px-5 py-3 text-xs font-bold uppercase tracking-wider text-navy hover:opacity-90">
                {ui.doubt} <ArrowRight className={cn('size-4', isArabic && 'rtl-mirror')} aria-hidden="true" />
              </a>
            </div>
            <p className="mt-4 text-[0.65rem] leading-5 text-white/50">{ui.note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
