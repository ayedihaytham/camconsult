'use client'

import { useEffect, useRef } from 'react'

import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { Ico, Mock, SERVICE_MOCKS, Title, type TitlePart } from '@/components/gl/parts'
import { NewsletterForm } from '@/components/gl/newsletter'
import { initGl } from '@/components/gl/engine'
import { glConfig } from '@/components/gl/config'
import { getDictionary, type Lang } from '@/lib/i18n'

/** Titre « début + dernier mot en italique » à partir d'une phrase du dictionnaire. */
function lastWordTitle(text: string): TitlePart[] {
  const w = text.trim().split(' ')
  const last = w.pop() as string
  return [w.join(' ') + ' ', { em: last }]
}

const NEEDS = ['decider', 'demarrer', 'quotidien', 'securiser'] as const
const KEY_SYMBOLS = ['k-x', 'k-p', 'k-d', 'k-m']
const TRUST_ICONS = ['badge', 'cert', 'spark', 'shield']

export default function HomePage({ lang }: { lang: Lang }) {
  const dict = getDictionary(lang)
  const { home, footer, gl, fiscalTools: ft } = dict
  const root = useRef<HTMLDivElement>(null)
  const L = (path: string) => `/${lang}${path === '/' ? '' : path}`
  const ui = home.toolsUi
  const tu = gl.toolsUi

  useEffect(() => {
    if (!root.current) return
    return initGl(root.current, glConfig(lang, true))
  }, [lang])

  const mtWords = home.methodTitle.trim().split(' ')
  const methodTitle = { last: mtWords.pop() as string, lead: '' }
  methodTitle.lead = mtWords.join(' ') + ' '
  const stats3 = home.stats.slice(0, 3)
  const diffA = gl.diffA.map((i) => home.differentiators[i])
  const diffB = gl.diffB.map((i) => home.differentiators[i])
  const cats = home.serviceCategories
  const outcomes = home.methodUi.outcomes
  const mu = home.methodUi
  const heroTitle = (
    <>
      {home.heroTitlePre && <>{home.heroTitlePre} </>}
      <em>{home.heroTitleHighlight}</em> {home.heroTitlePost}
    </>
  )
  const stepVisual = (i: number) => {
    if (i === 0)
      return (
        <div className="sv">
          <div className="bub me">{mu.chat[0]}</div>
          <div className="bub">{mu.chat[1]}</div>
          <div className="r"><b className="ok">✓ {mu.chat[2]}</b><span>{mu.chat[3]}</span></div>
        </div>
      )
    if (i === 1)
      return (
        <div className="sv">
          <div className="t"><b>{mu.priorities.title}</b><small>{mu.priorities.tag}</small></div>
          {mu.priorities.rows.map((r, k) => (
            <div className="r" key={r}><span>{r}</span><em>{mu.priorities.levels[k]}</em></div>
          ))}
        </div>
      )
    if (i === 2)
      return (
        <div className="sv">
          <div className="t"><b>{mu.letter.title}</b><small>{mu.letter.brand}</small></div>
          {mu.letter.fields.map((f) => (
            <div className="r" key={f}><span>{f}</span><span>—</span></div>
          ))}
          <span className="stamp2">{mu.letter.stamp}</span>
        </div>
      )
    return (
      <div className="sv">
        <div className="t"><b>{mu.monthly.title}</b><small>{mu.monthly.example}</small></div>
        <div className="bars">{[38, 52, 47, 66, 74, 90].map((h) => <i key={h} style={{ height: h + '%' }} />)}</div>
        <div className="mo">{mu.monthly.months.map((m) => <span key={m}>{m}</span>)}</div>
        {mu.monthly.checks.map((c) => <div className="r" key={c}><span>{c}</span><b className="ok">✓</b></div>)}
      </div>
    )
  }

  const fig = (copy: number) =>
    home.stats.map((s) => (
      <div className="it" key={copy + s.label} aria-hidden={copy > 0 ? true : undefined}>
        <b className="num">{s.value}</b>
        <span>{s.label}</span>
      </div>
    ))

  const requiredLabel = (s: string) => `${s} *`

  return (
    <div ref={root} className="gl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <noscript>
        <style>{`.gl .hs .w>i{transform:none}.gl .sa:not(.in){opacity:1}.gl .rv{opacity:1;transform:none}.gl .gc,.gl .lx-gc{filter:none}`}</style>
      </noscript>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="k-x" viewBox="0 0 40 40"><path d="M10 10l20 20M30 10 10 30" fill="none" stroke="currentColor" strokeLinecap="round" /></symbol>
          <symbol id="k-p" viewBox="0 0 40 40"><path d="M20 8v24M8 20h24" fill="none" stroke="currentColor" strokeLinecap="round" /></symbol>
          <symbol id="k-d" viewBox="0 0 40 40"><path d="M8 20h24" fill="none" stroke="currentColor" strokeLinecap="round" /><circle cx="20" cy="9.5" r="2.6" fill="currentColor" /><circle cx="20" cy="30.5" r="2.6" fill="currentColor" /></symbol>
          <symbol id="k-m" viewBox="0 0 40 40"><path d="M8 20h24" fill="none" stroke="currentColor" strokeLinecap="round" /></symbol>
        </defs>
      </svg>

      <CamconsultHeader lang={lang} home />
      <div className="prog" aria-hidden="true"><i /></div>
      <a className="fab" id="fab" href="#contact" aria-label={dict.nav.bookAppointment}>
        <Ico n="clip" />
        <span>{dict.nav.bookAppointment}</span>
      </a>
      <nav className="rail" id="rail" aria-label={gl.sectionsLabel}>
        {['hero', 'services', 'bilan', 'diff', 'methode', 'outils', 'faq', 'contact'].map((id, i) => (
          <a key={id} href={`#${id}`} data-s={id}><span>{gl.rail[i]}</span><i /></a>
        ))}
      </nav>

      <main>
        {/* ===== HÉROS : le grand livre vivant ===== */}
        <section id="hero" data-scene data-nop>
          <div className="stage">
            <div className="lay la">
              <canvas id="led" aria-hidden="true" />
              <p className="eb" style={{ marginBottom: 22 }}>{home.heroEyebrow}</p>
              <h1>{heroTitle}</h1>
              <div className="x" id="xa">
                <p>{home.heroText}</p>
                <div className="r">
                  <a className="pill" href="#contact">{home.ctaPrimary}</a>
                  <a className="pill o" href="#services">{home.ctaSecondary}</a>
                  <span className="cm-open" data-open><i /><span data-open-txt>{footer.hours}</span></span>
                </div>
              </div>
              <div className="fig">{stats3.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
              <div className="meta"><span>{gl.heroMeta}</span></div>
            </div>
            <div className="lay lyb">
              <div className="ph" />
              <div className="tint" />
              <p className="eb l" style={{ marginBottom: 22 }} aria-hidden="true">{home.heroEyebrow}</p>
              <h1 aria-hidden="true">{heroTitle}</h1>
              <div className="x" id="xb" inert>
                <p>{home.heroText}</p>
                <div className="r">
                  <a className="pill l" href="#contact">{home.ctaPrimary}</a>
                  <a className="pill o" href="#services">{home.ctaSecondary}</a>
                  <span className="cm-open" data-open><i /><span data-open-txt>{footer.hours}</span></span>
                </div>
              </div>
              <div className="keys" aria-hidden="true">
                {KEY_SYMBOLS.map((k) => <i key={k}><svg><use href={`#${k}`} /></svg></i>)}
              </div>
              <div className="fig">{stats3.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
            </div>
            <div className="hint">{gl.hint.toUpperCase()}</div>
          </div>
        </section>

        {/* ===== SERVICES : pellicule fluide ===== */}
        <section id="services" className="sheet" data-scene data-nop aria-label={home.servicesEyebrow}>
          <div className="stage">
            <div className="sh">
              <div>
                <p className="eb l">{home.servicesEyebrow}</p>
                <Title parts={[gl.servicesTitle[0], 'br', { em: gl.servicesTitle[1] }, ' ' + gl.servicesTitle[2]]} />
              </div>
              <div className="nk" id="nk" data-nosnap role="group" aria-label={home.servicesFilterLabel}>
                {NEEDS.map((k, i) => (
                  <button type="button" key={k} data-k={k} aria-pressed="false">
                    <span className="kc"><svg viewBox="0 0 40 40" className="ico" aria-hidden="true"><use href={`#${KEY_SYMBOLS[i]}`} /></svg></span>
                    <b>{cats[k].tag}</b>
                    <small>{cats[k].subtitle}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="tr">
              <div className="track" id="track">
                {home.services.map((s, i) => (
                  <article className="sc" data-c={s.category} key={s.title}>
                    <div className="tp"><span>{cats[s.category].tag}</span><b className="num">{String(i + 1).padStart(2, '0')}</b></div>
                    <div className="mkw"><div className="in"><Mock k={SERVICE_MOCKS[i]} m={gl.mock} /></div></div>
                    <div className="bd">
                      <h3>{s.title}</h3>
                      <p className="x">{s.text}</p>
                      <ul>{s.deliverables.map((d) => <li key={d}><Ico n="check" />{d}</li>)}</ul>
                      <a className="more" href={L('/services')}>{home.servicesMore} <Ico n="arrow" /></a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="sprog">
              <a className="all" href={L('/services')}>{home.servicesSeeAll} <Ico n="arrow" /></a>
              <span id="scnt" className="num" aria-hidden="true">01 / 08</span>
              <div className="bar" aria-hidden="true"><i /></div>
            </div>
          </div>
        </section>

        {/* ===== BILAN : ruban de chiffres ===== */}
        <section className="tape sheet" id="bilan" aria-label={home.bilan.title}>
          <span id="a-propos" />
          <div className="tt"><p className="eb">{home.bilan.title}</p><p className="eb">{gl.tapeKicker}</p></div>
          <div className="mq" id="mq">{fig(0)}{fig(1)}{fig(2)}{fig(3)}</div>
          <p className="q">« {home.sideQuote} »<small>{home.bilan.author}</small></p>
        </section>
        <div className="trust">
          {home.trustBar.map((label, i) => (
            <div key={label}><Ico n={TRUST_ICONS[i]} /><span>{label}</span></div>
          ))}
        </div>

        {/* ===== DIFFÉRENCE : volet ===== */}
        <section id="diff" data-scene data-nop aria-label={home.differenceEyebrow}>
          <div className="stage">
            <div className="vol va">
              <div className="in">
                <p className="eb">{home.differenceEyebrow} · {home.balance.leftKicker.toLowerCase()}</p>
                <Title parts={[gl.diff.a[0], { em: gl.diff.a[1] }]} />
                <div className="cols" id="colA">{diffA.map((c) => <div key={c[0]}><b>{c[0]}</b><span>{c[1]}</span></div>)}</div>
              </div>
            </div>
            <div className="vol vb">
              <div className="in">
                <p className="eb l">{home.differenceEyebrow} · {home.balance.rightKicker.toLowerCase()}</p>
                <Title parts={[gl.diff.b[0], { em: gl.diff.b[1] }]} />
                <div className="cols" id="colB">{diffB.map((c) => <div key={c[0]}><b>{c[0]}</b><span>{c[1]}</span></div>)}</div>
                <p className="close">{home.balance.closing}</p>
              </div>
            </div>
            <div className="sweep" />
          </div>
        </section>

        {/* ===== MÉTHODE : numéro collant ===== */}
        <section className="met sheet" id="methode">
          <div className="wrap">
            <p className="eb rv">{home.methodEyebrow}</p>
            <h2 className="rv" style={{ ['--d' as string]: 1 }}>
              {methodTitle.lead}<em>{methodTitle.last}</em>
            </h2>
            <div className="mg">
              <div className="mn" id="mn">{home.steps.map((s) => <b className="num" key={s[0]}>{s[0]}</b>)}</div>
              <div className="ms" id="ms">
                {home.steps.map((s, i) => (
                  <article key={s[0]}>
                    <h3>{s[1]}</h3>
                    <p className="a">{s[2]}</p>
                    <div className="out"><span className="eyeb">{mu.obtain}</span><p className="b">{outcomes[i]}</p></div>
                    {stepVisual(i)}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== OUTILS : cadrans ===== */}
        <section className="tools sheet" id="outils">
          <div className="wrap">
            <p className="eb">{home.toolsEyebrow}</p>
            <Title parts={lastWordTitle(home.toolsTitle)} />
            <div className="tl four" id="tl">
              <article className="tc">
                <h3>{ft.tools[0].label}</h3>
                <div className="dial" data-bar="vat"><div><small>{tu.vatLabel}</small><b className="num" data-out="vat" suppressHydrationWarning /></div></div>
                <div className="seg"><button type="button" data-mode="ht" aria-pressed="true">{ui.htToTtc}</button><button type="button" data-mode="ttc" aria-pressed="false">{ui.ttcToHt}</button></div>
                <label>{ft.tva.amountLabel}<span className="inp"><input data-in="tva" inputMode="decimal" defaultValue="1000" dir="ltr" /><span>{ui.currency}</span></span></label>
                <div className="rt" role="group" aria-label={ft.tva.rate}>{[19, 13, 7].map((r) => <button type="button" key={r} data-rate={r} aria-pressed={r === 19}>{r} %</button>)}</div>
                <div className="sm"><div><small>{ft.tva.resultHt}</small><b className="num" data-out="ht" suppressHydrationWarning /></div><div><small>{ft.tva.resultTtc}</small><b className="num" data-out="ttc" suppressHydrationWarning /></div></div>
              </article>
              <article className="tc">
                <h3>{ft.tools[1].label}</h3>
                <div className="dial" data-bar="tax"><div><small>{tu.estimated}</small><b className="num" data-out="tax" suppressHydrationWarning /></div></div>
                <label>{ui.taxable}<span className="inp"><input data-in="inc" inputMode="decimal" defaultValue="120000" dir="ltr" /><span>{ui.currency}</span></span></label>
                <div className="sm"><div><small>{tu.income}</small><b className="num" data-out="inc" suppressHydrationWarning /></div><div><small>{tu.effective}</small><b className="num" data-out="taxrate" suppressHydrationWarning /></div></div>
                <p className="nt">{tu.brackets}</p>
              </article>
              <article className="tc">
                <h3>{ft.tools[2].label}</h3>
                <div className="dial" data-bar="er"><div><small>{tu.employer}</small><b className="num" data-out="er" suppressHydrationWarning /></div></div>
                <label>{ft.cnss.salaryLabel}<span className="inp"><input data-in="sal" inputMode="decimal" defaultValue="5000" dir="ltr" /><span>{ui.currency}</span></span></label>
                <div className="sm"><div><small>{tu.employee}</small><b className="num" data-out="emp" suppressHydrationWarning /></div><div><small>{tu.cost}</small><b className="num" data-out="cost" suppressHydrationWarning /></div></div>
              </article>
              <article className="tc st-card">
                <h3>{tu.statusTitle}</h3>
                <div className="opt" role="group" aria-label={ft.statuts.title} style={{ gridAutoFlow: 'column', gridAutoColumns: '1fr' }}>
                  {ft.statuts.statuses.map((s, i) => <button type="button" key={s.name} data-st={i} aria-pressed={i === 0}>{s.name}</button>)}
                </div>
                {ft.statuts.statuses.map((s, i) => (
                  <dl key={s.name} data-st-panel={i} hidden={i !== 0}>
                    {[s.target, s.capital, s.liability, s.tax, s.governance].map((v, k) => (
                      <div key={k}><dt>{tu.statusRows[k]}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                ))}
              </article>
            </div>
            <p className="note">{ui.note}</p>
            <a className="all" href={L('/outils-fiscaux')}>{home.toolsSeeAll} <Ico n="arrow" /></a>
          </div>
        </section>

        {/* ===== ÉCHÉANCE ===== */}
        <section className="dl sheet">
          <div className="wrap g">
            <div className="stamp rv" aria-hidden="true"><small>{home.deadlineUi.due.toUpperCase()}</small><b className="num" data-dl="day">28</b><span data-dl="month" /></div>
            <div>
              <p className="eb">{home.calendarEyebrow}</p>
              <Title parts={lastWordTitle(home.calendarTitle)} />
              <p style={{ opacity: 0.8, maxWidth: '50ch' }}>{gl.deadline.text}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 18 }}>
                <button type="button" className="pill l" data-ics data-ics-title={home.deadlineUi.reminderTitle}><Ico n="bell" /> <span data-ics-label>{gl.deadline.short}</span></button>
                <a className="more" style={{ margin: 0 }} href={L('/outils-fiscaux#calendrier-fiscal')}>{home.calendarCta} <Ico n="arrow" /></a>
              </div>
            </div>
            <div className="cd">
              <div><b className="num" data-dl="d">--</b><small>{home.deadlineUi.days}</small></div>
              <div><b className="num" data-dl="h">--</b><small>{home.deadlineUi.hours}</small></div>
              <div><b className="num" data-dl="m">--</b><small>{home.deadlineUi.minutes}</small></div>
            </div>
          </div>
        </section>

        {/* ===== BLOG ===== */}
        <section className="blog sheet" id="blog">
          <div className="wrap">
            <div className="head">
              <div>
                <p className="eb">{home.blogEyebrow}</p>
                <Title parts={lastWordTitle(home.blogTitle)} />
              </div>
              <a className="more" href={L('/blog')}>{home.blogSeeAll} <Ico n="arrow" /></a>
            </div>
            <div className="bg">
              {home.posts.map((p) => (
                <article key={p[2]}>
                  <div className="im"><img src={p[0]} alt="" loading="lazy" width={800} height={450} /></div>
                  <div className="bd">
                    <span className="tg">{p[1]}</span>
                    <h3>{p[2]}</h3>
                    <p>{p[3]}</p>
                    <span className="mt">{p[4]}</span>
                    <a className="more" href={L('/blog')}>{home.blogUi.read} <Ico n="arrow" /></a>
                  </div>
                </article>
              ))}
            </div>
            <div className="nl">
              <div><b>{home.blogUi.newsletterTitle}</b><p>{home.blogUi.newsletterText}</p></div>
              <NewsletterForm placeholder={footer.newsletterPlaceholder} cta={footer.newsletterCta} success={footer.newsletterSuccess} />
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="faq sheet" id="faq">
          <div className="wrap g">
            <div>
              <p className="eb">{home.faqEyebrow}</p>
              <Title parts={lastWordTitle(home.faqTitle)} />
              <p className="s">{home.faqText}</p>
              <a className="more" href={L('/ressources')}>{home.faqSeeAll} <Ico n="arrow" /></a>
            </div>
            <div id="faqL" className="cm-faq">
              {home.faq.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary><span className="n num">{String(i + 1).padStart(2, '0')}</span><span className="q">{f.q}</span><i /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CONTACT ===== */}
        <section className="ct sheet" id="contact">
          <div className="wrap g">
            <div>
              <p className="eb">{home.contactEyebrow}</p>
              <Title parts={lastWordTitle(home.contactTitle)} />
              <p style={{ color: 'var(--mfg)', maxWidth: '44ch', margin: '18px 0 24px', lineHeight: 1.7 }}>{home.contactText}</p>
              <div id="infoL" className="cm-info">
                <a href="tel:+21698400368"><span className="ci"><Ico n="phone" /></span><span><small>{home.contactInfo.phoneLabel}</small><b dir="ltr">98 400 368</b></span></a>
                <a href="mailto:camcompta@planet.tn"><span className="ci"><Ico n="mail" /></span><span><small>{home.contactInfo.emailLabel}</small><b>camcompta@planet.tn</b></span></a>
                <a href="https://www.google.com/maps/search/?api=1&query=21+Rue+Iraq%2C+1001+Lafayette%2C+Tunis" target="_blank" rel="noopener noreferrer"><span className="ci"><Ico n="pin" /></span><span><small>{home.contactInfo.addressLabel}</small><b>{footer.address}</b></span></a>
                <div><span className="ci"><Ico n="clock" /></span><span><small>{home.contactInfo.hoursLabel}</small><b>{home.contactHours}</b></span></div>
              </div>
            </div>
            <form className="fm cm-form" id="formL" noValidate>
              <div className="fp"><span>{gl.form.progress}</span><i><b className="num">1</b> / 4</i></div>
              <div>
                <p className="lb" id="cmT" style={{ marginBottom: 8 }}>{requiredLabel(home.form.requestType)}</p>
                <div className="chips" role="group" aria-labelledby="cmT">
                  {home.requestCategories.map((c, i) => <button type="button" key={c} aria-pressed={i === 0}>{c}</button>)}
                </div>
              </div>
              <div className="two">
                <label className="lb">{requiredLabel(home.form.name)}<input required name="name" autoComplete="name" placeholder={home.form.namePlaceholder} /><span className="ck"><Ico n="check" /></span></label>
                <label className="lb">{requiredLabel(home.form.email)}<input required type="email" name="email" autoComplete="email" placeholder={home.form.emailPlaceholder} dir="ltr" /><span className="ck"><Ico n="check" /></span></label>
              </div>
              <label className="lb">{home.form.phone} <small>{home.form.phoneHint}</small><input type="tel" name="phone" autoComplete="tel" placeholder={'+216 ' + home.form.phonePlaceholder} dir="ltr" /><span className="ck"><Ico n="check" /></span></label>
              <label className="lb">{requiredLabel(home.form.message)}<textarea required name="message" maxLength={500} rows={3} placeholder={home.form.messagePlaceholder} /><small className="cnt num" /><span className="ck"><Ico n="check" /></span></label>
              <div>
                <p className="lb" id="cmP" style={{ marginBottom: 8 }}>{home.preferredContactLabel}</p>
                <div className="pref" role="group" aria-labelledby="cmP">
                  <button type="button" aria-pressed="true"><i />{home.preferredByPhone}</button>
                  <button type="button" aria-pressed="false"><i />{home.preferredByEmail}</button>
                </div>
              </div>
              <button className="send" type="submit"><span>{home.form.send}</span><Ico n="arrow" /></button>
              <p className="conf"><Ico n="lock" />{home.confidentialityNote}</p>
              <p className="req">{home.requiredNote}</p>
              <div className="okp" role="status" aria-live="polite">
                <div className="sp">{Array.from({ length: 10 }, (_, n) => <i key={n} style={{ ['--a' as string]: n * 36 + 'deg' }} />)}</div>
                <svg className="big" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" /><path d="M24 41l11 11 21-23" /></svg>
                <h3>{home.form.sent}</h3>
                <p data-okt />
                <button type="button" data-again>{gl.form.again}</button>
              </div>
            </form>
          </div>
        </section>

        {/* ===== APPEL FINAL ===== */}
        <section className="cta sheet" id="cta">
          <div className="disc" />
          <div className="wrap">
            <p className="eb l" style={{ justifyContent: 'center' }}>{home.ctaBand.eyebrow}</p>
            <Title style={{ marginTop: 20 }} parts={[home.ctaBand.titleLine1, 'br', home.ctaBand.titleLine2 + ' ', { em: home.ctaBand.titleHighlight }]} />
            <p>{home.ctaBand.text}</p>
            <a className="pill l" href="#contact">{home.ctaBand.button}</a>
            <p style={{ fontSize: '.84rem', marginTop: 22 }}>
              {home.ctaBand.callPrefix} <a href="tel:+21698400368" dir="ltr" style={{ textDecoration: 'underline' }}>+216 98 400 368</a> · {home.ctaBand.response}
            </p>
          </div>
        </section>
      </main>

      <CamconsultFooter lang={lang} home />
    </div>
  )
}
