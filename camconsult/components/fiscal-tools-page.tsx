'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronDown, FileText, Percent, Scale, ShieldCheck, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToolId = 'tva' | 'is' | 'cnss' | 'statuts' | 'calendrier'

const tools = [
  { id: 'tva' as const, label: 'TVA', icon: Percent, description: 'Convertissez un montant HT ou TTC selon le taux applicable.' },
  { id: 'is' as const, label: 'IS / IRPP', icon: Scale, description: 'Obtenez une simulation indicative par tranches.' },
  { id: 'cnss' as const, label: 'CNSS', icon: WalletCards, description: 'Estimez les cotisations salariales et patronales.' },
  { id: 'statuts' as const, label: 'Statuts', icon: ShieldCheck, description: 'Comparez les formes juridiques les plus courantes.' },
  { id: 'calendrier' as const, label: 'Calendrier fiscal', icon: CalendarDays, description: 'Repérez les prochaines échéances fiscales.' },
]

type Deadline = { month: string; date: string; type: string; title: string; color: string }

const deadlines: Deadline[] = [
  { month: 'Jan', date: '15', type: 'TVA', title: 'Déclaration et paiement de la TVA', color: 'bg-gold' },
  { month: 'Mar', date: '31', type: 'IS', title: 'Acompte provisionnel IS', color: 'bg-navy' },
  { month: 'Avr', date: '30', type: 'CNSS', title: 'Déclaration des salaires', color: 'bg-[#8c9bab]' },
  { month: 'Juin', date: '15', type: 'IRPP', title: 'Déclaration annuelle de revenus', color: 'bg-gold' },
]

