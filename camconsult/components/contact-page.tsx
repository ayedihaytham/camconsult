'use client'

import { useState } from 'react'
import { Check, Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { Ico } from '@/components/gl/parts'
import { getDictionary, type Lang } from '@/lib/i18n'

type RequestType = 'quote' | 'meeting' | 'info'
type ContactPageProps = { lang?: Lang }

export function ContactPage({ lang = 'fr' }: ContactPageProps) {
  const { contact } = getDictionary(lang)
  const [requestType, setRequestType] = useState<RequestType>('quote')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState('')
  const [formKey, setFormKey] = useState(0)

  function toggleDay(day: string) { setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]) }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (!form.get('name') || !form.get('email') || !form.get('message')) { setError(contact.form.required); return }
    setStatus('loading')
    window.setTimeout(() => { setStatus('success'); setFormKey((key) => key + 1) }, 700)
  }

  return (
    <PageShell lang={lang} fab={false}>
      <main>
        <PageHero lang={lang} crumbs={[contact.breadcrumbHome, contact.breadcrumbContact]} eyebrow={contact.eyebrow} title={contact.title} description={contact.description} />
        <section className="ip sheet">
          <div className="ipw split">
            <div className={'cm-form page fm' + (status === 'success' ? ' done' : '')} style={{ display: 'block' }}>
              <div className="chp" role="tablist" aria-label={contact.requestTypeLabel} style={{ marginBottom: 28 }}>
                {(Object.keys(contact.requestTypes) as RequestType[]).map((type) => (
                  <button key={type} type="button" role="tab" aria-selected={requestType === type} onClick={() => { setRequestType(type); setStatus('idle') }}>{contact.requestTypes[type]}</button>
                ))}
              </div>
              <form key={formKey} onSubmit={submit} className="cm-form" noValidate style={{ background: 'none', border: 0, padding: 0 }}>
                  <div className="two">
                    <label className="lb">{contact.form.name}<input name="name" required autoComplete="name" /></label>
                    <label className="lb">{contact.form.email}<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
                    <label className="lb">{contact.form.phone}<input name="phone" type="tel" autoComplete="tel" dir="ltr" /></label>
                    {requestType === 'quote' ? (
                      <label className="lb">{contact.form.company}<input name="company" /></label>
                    ) : requestType === 'meeting' ? (
                      <label className="lb">{contact.form.slots}<select name="slot"><option>{contact.form.morning}</option><option>{contact.form.afternoon}</option></select></label>
                    ) : (
                      <label className="lb">{contact.form.activity}<input name="activity" /></label>
                    )}
                  </div>
                  {requestType === 'meeting' && (
                    <fieldset style={{ border: 0, padding: 0 }}>
                      <legend className="lb" style={{ marginBottom: 8 }}>{contact.form.preferredDays}</legend>
                      <div className="days">
                        {contact.weekdays.map((day) => (
                          <label key={day} className={selectedDays.includes(day) ? 'on' : undefined}>
                            <input type="checkbox" name="days" value={day} checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} className="sr" />
                            {day}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <label className="lb">{contact.form.message}<textarea name="message" required rows={5} /></label>
                  {error && <p className="err" role="alert">{error}</p>}
                  <button type="submit" className="send" disabled={status === 'loading'} style={{ justifySelf: 'start' }}>
                    <span>{status === 'loading' ? contact.form.loading : contact.form.submit}</span><Ico n="arrow" />
                  </button>
                </form>
                <div className="okp" role="status" aria-live="polite">
                  <div className="sp">{Array.from({ length: 10 }, (_, n) => <i key={n} style={{ ['--a' as string]: n * 36 + 'deg' }} />)}</div>
                  <svg className="big" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" /><path d="M24 41l11 11 21-23" /></svg>
                  <h3>{contact.successTitle}</h3>
                  <p>{contact.successText}</p>
                  <button type="button" onClick={() => setStatus('idle')}>{contact.sendAnother}</button>
                </div>
            </div>
            <aside>
              <div className="card" style={{ padding: 28 }}>
                <p className="eb">{contact.sidebarEyebrow}</p>
                <h2 style={{ fontSize: '2rem', marginTop: 4 }}>{contact.sidebarTitle}</h2>
                <div className="side-info" style={{ marginTop: 18, color: 'var(--mfg)' }}>
                  <p><MapPin className="size-5 shrink-0" aria-hidden="true" /><span>21 Rue Iraq<br />1001 Lafayette, Tunis</span></p>
                  <a href="tel:+21671847608" dir="ltr"><Phone className="size-5 shrink-0" aria-hidden="true" />71 847 608</a>
                  <a href="tel:+21698400368" dir="ltr"><Phone className="size-5 shrink-0" aria-hidden="true" />98 400 368</a>
                  <a href="mailto:camcompta@planet.tn"><Mail className="size-5 shrink-0" aria-hidden="true" />camcompta@planet.tn</a>
                  <p><Clock3 className="size-5 shrink-0" aria-hidden="true" />{contact.hours}</p>
                </div>
                <div className="map" style={{ marginTop: 22 }}><span><MapPin className="size-4" style={{ display: 'inline', marginInlineEnd: 6 }} aria-hidden="true" />{contact.mapPlaceholder}</span></div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </PageShell>
  )
}

export default ContactPage
