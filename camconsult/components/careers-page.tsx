'use client'

import { useState } from 'react'
import { Check, Clock3, Mail, MapPin, Paperclip, Phone, Upload } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { Ico } from '@/components/gl/parts'
import { useOpenNow } from '@/lib/business-hours'
import { getDictionary, type Lang } from '@/lib/i18n'

type CareersPageProps = { lang?: Lang }

const MAX_CV_BYTES = 5 * 1024 * 1024
const CV_PATTERN = /\.(pdf|docx?)$/i
const MESSAGE_MAX = 1000

export function CareersPage({ lang = 'fr' }: CareersPageProps) {
  const { careers, footer } = getDictionary(lang)
  const ui = careers.ui
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
  const star = <span style={{ color: '#8B4E25' }}> *</span>
  const [cvLabel, ...cvRest] = careers.form.cv.split(' (')
  const cvHint = cvRest.join(' (').replace(/\)$/, '')

  return (
    <PageShell lang={lang}>
      <main>
        <PageHero lang={lang} crumbs={[careers.breadcrumbHome, careers.breadcrumbCareers]} eyebrow={careers.eyebrow} title={careers.title} description={careers.description} />
        <section className="ip alt sheet">
          <div className="ipw split">
            <div className={'cm-form page fm' + (status === 'success' ? ' done' : '')} style={{ display: 'block' }}>
              <form onSubmit={submit} className="cm-form" noValidate style={{ background: 'none', border: 0, padding: 0 }}>
                  <div>
                    <div className="pct"><b>{ui.formTitle}</b><span>{ui.complete.replace('{n}', String(percent))}</span></div>
                    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: 12 }}><i style={{ width: `${percent}%` }} /></div>
                  </div>
                  <div className="two">
                    <label className="lb"><span>{careers.form.name}{star}</span><input value={values.name} onChange={(e) => set('name')(e.target.value)} placeholder={careers.form.namePlaceholder} autoComplete="name" /></label>
                    <label className="lb"><span>{careers.form.email}{star}</span><input type="email" value={values.email} onChange={(e) => set('email')(e.target.value)} placeholder={careers.form.emailPlaceholder} autoComplete="email" dir="ltr" /></label>
                  </div>
                  <label className="lb">{careers.form.phone}
                    <span className="inp" dir="ltr"><b>+216</b><input type="tel" value={values.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="12 345 678" autoComplete="tel-national" /></span>
                  </label>
                  <div>
                    <p className="lb" style={{ marginBottom: 8, display: 'block' }}>{careers.form.position}{star}</p>
                    <div className="chips">
                      {ui.positions.map((position) => (
                        <button key={position} type="button" onClick={() => set('position')(position)} aria-pressed={values.position === position}>{position}</button>
                      ))}
                    </div>
                  </div>
                  <label className="lb">{careers.form.message}
                    <textarea rows={5} maxLength={MESSAGE_MAX} value={values.message} onChange={(e) => set('message')(e.target.value)} placeholder={careers.form.messagePlaceholder} />
                    <small className="num" style={{ textAlign: 'end', opacity: 0.7 }}>{values.message.length} / {MESSAGE_MAX}</small>
                  </label>
                  <div>
                    <p className="lb" style={{ marginBottom: 8, display: 'block' }}>{cvLabel}{star} {cvHint && <small>({cvHint})</small>}</p>
                    <label
                      className={'drop' + (dragging ? ' on' : '')}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
                    >
                      <Upload className="size-5" aria-hidden="true" />
                      {file ? (
                        <>
                          <b style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Paperclip className="size-3.5" aria-hidden="true" />{file.name}</b>
                          <small><u>{ui.replace}</u></small>
                        </>
                      ) : (
                        <>
                          <b>{ui.dropTitle} <u>{ui.browse}</u></b>
                          <small>{ui.formats}</small>
                        </>
                      )}
                      <input type="file" accept=".pdf,.doc,.docx" className="sr" onChange={(e) => pickFile(e.currentTarget.files?.[0])} />
                    </label>
                  </div>
                  {error && <p className="err" role="alert">{error}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                    <button type="submit" className="send" disabled={status === 'loading'}><span>{status === 'loading' ? careers.form.loading : careers.form.submit}</span><Ico n="arrow" /></button>
                    <p className="conf" style={{ flex: 1, minWidth: 220 }}>{ui.privacy}</p>
                  </div>
                </form>
                <div className="okp" role="status" aria-live="polite">
                  <div className="sp">{Array.from({ length: 10 }, (_, n) => <i key={n} style={{ ['--a' as string]: n * 36 + 'deg' }} />)}</div>
                  <svg className="big" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" /><path d="M24 41l11 11 21-23" /></svg>
                  <h3>{careers.successTitle}</h3>
                  <p>{careers.successText}</p>
                  <button type="button" onClick={() => setStatus('idle')}>{careers.sendAnother}</button>
                </div>
            </div>
            <aside>
              <div className="card dark" style={{ padding: 28 }}>
                <p className="eb l">{careers.sidebarEyebrow}</p>
                <h2 style={{ fontSize: '2rem', lineHeight: 1.08, marginTop: 6 }}>{titleLead} <em>{lastWord}</em></h2>
                <div className="side-info" style={{ marginTop: 18 }}>
                  <p><MapPin className="size-5 shrink-0" aria-hidden="true" /><span>21 Rue Iraq<br />1001 Lafayette, Tunis</span></p>
                  <a href="tel:+21698400368" dir="ltr"><Phone className="size-5 shrink-0" aria-hidden="true" />98 400 368</a>
                  <a href="mailto:camcompta@planet.tn"><Mail className="size-5 shrink-0" aria-hidden="true" />camcompta@planet.tn</a>
                  <p>
                    <Clock3 className="size-5 shrink-0" aria-hidden="true" />
                    <span style={{ flex: 1 }}>{careers.hours}</span>
                    {isOpen !== null && (
                      <span className={'cm-open' + (isOpen ? '' : ' closed')} style={{ fontSize: '.68rem' }}><i />{isOpen ? footer.openShort : footer.closedShort}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="card">
                <p className="eb">{ui.afterTitle}</p>
                <ol className="timeline" style={{ marginTop: 12 }}>
                  {ui.after.map(([title, text]) => (
                    <li key={title}><b>{title}</b><span>{text}</span></li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </PageShell>
  )
}

export default CareersPage