export function FiscalToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId>('tva')
  const [tvaMode, setTvaMode] = useState<'ht' | 'ttc'>('ht')
  const [tvaAmount, setTvaAmount] = useState('10000')
  const [tvaRate, setTvaRate] = useState('19')
  const [income, setIncome] = useState('120000')
  const [salary, setSalary] = useState('5000')
  const [statusFilter, setStatusFilter] = useState('Tous')
  const [deadlineFilter, setDeadlineFilter] = useState('Tous')

  const amount = Number(tvaAmount) || 0
  const rate = Number(tvaRate) || 0
  const tva = tvaMode === 'ht' ? amount * rate / 100 : amount - amount / (1 + rate / 100)
  const total = tvaMode === 'ht' ? amount + tva : amount
  const incomeValue = Number(income) || 0
  const taxBrackets = [{ label: 'Tranche exonérée', rate: '0%', amount: Math.min(incomeValue, 50000) }, { label: 'Tranche intermédiaire', rate: '20%', amount: Math.max(0, Math.min(incomeValue - 50000, 50000)) }, { label: 'Tranche supérieure', rate: '35%', amount: Math.max(0, incomeValue - 100000) }]
  const incomeTax = taxBrackets.reduce((sum, bracket) => sum + bracket.amount * Number(bracket.rate.replace('%', '')) / 100, 0)
  const grossSalary = Number(salary) || 0
  const employeeContribution = grossSalary * 0.09
  const employerContribution = grossSalary * 0.16

  const filteredDeadlines = useMemo(() => deadlineFilter === 'Tous' ? deadlines : deadlines.filter((item) => item.type === deadlineFilter), [deadlineFilter])

  return <main dir="ltr" className="min-h-screen bg-[#F8F7F4] text-[#1A1A1A]">
    <section className="bg-navy px-6 pb-20 pt-32 text-white sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <p className="eyebrow">CAMCONSULT · Outils pratiques</p>
        <div className="mt-6 max-w-3xl"><h1 className="font-serif text-5xl leading-[0.98] tracking-tight sm:text-7xl">Vos repères fiscaux,<br /><span className="text-gold">en toute clarté.</span></h1><p className="mt-6 max-w-xl text-base leading-8 text-white/65">Des simulateurs simples pour éclairer vos décisions. Les calculs sont effectués localement, directement dans votre navigateur.</p></div>
        <div className="mt-12 flex flex-wrap gap-2"><span className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70">5 outils interactifs</span><span className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70">Résultats instantanés</span><span className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70">FR · AR · RTL-ready</span></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
      <div className="grid gap-3 md:grid-cols-5">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={cn('group flex items-center gap-3 rounded-sm border p-4 text-left transition-all duration-300 hover:-translate-y-0.5', activeTool === tool.id ? 'border-gold bg-navy text-white shadow-lg shadow-navy/10' : 'border-[#E3E0D9] bg-white text-navy')}><span className={cn('grid size-10 shrink-0 place-items-center rounded-full', activeTool === tool.id ? 'bg-gold text-navy' : 'bg-[#F0EFEC] text-gold')}><Icon className="size-4" /></span><span><span className="block text-sm font-semibold">{tool.label}</span><span className={cn('mt-1 block text-[10px] leading-4', activeTool === tool.id ? 'text-white/55' : 'text-[#667080]')}>{tool.description}</span></span></button> })}</div>
      <div className="mt-8 rounded-sm border border-[#E3E0D9] bg-white p-6 shadow-[0_18px_60px_rgba(11,37,69,0.05)] sm:p-10">
        {activeTool === 'tva' && <div><ToolHeading icon={Percent} eyebrow="Simulation TVA" title="Calculateur de TVA" description="Calculez rapidement le montant de TVA et le total à payer." /><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]"><div className="grid gap-5 sm:grid-cols-2"><Field label="Mode de calcul"><div className="flex rounded-sm border border-[#D8D5CE] p-1"><button onClick={() => setTvaMode('ht')} className={cn('flex-1 rounded-sm px-3 py-2 text-xs font-semibold', tvaMode === 'ht' && 'bg-gold text-navy')}>Montant HT</button><button onClick={() => setTvaMode('ttc')} className={cn('flex-1 rounded-sm px-3 py-2 text-xs font-semibold', tvaMode === 'ttc' && 'bg-gold text-navy')}>Montant TTC</button></div></Field><Field label={`Montant ${tvaMode.toUpperCase()}`}><input className="field-input" type="number" min="0" value={tvaAmount} onChange={(e) => setTvaAmount(e.target.value)} /></Field><Field label="Taux de TVA"><select className="field-input" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)}><option value="7">7 %</option><option value="13">13 %</option><option value="19">19 %</option></select></Field></div><ResultPanel items={[['Montant de TVA', formatCurrency(tva)], [tvaMode === 'ht' ? 'Total TTC' : 'Montant HT', formatCurrency(total - (tvaMode === 'ttc' ? tva : 0))]]} /></div></div>}
        {activeTool === 'is' && <div><ToolHeading icon={Scale} eyebrow="Simulation indicative" title="Calculateur IS / IRPP" description="Visualisez une estimation progressive à partir du revenu annuel imposable." /><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]"><Field label="Revenu ou bénéfice annuel"><input className="field-input" type="number" min="0" value={income} onChange={(e) => setIncome(e.target.value)} /></Field><ResultPanel items={[["Impôt estimé", formatCurrency(incomeTax)], ['Taux moyen', incomeValue ? `${(incomeTax / incomeValue * 100).toFixed(1)} %` : '0 %']]} /></div><div className="mt-8 overflow-hidden rounded-sm border border-[#E3E0D9]"><div className="grid grid-cols-3 bg-navy px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/70"><span>Tranche</span><span>Taux</span><span>Base taxable</span></div>{taxBrackets.map((bracket) => <div key={bracket.label} className="grid grid-cols-3 border-t border-[#E3E0D9] px-4 py-3 text-xs"><span>{bracket.label}</span><span className="text-gold">{bracket.rate}</span><span>{formatCurrency(bracket.amount)}</span></div>)}</div></div>}
        {activeTool === 'cnss' && <div><ToolHeading icon={WalletCards} eyebrow="Simulation indicative" title="Simulateur de charges CNSS" description="Une lecture rapide des cotisations estimées à partir du salaire brut." /><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]"><Field label="Salaire brut mensuel"><input className="field-input" type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} /></Field><ResultPanel items={[["Cotisation salariale estimée", formatCurrency(employeeContribution)], ['Cotisation patronale estimée', formatCurrency(employerContribution)], ['Coût employeur estimé', formatCurrency(grossSalary + employerContribution)]]} /></div></div>}
        {activeTool === 'statuts' && <StatusTool filter={statusFilter} setFilter={setStatusFilter} />}
        {activeTool === 'calendrier' && <CalendarTool filter={deadlineFilter} setFilter={setDeadlineFilter} deadlines={filteredDeadlines} />}
        <p className="mt-10 border-t border-[#E3E0D9] pt-4 text-[11px] text-[#667080]">Résultats indicatifs, calculs effectués localement dans votre navigateur. Ils ne constituent pas un avis fiscal ou juridique.</p>
      </div>
    </section>
  </main>
}

function ToolHeading({ icon: Icon, eyebrow, title, description }: { icon: typeof Percent, eyebrow: string, title: string, description: string }) { return <div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><Icon className="size-5" /></span><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">{title}</h2><p className="mt-2 text-sm text-[#667080]">{description}</p></div></div> }
function Field({ label, children }: { label: string, children: React.ReactNode }) { return <label className="field-label"><span>{label}</span>{children}</label> }
function ResultPanel({ items }: { items: string[][] }) { return <div className="rounded-sm border border-gold/35 bg-[#FBF4E6] p-6">{items.map(([label, value], index) => <div key={label} className={cn('flex items-end justify-between gap-4', index > 0 && 'mt-5 border-t border-gold/20 pt-5')}><span className="text-xs text-navy/65">{label}</span><strong className="font-serif text-2xl text-navy">{value}</strong></div>)}</div> }
function StatusTool({ filter, setFilter }: { filter: string, setFilter: (value: string) => void }) { const statuses = [{ name: 'SUARL', target: 'Entrepreneur individuel', capital: 'Selon la forme choisie', liability: 'Limitée aux apports', tax: 'IS / régime applicable', governance: 'Gérant unique' }, { name: 'SARL', target: 'PME et associés', capital: 'Selon la forme choisie', liability: 'Limitée aux apports', tax: 'IS / régime applicable', governance: 'Gérance' }, { name: 'SA', target: 'Structures importantes', capital: 'Selon les seuils légaux', liability: 'Limitée aux apports', tax: 'IS / régime applicable', governance: 'Conseil / direction' }]; const visible = filter === 'Tous' ? statuses : statuses.filter((status) => status.name === filter); return <div><ToolHeading icon={ShieldCheck} eyebrow="Comparatif" title="Quel statut juridique choisir ?" description="Filtrez les options et comparez les critères essentiels." /><div className="mt-8 flex flex-wrap gap-2">{['Tous', 'SUARL', 'SARL', 'SA'].map((option) => <button key={option} onClick={() => setFilter(option)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors', filter === option ? 'border-gold bg-gold text-navy' : 'border-[#D8D5CE] text-navy hover:border-gold')}>{option}</button>)}</div><div className="mt-6 grid gap-4 lg:grid-cols-3">{visible.map((status) => <div key={status.name} className="overflow-hidden rounded-sm border border-[#E3E0D9]"><div className="bg-navy px-5 py-4 text-white"><span className="font-serif text-2xl">{status.name}</span><span className="mt-1 block text-[10px] text-white/55">{status.target}</span></div><div className="flex flex-col gap-4 p-5 text-xs"><CompareRow label="Capital minimum" value={status.capital} /><CompareRow label="Responsabilité" value={status.liability} /><CompareRow label="Fiscalité" value={status.tax} /><CompareRow label="Gouvernance" value={status.governance} /></div></div>)}</div></div> }
function CompareRow({ label, value }: { label: string, value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-[#E3E0D9] pb-3 last:border-0 last:pb-0"><span className="text-[#667080]">{label}</span><strong className="text-right font-medium text-navy">{value}</strong></div> }
function CalendarTool({ filter, setFilter, deadlines }: { filter: string, setFilter: (value: string) => void, deadlines: Deadline[] }) { return <div><ToolHeading icon={CalendarDays} eyebrow="Échéances" title="Calendrier fiscal" description="Une timeline claire pour anticiper vos principales obligations." /><div className="mt-8 flex flex-wrap gap-2">{['Tous', 'TVA', 'IS', 'CNSS', 'IRPP'].map((option) => <button key={option} onClick={() => setFilter(option)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors', filter === option ? 'border-gold bg-gold text-navy' : 'border-[#D8D5CE] text-navy hover:border-gold')}>{option}</button>)}</div><div className="mt-8 grid gap-4 md:grid-cols-2">{deadlines.map((item) => <div key={item.title} className="flex items-center gap-4 rounded-sm border border-[#E3E0D9] p-4"><div className={cn('grid size-12 shrink-0 place-items-center rounded-sm text-center text-navy', item.color)}><span className="block text-[9px] font-bold uppercase">{item.month}</span><strong className="font-serif text-xl leading-5">{item.date}</strong></div><div><span className="badge badge-gold">{item.type}</span><h3 className="mt-2 text-sm font-semibold text-navy">{item.title}</h3></div></div>)}</div></div> }
function formatCurrency(value: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(value) }
