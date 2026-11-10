'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Percent, Scale, ShieldCheck, WalletCards } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { getDictionary, type Lang } from '@/lib/i18n'

type ToolId = 'tva' | 'is' | 'cnss' | 'statuts' | 'calendrier'
const TOOL_ICONS: Record<ToolId, typeof Percent> = { tva: Percent, is: Scale, cnss: WalletCards, statuts: ShieldCheck, calendrier: CalendarDays }
const DEADLINE_COLORS = ['a', 'b', 'c', 'a']

export function FiscalToolsPage({ lang = 'fr' }: { lang?: Lang }) {
  const dict = getDictionary(lang)
  const { fiscalTools: t } = dict
  const isArabic = lang === 'ar'
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-US' : 'fr-FR'

  const [activeTool, setActiveTool] = useState<ToolId>('tva')
  const [tvaMode, setTvaMode] = useState<'ht' | 'ttc'>('ht')
  const [tvaAmount, setTvaAmount] = useState('10000')
  const [tvaRate, setTvaRate] = useState('19')
  const [income, setIncome] = useState('120000')
  const [salary, setSalary] = useState('5000')
  const [statusFilter, setStatusFilter] = useState(t.statuts.filters[0])
  const [deadlineFilter, setDeadlineFilter] = useState(t.calendrier.filters[0])

  function formatCurrency(value: number) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(value)
  }

  const amount = Number(tvaAmount) || 0
  const rate = Number(tvaRate) || 0
  const tva = tvaMode === 'ht' ? amount * rate / 100 : amount - amount / (1 + rate / 100)
  const total = tvaMode === 'ht' ? amount + tva : amount
  const incomeValue = Number(income) || 0
  const taxBrackets = [
    { label: t.is.brackets[0], rate: '0%', amount: Math.min(incomeValue, 50000) },
    { label: t.is.brackets[1], rate: '20%', amount: Math.max(0, Math.min(incomeValue - 50000, 50000)) },
    { label: t.is.brackets[2], rate: '35%', amount: Math.max(0, incomeValue - 100000) },
  ]
  const incomeTax = taxBrackets.reduce((sum, bracket) => sum + bracket.amount * Number(bracket.rate.replace('%', '')) / 100, 0)
  const grossSalary = Number(salary) || 0
  const employeeContribution = grossSalary * 0.09
  const employerContribution = grossSalary * 0.16

  const filteredDeadlines = useMemo(
    () => t.calendrier.deadlines
      .map((d, i) => ({ ...d, color: DEADLINE_COLORS[i % DEADLINE_COLORS.length] }))
      .filter((item) => deadlineFilter === t.calendrier.filters[0] || item.type === deadlineFilter),
    [deadlineFilter, t],
  )

  return (
    <PageShell lang={lang}>
      <main className="min-h-screen">
        <PageHero
          lang={lang}
          eyebrow={t.eyebrow}
          title={`${t.titleLine1} ${t.titleLine2}`}
          description={t.description}
          extra={<div className="chips2">{t.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>}
        />
        <section className="ip sheet">
          <div className="ipw">
            <div className="tiles">
              {t.tools.map((tool) => {
                const Icon = TOOL_ICONS[tool.id as ToolId]
                return (
                  <button key={tool.id} type="button" aria-pressed={activeTool === tool.id} onClick={() => setActiveTool(tool.id as ToolId)} className="tile">
                    <span className="ic"><Icon className="size-4" aria-hidden="true" /></span>
                    <span><b>{tool.label}</b><small>{tool.description}</small></span>
                  </button>
                )
              })}
            </div>
            <div className="panel" id={activeTool === 'calendrier' ? 'calendrier-fiscal' : undefined}>
              {activeTool === 'tva' && (
                <div>
                  <ToolHeading icon={Percent} eyebrow={t.tva.eyebrow} title={t.tva.title} description={t.tva.description} />
                  <div className="cols">
                    <div className="f">
                      <Field label={t.tva.mode}>
                        <div className="seg2">
                          <button type="button" aria-pressed={tvaMode === 'ht'} onClick={() => setTvaMode('ht')}>{t.tva.amountHt}</button>
                          <button type="button" aria-pressed={tvaMode === 'ttc'} onClick={() => setTvaMode('ttc')}>{t.tva.amountTtc}</button>
                        </div>
                      </Field>
                      <Field label={`${t.tva.amountLabel} ${tvaMode.toUpperCase()}`}><input type="number" min="0" value={tvaAmount} onChange={(e) => setTvaAmount(e.target.value)} /></Field>
                      <Field label={t.tva.rate}>
                        <select value={tvaRate} onChange={(e) => setTvaRate(e.target.value)}><option value="7">7 %</option><option value="13">13 %</option><option value="19">19 %</option></select>
                      </Field>
                    </div>
                    <ResultPanel items={[[t.tva.resultVat, formatCurrency(tva)], [tvaMode === 'ht' ? t.tva.resultTtc : t.tva.resultHt, formatCurrency(total - (tvaMode === 'ttc' ? tva : 0))]]} />
                  </div>
                </div>
              )}
              {activeTool === 'is' && (
                <div>
                  <ToolHeading icon={Scale} eyebrow={t.is.eyebrow} title={t.is.title} description={t.is.description} />
                  <div className="cols">
                    <div className="f"><Field label={t.is.incomeLabel}><input type="number" min="0" value={income} onChange={(e) => setIncome(e.target.value)} /></Field></div>
                    <ResultPanel items={[[t.is.resultTax, formatCurrency(incomeTax)], [t.is.resultRate, incomeValue ? `${(incomeTax / incomeValue * 100).toFixed(1)} %` : '0 %']]} />
                  </div>
                  <div className="tbl">
                    <div className="h">{t.is.bracketHeader.map((h) => <span key={h}>{h}</span>)}</div>
                    {taxBrackets.map((bracket) => <div key={bracket.label} className="r"><span>{bracket.label}</span><b>{bracket.rate}</b><span>{formatCurrency(bracket.amount)}</span></div>)}
                  </div>
                </div>
              )}
              {activeTool === 'cnss' && (
                <div>
                  <ToolHeading icon={WalletCards} eyebrow={t.cnss.eyebrow} title={t.cnss.title} description={t.cnss.description} />
                  <div className="cols">
                    <div className="f"><Field label={t.cnss.salaryLabel}><input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} /></Field></div>
                    <ResultPanel items={[[t.cnss.resultEmployee, formatCurrency(employeeContribution)], [t.cnss.resultEmployer, formatCurrency(employerContribution)], [t.cnss.resultCost, formatCurrency(grossSalary + employerContribution)]]} />
                  </div>
                </div>
              )}
              {activeTool === 'statuts' && <StatusTool t={t} filter={statusFilter} setFilter={setStatusFilter} />}
              {activeTool === 'calendrier' && <CalendarTool t={t} filter={deadlineFilter} setFilter={setDeadlineFilter} deadlines={filteredDeadlines} />}
              <p className="disc2">{t.disclaimer}</p>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}

