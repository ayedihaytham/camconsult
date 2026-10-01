import type { LucideIcon } from 'lucide-react'
import { BarChart3, Landmark, MessageCircle, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

type Home = ReturnType<typeof getDictionary>['home']

const ICONS: LucideIcon[] = [MessageCircle, Landmark, Users, ShieldCheck, BarChart3, Sparkles]
// Indices dans `home.differentiators` : la rigueur d'un côté, la présence humaine de l'autre.
const RIGOR = [3, 1, 4]
const HUMAN = [0, 2, 5]

function Scale({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 56" fill="none" stroke="currentColor" strokeWidth="1" className={cn('h-12 w-20 text-gold/70', className)} aria-hidden="true">
      <path d="M2 4h86" />
      <path d="M12 4 4 36M12 4l8 32M78 4l-8 32M78 4l8 32" />
      <path d="M2 36h22c0 8-5 12-11 12S2 44 2 36ZM66 36h22c0 8-5 12-11 12S66 44 66 36Z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  )
}

function Column({ lang, home, indices, kicker, title, side }: { lang: Lang; home: Home; indices: number[]; kicker: string; title: string; side: 'left' | 'right' }) {
  const rtl = lang === 'ar'
  // Côté gauche : texte aligné vers l'axe central ; côté droit : texte aligné vers l'extérieur.
  const physicalLeft = (side === 'left') !== rtl
  const reversed = physicalLeft
  return (
    <div>
      <div className={cn('flex flex-col', physicalLeft ? 'items-end text-right' : 'items-start text-left')}>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/45">{kicker}</p>
        <h3 className={cn('mt-1 font-serif text-2xl', side === 'right' ? 'italic text-gold' : 'text-white')}>{title}</h3>
      </div>
      <ul className="mt-4 border-t border-white/10">
        {indices.map((i) => {
          const [name, text] = home.differentiators[i]
          const Icon = ICONS[i]
          return (
            <li key={name} className={cn('flex items-center gap-4 border-b border-white/10 py-4', reversed ? 'flex-row-reverse text-right' : 'flex-row text-left')} dir="ltr">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 text-gold"><Icon className="size-4" aria-hidden="true" /></span>
              <span dir={rtl ? 'rtl' : 'ltr'}>
                <span className="block font-serif text-lg text-white">{name}</span>
                <span className="mt-0.5 block text-xs text-[#9db8e6]">{text}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function BalanceSection({ lang, home }: { lang: Lang; home: Home }) {
  const words = home.differenceTitle.trim().split(' ')
  const tail = words.splice(-2).join(' ')
  const lead = words.join(' ')
  const b = home.balance
  const rtl = lang === 'ar'
  return (
    <section id="a-propos" className="scroll-mt-20 bg-navy px-6 py-14 text-white sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="eyebrow inline-flex items-center gap-3"><span className="h-px w-8 bg-gold/60" />{home.differenceEyebrow}<span className="h-px w-8 bg-gold/60" /></p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.1] sm:text-5xl">{lead}<br /><em className="text-gold">{tail}</em></h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[#9db8e6]">{home.differenceText}</p>
        </div>

        <div className="relative mt-12 grid gap-10 md:grid-cols-2 md:gap-x-16" dir={rtl ? 'rtl' : 'ltr'}>
          <span className="pointer-events-none absolute inset-y-0 start-1/2 hidden w-px -translate-x-1/2 bg-white/25 md:block rtl:translate-x-1/2" aria-hidden="true" />
          <span className="pointer-events-none absolute -top-3 start-1/2 hidden size-3 -translate-x-1/2 rounded-full border border-white/50 bg-navy md:block rtl:translate-x-1/2" aria-hidden="true" />
          <div className="relative">
            <Scale className={cn('mb-3 hidden md:block', rtl ? 'ms-auto' : 'ms-auto -scale-x-100')} />
            <Column lang={lang} home={home} indices={RIGOR} kicker={b.leftKicker} title={b.leftTitle} side="left" />
          </div>
          <div className="relative">
            <Scale className="mb-3 hidden md:block" />
            <Column lang={lang} home={home} indices={HUMAN} kicker={b.rightKicker} title={b.rightTitle} side="right" />
          </div>
        </div>

        <div className="mt-10 text-center">
          <span className="mx-auto block size-2 rotate-45 bg-gold" aria-hidden="true" />
          <p className="mt-3 font-serif text-sm italic text-white/85">{b.closing}</p>
        </div>
      </div>
    </section>
  )
}
