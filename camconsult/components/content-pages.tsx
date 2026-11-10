'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, CalendarDays, Clock3, FileText, Mail, X } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { Ico } from '@/components/gl/parts'
import { getDictionary, type Lang } from '@/lib/i18n'

export function BlogPage({ lang = 'fr' }: { lang?: Lang }) {
  const { blog } = getDictionary(lang)
  const [category, setCategory] = useState(blog.categories[0])
  const filtered = useMemo(() => (category === blog.categories[0] ? blog.articles : blog.articles.filter((article) => article.category === category)), [category, blog])
  return (
    <PageShell lang={lang}>
      <main>
        <PageHero lang={lang} eyebrow={blog.eyebrow} title={blog.title} description={blog.description} />
        <section className="ip sheet">
          <div className="ipw">
            <div className="chp" aria-label="Filtres par catégorie">
              {blog.categories.map((item) => (
                <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
            <div className="ip-grid c3" style={{ marginTop: 40 }}>
              {filtered.map((article) => (
                <article key={article.title} className="card flush hv" data-sa>
                  <img src={article.image} alt="" width={800} height={800} loading="lazy" decoding="async" />
                  <div className="bd">
                    <span className="tag">{article.category}</span>
                    <h2>{article.title}</h2>
                    <p>{article.excerpt}</p>
                    <div className="meta">
                      <span><CalendarDays className="size-3.5" aria-hidden="true" />{article.date}</span>
                      <span><Clock3 className="size-3.5" aria-hidden="true" />{article.read}</span>
                    </div>
                    <a href="#article" className="go" style={{ paddingTop: 6 }}>{blog.readArticle} <Ico n="arrow" /></a>
                  </div>
                </article>
              ))}
            </div>
            <div className="pager" aria-hidden="true">
              <button type="button" aria-current="page">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}

export function ResourcesPage({ lang = 'fr' }: { lang?: Lang }) {
  const { resources } = getDictionary(lang)
  const [openFaq, setOpenFaq] = useState(0)
  const [modal, setModal] = useState<string | null>(null)
  const [faqCategory, setFaqCategory] = useState(resources.faqCategories[0])
  const visibleFaq = faqCategory === resources.faqCategories[0] ? resources.faq : resources.faq.filter((item) => item.category === faqCategory)
  return (
    <PageShell lang={lang}>
      <main>
        <PageHero lang={lang} eyebrow={resources.eyebrow} title={resources.title} description={resources.description} />
        <section className="ip sheet">
          <div className="ipw">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
              <div>
                <p className="eb">{resources.guidesEyebrow}</p>
                <h2>{resources.guidesTitle}</h2>
              </div>
              <p style={{ maxWidth: '38ch', color: 'var(--mfg)', lineHeight: 1.7 }}>{resources.guidesText}</p>
            </div>
            <div className="ip-grid c3" style={{ marginTop: 40 }}>
              {resources.guides.map((guide) => (
                <article key={guide.title} className="card hv" data-sa>
                  <div className="row">
                    <span className="ic"><FileText className="size-5" aria-hidden="true" /></span>
                    <span className="tag">{resources.pdfPages}</span>
                  </div>
                  <h3 style={{ marginTop: 18 }}>{guide.title}</h3>
                  <p>{guide.description}</p>
                  <button type="button" className="pill o" style={{ marginTop: 'auto', justifyContent: 'center', color: 'var(--primary)' }} onClick={() => setModal(guide.title)}>
                    <ArrowDownToLine className="size-4" aria-hidden="true" />{resources.download}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="ip alt sheet" id="faq">
          <div className="ipw">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
              <div>
                <p className="eb">{resources.faqEyebrow}</p>
                <h2>{resources.faqTitle}</h2>
              </div>
              <div className="chp">
                {resources.faqCategories.map((item) => (
                  <button key={item} type="button" aria-pressed={faqCategory === item} onClick={() => { setFaqCategory(item); setOpenFaq(0) }}>{item}</button>
                ))}
              </div>
            </div>
            <div className="cm-faq" style={{ marginTop: 34, maxWidth: 900, borderTop: '1px solid var(--line)' }}>
              {visibleFaq.map((item, index) => (
                <details key={item.question} open={openFaq === index}>
                  <summary onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === index ? -1 : index) }} aria-expanded={openFaq === index}>
                    <span className="n num">{String(index + 1).padStart(2, '0')}</span><span className="q">{item.question}</span><i />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        {modal && (
          <div className="modal">
            <div role="dialog" aria-modal="true" className="box cm-form">
              <button type="button" className="x" onClick={() => setModal(null)} aria-label={resources.modal.close}><X className="size-5" /></button>
              <span className="ic" style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#E2EAF0', color: '#285378' }}><Mail className="size-6" /></span>
              <p className="eb" style={{ marginTop: 10 }}>{resources.modal.accessFree}</p>
              <h2>{resources.modal.title}</h2>
              <p style={{ color: '#4B6070', lineHeight: 1.6 }}>{resources.modal.description(modal)}</p>
              <label className="lb" style={{ marginTop: 10 }}>{resources.modal.emailLabel}<input type="email" id="ressource-email" name="email" autoComplete="email" placeholder="vous@entreprise.com" dir="ltr" /></label>
              <button type="button" className="pill" style={{ justifyContent: 'center', marginTop: 8 }} onClick={() => setModal(null)}>{resources.modal.submit} <Ico n="arrow" /></button>
              <p style={{ textAlign: 'center', fontSize: '.72rem', color: '#4B6070' }}>{resources.modal.privacy}</p>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  )
}
