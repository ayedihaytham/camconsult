'use client'

import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, Calculator, Check, FileText, Lightbulb, LineChart, Scale, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { Ico } from '@/components/gl/parts'
import { getDictionary, type Lang } from '@/lib/i18n'

const SERVICE_ICONS = [Calculator, Lightbulb, ShieldCheck, Scale, Users, BriefcaseBusiness, Sparkles, LineChart]

export function ServicesTemplate({ lang = 'fr' }: { lang?: Lang }) {
  const { services } = getDictionary(lang)
  return (
    <PageShell lang={lang}>
      <main>
        <PageHero lang={lang} crumbs={[services.breadcrumbHome, services.title]} eyebrow={services.eyebrow} title={services.title} description={services.description} />
        <section className="ip sheet">
          <div className="ipw">
            <div className="ip-grid c4">
              {services.list.map((item, index) => {
                const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length]
                return (
                  <a key={item.key} href={`/${lang}/services/revision`} className="card hv" data-sa style={{ minHeight: 285 }}>
                    <div className="row">
                      <span className="ic"><Icon className="size-5" aria-hidden="true" /></span>
                      <span className="tag">{item.audience}</span>
                    </div>
                    <h2 style={{ marginTop: 22 }}>{item.title}</h2>
                    <p>{item.description}</p>
                    <span className="go">{services.seeDetail} <Ico n="arrow" /></span>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}

export function ServiceDetailTemplate({ lang = 'fr', serviceTitle }: { lang?: Lang; serviceTitle?: string }) {
  const { services, footer } = getDictionary(lang)
  const { detail } = services
  const [openFaq, setOpenFaq] = useState(0)
  const title = serviceTitle ?? detail.revisionTitle
  return (
    <PageShell lang={lang}>
      <main id="detail">
        <PageHero lang={lang} crumbs={[services.breadcrumbHome, title]} eyebrow={detail.eyebrow} title={title} description={detail.description} />
        <section className="ip sheet">
          <div className="ipw split">
            <div>
              <section className="block">
                <p className="eb">{detail.descriptionEyebrow}</p>
                <h2>{detail.descriptionTitle}</h2>
                <div className="prose" style={{ marginTop: 22 }}>{detail.descriptionBody.map((p) => <p key={p}>{p}</p>)}</div>
              </section>
              <section className="block">
                <p className="eb">{detail.audienceEyebrow}</p>
                <h2>{detail.audienceTitle}</h2>
                <ul className="list ip-grid c2" style={{ marginTop: 22 }}>{detail.audience.map((item) => <li key={item}><Check className="size-4 shrink-0" aria-hidden="true" />{item}</li>)}</ul>
              </section>
              <section className="block">
                <p className="eb">{detail.deliverablesEyebrow}</p>
                <h2>{detail.deliverablesTitle}</h2>
                <div className="ip-grid c2" style={{ marginTop: 22 }}>
                  {detail.deliverables.map((item) => (
                    <div key={item} className="card" style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 20 }}>
                      <span className="ic"><FileText className="size-5" aria-hidden="true" /></span>
                      <span style={{ lineHeight: 1.6, color: 'var(--primary)', fontSize: '.92rem' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="block">
                <p className="eb">FAQ</p>
                <div className="cm-faq faq-inner" style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
                  {detail.faq.map((item, index) => (
                    <details key={item.q} open={openFaq === index}>
                      <summary onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === index ? -1 : index) }}>
                        <span className="n num">{String(index + 1).padStart(2, '0')}</span><span className="q">{item.q}</span><i />
                      </summary>
                      <p>{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
            <aside>
              <div className="card dark" style={{ padding: 28 }}>
                <p className="eb l">{detail.sidebarEyebrow}</p>
                <h2 style={{ fontSize: '2rem', marginTop: 4 }}>{detail.sidebarTitle}</h2>
                <p>{detail.sidebarText}</p>
                <a className="pill l" href={`/${lang}/contact`} style={{ justifyContent: 'space-between', marginTop: 8 }}>{detail.sidebarCta} <ArrowRight className="size-4" aria-hidden="true" style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }} /></a>
                <div className="side-info" style={{ borderTop: '1px solid rgba(170,197,223,.25)', paddingTop: 18, marginTop: 8 }}>
                  <p dir="ltr">+216 71 847 608</p>
                  <p>camcompta@planet.tn</p>
                  <p>{footer.address.split(', ').pop()}</p>
                </div>
              </div>
              {title === detail.revisionTitle && (
                <div className="note2">
                  <ShieldCheck aria-hidden="true" />
                  <div><b>{detail.legalScopeLabel}</b>{detail.legalScopeText}</div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
