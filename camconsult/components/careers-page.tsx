'use client'

import { useState } from 'react'
import { AtSign, Check, Clock3, Mail, MapPin, Paperclip, Phone, Send, Upload, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOpenNow } from '@/lib/business-hours'
import { getDictionary, type Lang } from '@/lib/i18n'

type CareersPageProps = { lang?: Lang }

function Hero({ isArabic, careers }: { isArabic: boolean; careers: ReturnType<typeof getDictionary>['careers'] }) {
  return (
    <section className="bg-feature px-6 pb-16 pt-28 text-feature-foreground sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 text-xs text-feature-muted"><span>{careers.breadcrumbHome}</span><span>/</span><span className="text-accent-ink">{careers.breadcrumbCareers}</span></div>
        <p className="eyebrow mt-12">{careers.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl leading-none sm:text-7xl">{careers.title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-feature-muted">{careers.description}</p>
      </div>
    </section>
  )
}

const MAX_CV_BYTES = 5 * 1024 * 1024
const CV_PATTERN = /\.(pdf|docx?)$/i
const MESSAGE_MAX = 1000

const FIELD = 'flex h-11 items-center gap-2 border border-input bg-card px-3 text-sm text-foreground transition-colors focus-within:border-ring'
const INPUT = 'min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none'
const LABEL = 'text-[0.7rem] font-semibold text-foreground'

export function CareersPage({ lang = 'fr' }: CareersPageProps) {
  const { careers, footer } = getDictionary(lang)
  const ui = careers.ui
  const isArabic = lang === 'ar'
  const isOpen = useOpenNow()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState('')
  const [values, setValues] = useState({ name: '', email: '', phone: '', position: '', message: '' })
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  const filled = [values.name, values.email, values.phone, values.position, values.message].filter((v) => v.trim()).length + (file ? 1 : 0)
  const percent = Math.round((filled / 6) * 100)

  function pickFile(next: File | undefined) {
    if (!next) return
    if (!CV_PATTERN.test(next.name) || next.size > MAX_CV_BYTES) { setFile(null); setError(ui.fileInvalid); return }
    setError('')
    setFile(next)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!values.name.trim() || !values.email.trim() || !values.position || !file) { setError(careers.form.required); return }
    setStatus('loading')
    window.setTimeout(() => {
      setStatus('success')
      setValues({ name: '', email: '', phone: '', position: '', message: '' })
      setFile(null)
    }, 700)
  }

  const titleWords = careers.sidebarTitle.trim().split(' ')
  const lastWord = titleWords.pop()
  const titleLead = titleWords.join(' ')
  const star = <span className="text-accent-ink"> *</span>
  const [cvLabel, ...cvRest] = careers.form.cv.split(' (')
  const cvHint = cvRest.join(' (').replace(/\)$/, '')

  const contactRows = [
    { icon: MapPin, href: undefined, content: <>21 Rue Iraq<br />1001 Lafayette, Tunis</> },
    { icon: Phone, href: 'tel:+21698400368', content: '98 400 368' },
    { icon: Mail, href: 'mailto:camcompta@planet.tn', content: 'camcompta@planet.tn' },
  ]

  return (
    <main dir={isArabic ? 'rtl' : 'ltr'}>
      <Hero isArabic={isArabic} careers={careers} />
      <section className="bg-muted px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-card p-6 shadow-panel sm:p-9">
            {status === 'success' ? (
              <div className="text-foreground" role="status">
                <div className="grid size-12 place-items-center rounded-full bg-accent"><Check aria-hidden="true" /></div>
                <h2 className="mt-6 font-serif text-3xl">{careers.successTitle}</h2>
                <p className="mt-3 text-sm leading-6">{careers.successText}</p>
                <button type="button" onClick={() => setStatus('idle')} className="mt-6 text-xs font-bold uppercase tracking-wider underline underline-offset-4">{careers.sendAnother}</button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-serif text-3xl text-foreground">{ui.formTitle}</h2>
                    <p className="shrink-0 text-[0.7rem] font-semibold text-accent-ink">{ui.complete.replace('{n}', String(percent))}</p>
                  </div>
                  <div className="mt-3 h-0.5 w-full bg-accent-soft" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>{careers.form.name}{star}</span>
                    <span className={cn(FIELD, 'mt-1.5')}>
                      <User className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <input value={values.name} onChange={(e) => set('name')(e.target.value)} placeholder={careers.form.namePlaceholder} autoComplete="name" className={INPUT} />
                    </span>
                  </label>
                  <label className="block">
                    <span className={LABEL}>{careers.form.email}{star}</span>
                    <span className={cn(FIELD, 'mt-1.5')}>
                      <AtSign className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <input type="email" value={values.email} onChange={(e) => set('email')(e.target.value)} placeholder={careers.form.emailPlaceholder} autoComplete="email" dir="ltr" className={INPUT} />
                    </span>
                  </label>
                </div>

                <label className="block">
                  <span className={LABEL}>{careers.form.phone}</span>
                  <span className={cn(FIELD, 'mt-1.5')} dir="ltr">
                    <span className="border-e border-border pe-3 text-xs font-bold text-foreground">+216</span>
                    <input type="tel" value={values.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="12 345 678" autoComplete="tel-national" className={INPUT} />
                  </span>
                </label>

                <div>
                  <span className={LABEL}>{careers.form.position}{star}</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ui.positions.map((position) => (
                      <button
                        key={position}
                        type="button"
                        onClick={() => set('position')(position)}
                        aria-pressed={values.position === position}
                        className={cn('rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors', values.position === position ? 'border-foreground bg-feature text-feature-foreground' : 'border-border bg-card text-foreground hover:border-accent')}
                      >
                        {position}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className={LABEL}>{careers.form.message}</span>
                  <span className="relative mt-1.5 block">
                    <textarea
                      rows={5}
                      maxLength={MESSAGE_MAX}
                      value={values.message}
                      onChange={(e) => set('message')(e.target.value)}
                      placeholder={careers.form.messagePlaceholder}
                      className="block w-full resize-y border border-input bg-card p-3 pb-7 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                    />
                    <span className="pointer-events-none absolute bottom-2 end-3 text-[0.65rem] tabular-nums text-muted-foreground">{values.message.length} / {MESSAGE_MAX}</span>
                  </span>
                </label>

                <div>
                  <span className={LABEL}>{cvLabel}{star} {cvHint && <span className="font-normal text-muted-foreground">({cvHint})</span>}</span>
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
                    className={cn('mt-1.5 flex cursor-pointer flex-col items-center gap-2 border border-dashed px-4 py-8 text-center transition-colors', dragging ? 'border-accent bg-accent-soft' : 'border-accent/50 bg-card hover:border-accent')}
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-ink"><Upload className="size-4" aria-hidden="true" /></span>
                    {file ? (
                      <>
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Paperclip className="size-3.5 text-accent-ink" aria-hidden="true" />{file.name}</span>
                        <span className="text-xs text-muted-foreground underline underline-offset-2">{ui.replace}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-foreground">{ui.dropTitle} <span className="text-accent-ink underline underline-offset-2">{ui.browse}</span></span>
                        <span className="text-[0.7rem] text-muted-foreground">{ui.formats}</span>
                      </>
                    )}
                    <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => pickFile(e.currentTarget.files?.[0])} />
                  </label>
                </div>

                {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}

                <div className="flex flex-col gap-4 border-t border-accent-soft pt-5 sm:flex-row sm:items-center">
                  <button type="submit" disabled={status === 'loading'} className="inline-flex shrink-0 items-center justify-center gap-3 bg-primary px-6 py-3.5 text-[0.7rem] font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60">
                    {status === 'loading' ? careers.form.loading : careers.form.submit}
                    <Send className={cn('size-3.5', isArabic && 'rtl-mirror')} aria-hidden="true" />
                  </button>
                  <p className="text-[0.7rem] leading-5 text-muted-foreground">{ui.privacy}</p>
                </div>
              </form>
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="bg-feature p-7 text-feature-foreground">
              <p className="eyebrow">{careers.sidebarEyebrow}</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight">{titleLead} <em className="text-accent-ink">{lastWord}</em></h2>
              <ul className="mt-6 divide-y divide-feature-foreground/10 border-t border-feature-foreground/10 text-sm">
                {contactRows.map(({ icon: Icon, href, content }, i) => {
                  const inner = (
                    <>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-feature-foreground/20 text-accent-ink"><Icon className="size-3.5" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1 text-feature-foreground">{content}</span>
                    </>
                  )
                  return (
                    <li key={i}>
                      {href ? <a href={href} className="flex items-center gap-3 py-4 hover:text-accent-ink">{inner}</a> : <div className="flex items-center gap-3 py-4">{inner}</div>}
                    </li>
                  )
                })}
                <li className="flex items-center gap-3 py-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-feature-foreground/20 text-accent-ink"><Clock3 className="size-3.5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 text-feature-foreground">{careers.hours}</span>
                  {isOpen !== null && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-feature-foreground/20 bg-feature-foreground/5 px-2.5 py-1 text-[0.65rem] font-semibold text-feature-muted">
                      <span className={cn('size-1.5 rounded-full', isOpen ? 'bg-success' : 'bg-accent')} aria-hidden="true" />
                      {isOpen ? footer.openShort : footer.closedShort}
                    </span>
                  )}
                </li>
              </ul>
            </div>

            <div className="border border-border bg-card p-6">
              <p className="eyebrow">{ui.afterTitle}</p>
              <ol className="relative mt-5 space-y-4 ps-6">
                <span className="absolute inset-y-1 start-[5px] w-px bg-border" aria-hidden="true" />
                {ui.after.map(([title, text], i) => (
                  <li key={title} className="relative">
                    <span className={cn('absolute -start-6 top-1 size-[11px] rounded-full border border-accent', i === 0 ? 'bg-accent' : 'bg-card')} aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default CareersPage
