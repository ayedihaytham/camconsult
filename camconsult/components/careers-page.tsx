'use client'

import { useState } from 'react'
import { Briefcase, Check, Clock3, Mail, Paperclip, Phone, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getDictionary, type Lang } from '@/lib/i18n'

type CareersPageProps = { lang?: Lang }

function Hero({ isArabic, careers }: { isArabic: boolean; careers: ReturnType<typeof getDictionary>['careers'] }) {
  return (
    <section className="bg-navy px-6 pb-16 pt-28 text-white sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 text-xs text-white/50"><span>{careers.breadcrumbHome}</span><span>/</span><span className="text-gold">{careers.breadcrumbCareers}</span></div>
        <p className="eyebrow mt-12">{careers.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl leading-none sm:text-7xl">{careers.title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">{careers.description}</p>
      </div>
    </section>
  )
}

export function CareersPage({ lang = 'fr' }: CareersPageProps) {
  const { careers } = getDictionary(lang)
  const isArabic = lang === 'ar'
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [formKey, setFormKey] = useState(0)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (!form.get('name') || !form.get('email') || !form.get('message')) { setError(careers.form.required); return }
    setStatus('loading')
    window.setTimeout(() => { setStatus('success'); setFormKey((key) => key + 1); setFileName('') }, 700)
  }

  return <main dir={isArabic ? 'rtl' : 'ltr'}><Hero isArabic={isArabic} careers={careers} /><section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20"><div>
      {status === 'success' ? <div className="border border-gold/40 bg-[#f5ecd9] p-8 text-navy" role="status"><div className="grid size-12 place-items-center rounded-full bg-gold"><Check aria-hidden="true" /></div><h2 className="mt-6 font-serif text-3xl">{careers.successTitle}</h2><p className="mt-3 text-sm leading-6">{careers.successText}</p><button type="button" onClick={() => setStatus('idle')} className="mt-6 text-xs font-bold uppercase tracking-wider underline underline-offset-4">{careers.sendAnother}</button></div> : <form key={formKey} onSubmit={submit} className="flex flex-col gap-6" noValidate><div className="grid gap-6 sm:grid-cols-2"><label className="field-label">{careers.form.name}<input name="name" required className="field-input" autoComplete="name" /></label><label className="field-label">{careers.form.email}<input name="email" type="email" required className="field-input" autoComplete="email" /></label><label className="field-label">{careers.form.phone}<input name="phone" type="tel" className="field-input" autoComplete="tel" /></label><label className="field-label">{careers.form.position}<input name="position" className="field-input" /></label></div><label className="field-label">{careers.form.message}<textarea name="message" required rows={5} className="field-input resize-y" /></label><div className="field-label">{careers.form.cv}<label className="mt-1.5 flex cursor-pointer items-center gap-3 border border-dashed border-gold/60 bg-[#f5ecd9] px-4 py-3 text-sm text-navy/70 transition-colors hover:border-gold"><Paperclip className="size-4 shrink-0 text-gold" aria-hidden="true" /><span className="truncate">{fileName || careers.form.cvHint}</span><input type="file" name="cv" accept=".pdf,.doc,.docx" className="sr-only" onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? '')} /></label></div>{error && <p className="text-xs font-medium text-red-700" role="alert">{error}</p>}<Button type="submit" variant="primary" disabled={status === 'loading'} className="w-fit">{status === 'loading' ? careers.form.loading : careers.form.submit}<Send data-icon="inline-end" className={cn('transition-transform duration-300', isArabic ? 'rtl-mirror' : 'group-hover:translate-x-1')} /></Button></form>}
    </div><aside className="h-fit border border-border bg-white p-7 lg:sticky lg:top-28"><p className="eyebrow">{careers.sidebarEyebrow}</p><h2 className="mt-3 font-serif text-3xl text-navy">{careers.sidebarTitle}</h2><div className="mt-8 flex flex-col gap-5 text-sm text-muted-foreground"><p className="flex gap-3"><Briefcase className="size-5 shrink-0 text-gold" aria-hidden="true" />21 Rue Iraq<br />1001 Lafayette, Tunis</p><a href="tel:+21698400368" className="flex gap-3 hover:text-navy"><Phone className="size-5 shrink-0 text-gold" aria-hidden="true" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="flex gap-3 hover:text-navy"><Mail className="size-5 shrink-0 text-gold" aria-hidden="true" />camcompta@planet.tn</a><p className="flex gap-3"><Clock3 className="size-5 shrink-0 text-gold" aria-hidden="true" />{careers.hours}</p></div></aside></div></section></main>
}

export default CareersPage
