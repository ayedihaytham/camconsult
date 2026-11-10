import { FileText, ShieldCheck } from 'lucide-react'
import { PageHero, PageShell } from '@/components/gl/page'
import { getDictionary, type Lang } from '@/lib/i18n'

type LegalKey = 'mentions' | 'privacy' | 'terms' | 'cookies'

const LEGAL_PATHS: Record<LegalKey, string> = {
  mentions: '/mentions-legales', privacy: '/confidentialite', terms: '/cgu', cookies: '/cookies',
}

export function LegalPages({ lang = 'fr', initialPage = 'mentions' }: { lang?: Lang; initialPage?: LegalKey }) {
  const { legal } = getDictionary(lang)
  const page = legal.pages[initialPage]
  return (
    <PageShell lang={lang}>
      <main>
        <PageHero
          lang={lang}
          crumbs={[legal.breadcrumbHome, page.title]}
          eyebrow={page.label}
          title={page.title}
          extra={<p style={{ marginTop: 6, fontSize: '.84rem', color: '#AAC5DF' }}>{legal.updatedLabel} : {page.updated}</p>}
        />
        <section className="ip sheet">
          <div className="ipw legal">
            <aside>
              <p className="lbl">{legal.tocLabel}</p>
              <nav aria-label={legal.tocLabel}>
                {page.sections.map((section, index) => (
                  <a key={section.id} href={`#${section.id}`}><span>0{index + 1}</span>{section.title}</a>
                ))}
              </nav>
              <p className="nt2"><ShieldCheck className="size-5" style={{ color: 'var(--ok)', marginBottom: 8 }} aria-hidden="true" />{legal.tocNote}</p>
            </aside>
            <article>
              <div className="lead">
                <FileText className="size-7" style={{ color: 'var(--accent)', marginBottom: 14 }} aria-hidden="true" />
                <p>{page.intro}</p>
              </div>
              {page.sections.map((section) => (
                <section key={section.id} id={section.id}>
                  <h2>{section.title}</h2>
                  <div className="prose">{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
                </section>
              ))}
            </article>
          </div>
        </section>
        <div className="legalnav">
          <div className="ipw chp">
            {legal.nav.map((item) => (
              <a key={item.key} href={`/${lang}${LEGAL_PATHS[item.key as LegalKey]}`} aria-current={initialPage === item.key ? 'page' : undefined}>{item.label}</a>
            ))}
          </div>
        </div>
      </main>
    </PageShell>
  )
}

export type { LegalKey }