function ToolHeading({ icon: Icon, eyebrow, title, description }: { icon: typeof Percent; eyebrow: string; title: string; description: string }) {
  return (
    <div className="hd">
      <span className="ic"><Icon className="size-5" aria-hidden="true" /></span>
      <div><p className="eb">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label> }
function ResultPanel({ items }: { items: string[][] }) {
  return <div className="res">{items.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
}

function StatusTool({ t, filter, setFilter }: { t: ReturnType<typeof getDictionary>['fiscalTools']; filter: string; setFilter: (value: string) => void }) {
  const { statuts } = t
  const visible = filter === statuts.filters[0] ? statuts.statuses : statuts.statuses.filter((status) => status.name === filter)
  return (
    <div>
      <ToolHeading icon={ShieldCheck} eyebrow={statuts.eyebrow} title={statuts.title} description={statuts.description} />
      <div className="chp" style={{ marginTop: 28 }}>{statuts.filters.map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div>
      <div className="ip-grid c3" style={{ marginTop: 22 }}>
        {visible.map((status) => (
          <div key={status.name} className="stc">
            <div className="t"><b>{status.name}</b><span>{status.target}</span></div>
            <CompareRow label={statuts.rows[0]} value={status.capital} />
            <CompareRow label={statuts.rows[1]} value={status.liability} />
            <CompareRow label={statuts.rows[2]} value={status.tax} />
            <CompareRow label={statuts.rows[3]} value={status.governance} />
          </div>
        ))}
      </div>
    </div>
  )
}
function CompareRow({ label, value }: { label: string; value: string }) { return <div className="rw"><span>{label}</span><b>{value}</b></div> }

function CalendarTool({ t, filter, setFilter, deadlines }: { t: ReturnType<typeof getDictionary>['fiscalTools']; filter: string; setFilter: (value: string) => void; deadlines: { month: string; date: string; type: string; title: string; color: string }[] }) {
  const { calendrier } = t
  return (
    <div>
      <ToolHeading icon={CalendarDays} eyebrow={calendrier.eyebrow} title={calendrier.title} description={calendrier.description} />
      <div className="chp" style={{ marginTop: 28 }}>{calendrier.filters.map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div>
      <div className="ip-grid c2" style={{ marginTop: 22 }}>
        {deadlines.map((item) => (
          <div key={item.title} className="cal">
            <div className="dt"><small>{item.month}</small><b>{item.date}</b></div>
            <div><span className="tg2">{item.type}</span><h3>{item.title}</h3></div>
          </div>
        ))}
      </div>
    </div>
  )
}
