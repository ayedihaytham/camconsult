'use client'

import { useMemo, useState } from 'react'
import { Check, Clock3, Mail, MapPin, Phone, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type RequestType = 'quote' | 'meeting' | 'info'

type ContactPageProps = { lang?: 'fr' | 'ar' }

const requestLabels: Record<RequestType, { fr: string; ar: string }> = {
  quote: { fr: 'Devis', ar: 'طلب عرض سعر' },
  meeting: { fr: 'Rendez-vous', ar: 'موعد' },
  info: { fr: 'Information générale', ar: 'معلومات عامة' },
}

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

function Hero({ isArabic }: { isArabic: boolean }) {
  return (
    <section className="bg-navy px-6 pb-16 pt-28 text-white sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 text-xs text-white/50"><span>{isArabic ? 'الرئيسية' : 'Accueil'}</span><span>/</span><span className="text-gold">{isArabic ? 'اتصل بنا' : 'Contact'}</span></div>
        <p className="eyebrow mt-12">{isArabic ? 'نحن هنا للاستماع إليكم' : 'Un premier échange, simplement'}</p>
        <h1 className="mt-4 font-serif text-5xl leading-none sm:text-7xl">{isArabic ? 'اتصلوا بنا' : 'Contactez-nous'}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">{isArabic ? 'شاركوا احتياجاتكم مع فريقنا لنقترح عليكم الحل الأنسب.' : 'Parlez-nous de vos enjeux. Notre équipe vous répond avec clarté et discrétion.'}</p>
      </div>
    </section>
  )
}

export function ContactPage({ lang = 'fr' }: ContactPageProps) {
  const isArabic = lang === 'ar'
  const [requestType, setRequestType] = useState<RequestType>('quote')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState('')
  const [formKey, setFormKey] = useState(0)

  const copy = useMemo(() => isArabic ? {
    name: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'الهاتف', message: 'رسالتكم', required: 'يرجى إكمال الحقول المطلوبة.', submit: 'إرسال الطلب', loading: 'جارٍ الإرسال…', success: 'تم إرسال طلبكم بنجاح. سنعود إليكم قريباً.', slots: 'الأوقات المفضلة', morning: 'صباحاً', afternoon: 'بعد الظهر', company: 'الشركة (اختياري)', activity: 'طبيعة النشاط',
  } : {
    name: 'Nom complet', email: 'Adresse email', phone: 'Téléphone', message: 'Votre message', required: 'Veuillez renseigner les champs obligatoires.', submit: 'Envoyer la demande', loading: 'Envoi en cours…', success: 'Votre demande a bien été envoyée. Nous revenons vers vous rapidement.', slots: 'Créneaux souhaités', morning: 'Matin', afternoon: 'Après-midi', company: 'Entreprise (facultatif)', activity: 'Nature de l’activité',
  }, [isArabic])

  function toggleDay(day: string) { setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]) }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (!form.get('name') || !form.get('email') || !form.get('message')) { setError(copy.required); return }
    setStatus('loading')
    window.setTimeout(() => { setStatus('success'); setFormKey((key) => key + 1) }, 700)
  }

  return <main dir={isArabic ? 'rtl' : 'ltr'}><Hero isArabic={isArabic} /><section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20"><div><div className="flex flex-wrap gap-2 border-b border-border pb-5" role="tablist" aria-label={isArabic ? 'نوع الطلب' : 'Type de demande'}>{(Object.keys(requestLabels) as RequestType[]).map((type) => <button key={type} type="button" role="tab" aria-selected={requestType === type} onClick={() => { setRequestType(type); setStatus('idle') }} className={cn('rounded-full border px-5 py-2.5 text-xs font-semibold transition-all duration-200', requestType === type ? 'border-gold bg-gold text-navy' : 'border-border bg-white text-navy/65 hover:border-gold hover:text-navy')}>{isArabic ? requestLabels[type].ar : requestLabels[type].fr}</button>)}</div>
      {status === 'success' ? <div className="mt-10 border border-gold/40 bg-[#f5ecd9] p-8 text-navy" role="status"><div className="grid size-12 place-items-center rounded-full bg-gold"><Check aria-hidden="true" /></div><h2 className="mt-6 font-serif text-3xl">{isArabic ? 'شكراً لتواصلكم' : 'Merci pour votre message'}</h2><p className="mt-3 text-sm leading-6">{copy.success}</p><button type="button" onClick={() => setStatus('idle')} className="mt-6 text-xs font-bold uppercase tracking-wider underline underline-offset-4">{isArabic ? 'إرسال طلب آخر' : 'Envoyer une autre demande'}</button></div> : <form key={formKey} onSubmit={submit} className="mt-10 flex flex-col gap-6" noValidate><div className="grid gap-6 sm:grid-cols-2"><label className="field-label">{copy.name}<input name="name" required className="field-input" autoComplete="name" /></label><label className="field-label">{copy.email}<input name="email" type="email" required className="field-input" autoComplete="email" /></label><label className="field-label">{copy.phone}<input name="phone" type="tel" className="field-input" autoComplete="tel" /></label>{requestType === 'quote' ? <label className="field-label">{copy.company}<input name="company" className="field-input" /></label> : requestType === 'meeting' ? <label className="field-label">{copy.slots}<select name="slot" className="field-input"><option>{copy.morning}</option><option>{copy.afternoon}</option></select></label> : <label className="field-label">{copy.activity}<input name="activity" className="field-input" /></label>}</div>{requestType === 'meeting' && <fieldset className="flex flex-col gap-3"><legend className="field-label">{isArabic ? 'الأيام المفضلة' : 'Jours souhaités'}</legend><div className="flex flex-wrap gap-2">{weekdays.map((day) => <label key={day} className={cn('cursor-pointer rounded-sm border px-4 py-2 text-xs font-semibold transition-colors', selectedDays.includes(day) ? 'border-gold bg-[#f5ecd9] text-navy' : 'border-border bg-white text-muted-foreground hover:border-gold')}><input type="checkbox" name="days" value={day} checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} className="sr-only" />{day}</label>)}</div></fieldset>}<label className="field-label">{copy.message}<textarea name="message" required rows={5} className="field-input resize-y" /></label>{error && <p className="text-xs font-medium text-red-700" role="alert">{error}</p>}<Button type="submit" variant="primary" disabled={status === 'loading'} className="w-fit">{status === 'loading' ? copy.loading : copy.submit}<Send data-icon="inline-end" className={cn('transition-transform duration-300', isArabic ? 'rtl-mirror' : 'group-hover:translate-x-1')} /></Button></form>}
    </div><aside className="h-fit border border-border bg-white p-7 lg:sticky lg:top-28"><p className="eyebrow">{isArabic ? 'معلومات الاتصال' : 'Coordonnées'}</p><h2 className="mt-3 font-serif text-3xl text-navy">{isArabic ? 'لنتحدث' : 'Parlons de votre projet'}</h2><div className="mt-8 flex flex-col gap-5 text-sm text-muted-foreground"><p className="flex gap-3"><MapPin className="size-5 shrink-0 text-gold" aria-hidden="true" />21 Rue Iraq<br />1001 Lafayette, Tunis</p><a href="tel:+21671847608" className="flex gap-3 hover:text-navy"><Phone className="size-5 shrink-0 text-gold" aria-hidden="true" />71 847 608</a><a href="tel:+21698400368" className="flex gap-3 hover:text-navy"><Phone className="size-5 shrink-0 text-gold" aria-hidden="true" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="flex gap-3 hover:text-navy"><Mail className="size-5 shrink-0 text-gold" aria-hidden="true" />camcompta@planet.tn</a><p className="flex gap-3"><Clock3 className="size-5 shrink-0 text-gold" aria-hidden="true" />{isArabic ? 'الإثنين–السبت، 8:00–17:00' : 'Lun–Sam, 8h00–17h00'}</p></div><div className="mt-8 flex aspect-[4/3] items-center justify-center border border-dashed border-gold/60 bg-[#f5ecd9] text-center text-xs text-navy/60"><MapPin className="mr-2 size-4 text-gold" aria-hidden="true" />{isArabic ? 'خريطة الموقع' : 'Carte de localisation'}</div></aside></div></section></main>
}

export default ContactPage
