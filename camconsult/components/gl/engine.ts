/**
 * Moteur de l'accueil « grand livre vivant » (maquette design/maquettes/01-site-vitrine.html).
 * Il n'écrit aucun contenu : la page React rend tout le HTML (lisible par les moteurs de recherche) ;
 * ici on ne fait qu'attacher les comportements (scènes au défilement, canevas du héros, pellicule des services,
 * ruban de chiffres, outils, échéance, FAQ, formulaire). Tout est défait par la fonction renvoyée.
 */

export type GlConfig = {
  locale: string
  /** true sur l'accueil : active les scènes au défilement ; sinon seuls les comportements simples sont posés. */
  home: boolean
  ledger: { labels: string[]; head: string[]; total: string; balance: string; debit: string; credit: string }
  openText: string
  closedText: string
  reminderAdded: string
  thanks: string
  orPhone: string
  /** Libellés des dossiers de la FAQ (aucun) — réservé. */
}

type El = HTMLElement

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
const pad = (n: number) => String(n).padStart(2, '0')

export function initGl(root: El, cfg: GlConfig): () => void {
  const cleanups: Array<() => void> = []
  let dead = false
  const $ = <T extends El = El>(s: string, r: ParentNode = root) => r.querySelector(s) as T | null
  const $$ = <T extends El = El>(s: string, r: ParentNode = root) => Array.from(r.querySelectorAll(s)) as T[]
  const on = (t: EventTarget, type: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions | boolean) => {
    t.addEventListener(type, fn, o)
    cleanups.push(() => t.removeEventListener(type, fn, o))
  }
  const raf = (fn: FrameRequestCallback) => requestAnimationFrame((t) => { if (!dead) fn(t) })
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = matchMedia('(pointer:fine)').matches
  const fmt = (v: number) => new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)
  const rtl = getComputedStyle(root).direction === 'rtl'

  /* ---------------- boucle de défilement : scènes + images ----------------
     La géométrie des scènes est mesurée une fois (et au redimensionnement) : pendant le défilement on ne lit plus la mise en page,
     on ne réécrit que ce qui a changé, et le défilement reste celui du navigateur (fluide, hors thread principal). */
  type Scene = { el: El; fn?: (p: number, el: El) => void; p: number; top: number; h: number }
  const scenes: Scene[] = []
  const frames: Array<() => void> = []
  let dirty = false
  let force = true
  let painted = -1
  let running = false
  let last = 0
  let vel = 0
  const scene = (el: El | null, fn?: Scene['fn']) => { if (el) scenes.push({ el, fn, p: -1, top: -1, h: 0 }) }
  const frame = (fn: () => void) => { frames.push(fn) }
  const measScenes = () => {
    const y = scrollY
    scenes.forEach((s) => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height; s.p = -1 })
  }
  const paint = () => {
    const y = scrollY
    const ih = innerHeight
    const moved = y !== painted || force
    if (!moved) { dirty = false; return }
    scenes.forEach((s) => {
      if (s.top < 0) { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height }
      const vis = s.top + s.h - y > -ih * 0.5 && s.top - y < ih * 1.5
      if (!vis && s.p >= 0) return
      const tot = s.h - ih
      const p = reduce ? 1 : tot > 0 ? clamp((y - s.top) / tot, 0, 1) : s.top - y < ih ? 1 : 0
      if (p === s.p) return
      s.p = p
      if (!s.el.hasAttribute('data-nop')) s.el.style.setProperty('--p', p.toFixed(4))
      s.fn?.(p, s.el)
    })
    frames.forEach((f) => f())
    dirty = false
    force = false
    painted = y
  }
  const loop = () => {
    if (dead) return
    if (dirty) paint()
    if (Date.now() - last < 160) raf(loop)
    else running = false
  }
  const kick = () => {
    last = Date.now()
    dirty = true
    if (!running) { running = true; raf(loop) }
  }
  const start = () => { force = true; paint(); const t = setTimeout(() => { force = true; paint() }, 120); cleanups.push(() => clearTimeout(t)); kick() }
  on(window, 'scroll', () => { if (scrollY !== painted) kick() }, { passive: true })
  on(window, 'resize', () => { force = true; measScenes(); kick() })

  /* ---------------- ancres (défilement natif) ---------------- */
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight
  const scrollToY = (y: number) => { scrollTo({ top: clamp(y, 0, maxScroll()), behavior: reduce ? 'auto' : 'smooth' }) }
  if (cfg.home) {
    let lastY = scrollY
    let vOn = false
    // vitesse de défilement (ruban de chiffres) : mesurée seulement pendant que la page bouge
    const v = () => {
      if (dead) return
      vel += (scrollY - lastY - vel) * 0.12
      lastY = scrollY
      if (Math.abs(vel) > 0.05 || scrollY !== painted) raf(v)
      else { vel = 0; vOn = false }
    }
    on(window, 'scroll', () => { if (!vOn) { vOn = true; raf(v) } }, { passive: true })
    on(root, 'click', (e) => {
      const a = (e.target as El).closest('a[href^="#"]') as HTMLAnchorElement | null
      if (!a || a.getAttribute('href') === '#') return
      const el = document.querySelector(a.getAttribute('href')!) as El | null
      if (!el) return
      e.preventDefault()
      scrollToY(el.getBoundingClientRect().top + scrollY)
    })
  }

  /* ---------------- ouvert / fermé (lun.–sam. 8h–17h, Tunis) ---------------- */
  const openNow = () => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tunis', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(new Date())
    const w = p.find((x) => x.type === 'weekday')!.value
    const h = +p.find((x) => x.type === 'hour')!.value % 24
    return w !== 'Sun' && h >= 8 && h < 17
  }
  const paintOpen = () => {
    const o = openNow()
    $$('[data-open]').forEach((e) => e.classList.toggle('closed', !o))
    $$('[data-open-txt]').forEach((e) => { e.textContent = o ? cfg.openText : cfg.closedText })
  }
  paintOpen()
  const openTimer = setInterval(paintOpen, 60000)
  cleanups.push(() => clearInterval(openTimer))

  /* ---------------- échéance TVA : le 28, 23 h 59 heure de Tunis ---------------- */
  let due = new Date()
  const nextDue = (n: Date) => {
    let d = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 28, 22, 59)
    if (d < n.getTime()) d = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 28, 22, 59)
    return new Date(d)
  }
  const paintDeadline = () => {
    const n = new Date()
    due = nextDue(n)
    const rem = Math.max(0, due.getTime() - n.getTime())
    const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(cfg.locale, { timeZone: 'Africa/Tunis', ...o }).format(due)
    const map: Record<string, string> = {
      month: f({ month: 'long' }), day: f({ day: 'numeric' }), weekday: f({ weekday: 'long' }),
      d: pad(Math.floor(rem / 864e5)), h: pad(Math.floor((rem % 864e5) / 36e5)), m: pad(Math.floor((rem % 36e5) / 6e4)),
    }
    $$('[data-dl]').forEach((e) => { e.textContent = map[e.getAttribute('data-dl')!] })
  }
  paintDeadline()
  const dlTimer = setInterval(paintDeadline, 30000)
  cleanups.push(() => clearInterval(dlTimer))
  $$('[data-ics]').forEach((b) =>
    on(b, 'click', () => {
      const st = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      const day = new Date(due.getTime() - 36e5)
      const ds = '' + day.getUTCFullYear() + pad(day.getUTCMonth() + 1) + pad(day.getUTCDate())
      const nx = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1))
      const de = '' + nx.getUTCFullYear() + pad(nx.getUTCMonth() + 1) + pad(nx.getUTCDate())
      const title = b.getAttribute('data-ics-title') || 'TVA'
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CAMCONSULT//Calendrier fiscal//FR', 'BEGIN:VEVENT', 'UID:tva-' + ds + '@camconsult', 'DTSTAMP:' + st(new Date()), 'DTSTART;VALUE=DATE:' + ds, 'DTEND;VALUE=DATE:' + de, 'SUMMARY:' + title, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
      const a = document.createElement('a')
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      a.href = url
      a.download = 'echeance-tva.ics'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      b.style.background = '#246549'
      b.style.color = '#fff'
      const lab = b.querySelector('[data-ics-label]')
      if (lab) lab.textContent = cfg.reminderAdded
    }),
  )

  /* ---------------- outils fiscaux : TVA 19/13/7 %, IS 0/20/35 %, CNSS 9 % / 16 %, statuts ---------------- */
  const tl = $('#tl')
  if (tl) {
    const S = { mode: 'ht', rate: 19, tva: '1000', inc: '120000', sal: '5000' } as Record<string, string | number>
    const num = (v: unknown) => Number(String(v).replace(',', '.')) || 0
    const paintTools = () => {
      const a = num(S.tva)
      const ht = S.mode === 'ht' ? a : a / (1 + (S.rate as number) / 100)
      const vat = (ht * (S.rate as number)) / 100
      const inc = num(S.inc)
      const tax = Math.max(0, Math.min(inc, 1e5) - 5e4) * 0.2 + Math.max(0, inc - 1e5) * 0.35
      const g = num(S.sal)
      const o: Record<string, string> = {
        ht: fmt(ht), vat: fmt(vat), ttc: fmt(ht + vat), rate: S.rate + ' %', inc: fmt(inc), tax: fmt(tax),
        taxrate: (inc ? (tax / inc) * 100 : 0).toFixed(1) + ' %', emp: fmt(g * 0.09), er: fmt(g * 0.16), cost: fmt(g * 1.16),
      }
      $$('[data-out]', tl).forEach((e) => { const k = e.getAttribute('data-out')!; if (k in o) e.textContent = o[k] })
      $$('[data-mode]', tl).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === S.mode)))
      $$('[data-rate]', tl).forEach((b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-rate')! === S.rate)))
      $$('[data-bar]', tl).forEach((e) => {
        const k = e.getAttribute('data-bar')
        const v = k === 'vat' ? vat / Math.max(ht + vat, 1) : k === 'tax' ? (inc ? tax / inc : 0) * 2 : k === 'er' ? 0.16 / 1.16 : 0
        e.style.setProperty('--k', clamp(v, 0, 1).toFixed(3))
      })
    }
    $$<HTMLInputElement>('[data-in]', tl).forEach((i) =>
      on(i, 'input', () => {
        i.value = i.value.replace(/[^\d.,]/g, '')
        S[i.getAttribute('data-in')!] = i.value
        paintTools()
      }),
    )
    on(tl, 'click', (e) => {
      const t = e.target as El
      const b = t.closest('[data-mode],[data-rate]')
      if (b) {
        if (b.hasAttribute('data-mode')) S.mode = b.getAttribute('data-mode')!
        else S.rate = +b.getAttribute('data-rate')!
        paintTools()
      }
      const st = t.closest('[data-st]') as El | null
      if (st) {
        const k = st.getAttribute('data-st')!
        $$('[data-st]', tl).forEach((x) => x.setAttribute('aria-pressed', String(x === st)))
        $$('[data-st-panel]', tl).forEach((x) => { x.hidden = x.getAttribute('data-st-panel') !== k })
      }
    })
    paintTools()
    const flash = (card: El | null) => {
      if (!card) return
      $$('.sm b,.dial b', card).forEach((b) => { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash') })
    }
    on(tl, 'input', (e) => { $$('.dial b', tl).forEach((b) => ((b as El & { _x?: number })._x = 1)); flash((e.target as El).closest('.tc')) })
    on(tl, 'click', (e) => { if ((e.target as El).closest('[data-mode],[data-rate]')) flash((e.target as El).closest('.tc')) })
  }

  /* ---------------- FAQ : ouverture animée ---------------- */
  const faqL = $('#faqL')
  if (faqL) {
    on(faqL, 'click', (e) => {
      const s = (e.target as El).closest('summary')
      if (!s) return
      e.preventDefault()
      const d = s.parentElement as HTMLDetailsElement
      const p = d.querySelector('p') as El
      if (reduce) { d.open = !d.open; return }
      const easing = 'cubic-bezier(.2,.8,.2,1)'
      if (d.open) {
        if (d.classList.contains('closing')) return
        const hh = p.offsetHeight
        d.classList.add('closing')
        const a = p.animate([{ height: hh + 'px', opacity: 1, paddingBottom: '24px' }, { height: '0px', opacity: 0, paddingBottom: '0px' }], { duration: 380, easing })
        a.onfinish = () => { d.open = false; d.classList.remove('closing') }
      } else {
        d.open = true
        const h2 = p.offsetHeight
        p.animate([{ height: '0px', opacity: 0, paddingBottom: '0px', transform: 'translateY(-8px)' }, { height: h2 + 'px', opacity: 1, paddingBottom: '24px', transform: 'none' }], { duration: 520, easing })
      }
    })
  }

  /* ---------------- formulaire : progression, validation vivante, confirmation animée ---------------- */
  const form = $<HTMLFormElement>('#formL')
  if (form) {
    const RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    form.noValidate = true
    const nm = $<HTMLInputElement>('[name=name]', form)!
    const em = $<HTMLInputElement>('[name=email]', form)!
    const ph = $<HTMLInputElement>('[name=phone]', form)
    const ta = $<HTMLTextAreaElement>('textarea', form)!
    const tl2 = ta.closest('label')!
    const cnt = $('.cnt', tl2)
    const num = $('.fp b', form)
    const rules: Array<[HTMLInputElement | HTMLTextAreaElement, (v: string) => boolean]> = [
      [nm, (v) => v.trim().length >= 2],
      [em, (v) => RX.test(v.trim())],
      [ta, (v) => v.trim().length >= 10],
    ]
    let lastN = 1
    const check = () => {
      let n = 1
      rules.forEach(([el, f]) => {
        const ok = f(el.value)
        const l = el.closest('label')!
        l.classList.toggle('ok', ok)
        if (ok) { l.classList.remove('bad'); n++ }
      })
      if (cnt) cnt.textContent = ta.value.length + ' / 500'
      form.style.setProperty('--fp', (n / 4).toFixed(2))
      if (num) {
        num.textContent = String(n)
        if (n !== lastN) {
          lastN = n
          const i = num.parentElement!
          i.classList.add('bump')
          setTimeout(() => i.classList.remove('bump'), 300)
        }
      }
    }
    on(form, 'input', check)
    check()
    on(form, 'click', (e) => {
      const t = e.target as El
      const chip = t.closest('.chips button')
      if (chip) { $$('.chips button', form).forEach((x) => x.setAttribute('aria-pressed', String(x === chip))); return }
      const pref = t.closest('.pref button')
      if (pref) $$('.pref button', form).forEach((x) => x.setAttribute('aria-pressed', String(x === pref)))
    })
    on(form, 'submit', (e) => {
      e.preventDefault()
      const bad = rules.filter(([el, f]) => !f(el.value))
      if (bad.length) {
        rules.forEach(([el]) => { const l = el.closest('label')!; l.classList.remove('bad'); void l.offsetWidth; if (bad.some((b) => b[0] === el)) l.classList.add('bad') })
        bad[0][0].focus()
        return
      }
      const first = nm.value.trim().split(/\s+/)[0]
      const t = $('[data-okt]', form)
      if (t) t.textContent = cfg.thanks.replace('{name}', first) + (ph && ph.value.trim() ? cfg.orPhone : '') + '.'
      form.classList.add('done')
      form.style.setProperty('--fp', '1')
    }, true)
    const again = $('[data-again]', form)
    if (again)
      on(again, 'click', () => {
        form.classList.remove('done')
        nm.value = ''; em.value = ''; if (ph) ph.value = ''; ta.value = ''
        const s = $('.send', form)
        if (s) s.classList.remove('ok')
        $$('label.lb', form).forEach((l) => l.classList.remove('ok', 'bad'))
        check()
      })
  }

  /* ---------------- boutons magnétiques ---------------- */
  if (fine && !reduce) {
    $$('.pill').forEach((b) => {
      on(b, 'pointermove', (e) => {
        const pe = e as PointerEvent
        const r = b.getBoundingClientRect()
        b.style.transform = `translate(${((pe.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px,${((pe.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px)`
      })
      on(b, 'pointerleave', () => { b.style.transform = '' })
    })
  }

  /* ---------------- apparitions (titres mot à mot, blocs, compteurs) ---------------- */
  const countUp = (el: El) => {
    const t = el.textContent || ''
    const n = parseFloat(t.replace(/[\s  ]/g, '').replace(',', '.'))
    if (!isFinite(n) || reduce) return
    const s = performance.now()
    const f = (now: number) => {
      if (dead || (el as El & { _x?: number })._x) return
      const k = clamp((now - s) / 1300, 0, 1)
      el.textContent = fmt(n * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf(f)
    }
    raf(f)
  }
  const sa: El[] = []
  const addSa = (sel: string, stepN = 1) => $$(sel).forEach((e, i) => { e.classList.add('sa'); e.style.setProperty('--d', (i * stepN).toFixed(1)); sa.push(e) })
  addSa('.tools .eb'); addSa('.tc', 1.4); addSa('.tools .note'); addSa('.tools .all')
  addSa('.faq .eb'); addSa('.faq p.s'); addSa('#faqL details', 0.8)
  addSa('.ct .eb'); addSa('.ct .g>div:first-child>p:not(.eb)'); addSa('#infoL>*', 1); addSa('.fm>*', 0.8)
  addSa('#nk button', 0.7); addSa('.tt .eb'); addSa('.tape .q'); addSa('.vol .eb'); addSa('.vol .cols div', 1)
  addSa('#cta .eb'); addSa('#cta p:not(.eb)'); addSa('#cta .pill'); addSa('.foot .cm-foot>div', 1); addSa('.foot .cm-foot-b'); addSa('.mg')
  addSa('.dl .eb'); addSa('.dl p,.dl [data-ics]'); addSa('.dl .cd div', 1)
  addSa('[data-sa]', 0.7)
  addSa('.blog .eb'); addSa('.blog article', 1.2); addSa('.blog .nl'); addSa('.trust div', 0.8)
  const io2 = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return
      const t = e.target as El
      t.classList.add('in')
      io2.unobserve(t)
      if (t.classList.contains('tc')) setTimeout(() => $$('.dial b', t).forEach(countUp), 300 + (+t.style.getPropertyValue('--d') || 0) * 90)
    })
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' })
  sa.concat($$('.hs')).forEach((e) => io2.observe(e))
  cleanups.push(() => io2.disconnect())
  const io3 = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io3.unobserve(e.target) }
    })
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' })
  $$('.rv').forEach((e) => io3.observe(e))
  cleanups.push(() => io3.disconnect())
  $$('[data-count]').forEach((e) => { e.textContent = e.getAttribute('data-count') })

  if (!cfg.home) {
    return () => { dead = true; cleanups.forEach((c) => c()) }
  }

  /* =====================================================================
     ACCUEIL : scènes au défilement
     ===================================================================== */
  const G: {
    secs?: number[][]; dark?: number[][]; hero?: number[]; diff?: number[]; ms?: number[]; msr?: number[]; ct?: number[]; vb?: number[]; sc?: number[]; tot?: number; cta?: number[]
  } = {}
  const hdr = $('.hdr')!
  const mnav = $('.mnav')
  const pr = $('.prog i')
  const fab = $('#fab')
  const hero = $('#hero')!
  const xa = $('#xa')!
  const xb = $('#xb')!
  let IPv = 0
  let DKv = 0
  if (mnav) {
    const mmo = new MutationObserver(() => { force = true; kick() })
    mmo.observe(mnav, { attributes: true, attributeFilter: ['class'] })
    cleanups.push(() => mmo.disconnect())
  }

  /* ---------- héros : le grand livre vivant (canevas) ---------- */
  const cv = $<HTMLCanvasElement>('#led')!
  const cx = cv.getContext('2d')!
  let W = 0, H = 0, DPR = 1, rows = 0, rowH = 34
  type Part = { t: string; gx: number; gy: number; al: CanvasTextAlign; b: number; cx: number; cy: number; cs: number; rot: number; ph: number; sp: number; ca: number; cls: string; gs: number }
  let parts: Part[] = []
  let noise: Array<{ t: string; x: number; y: number; s: number; rot: number; ph: number; sp: number; a: number }> = []
  let gx = { x0: 0, x1: 0, y0: 0, lab: 0, deb: 0, cre: 0, w: 0 }
  const mouse = { x: -999, y: -999, t: 0 }
  let oAuto = 0
  let heroO = 0
  const t0 = performance.now()
  let heroVis = true
  let oNow = 0
  const rng = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const LAB = cfg.ledger.labels
  const build = () => {
    const r = rng(20261107)
    parts = []; noise = []
    let totD = 0, totC = 0
    const narrow = W < 900
    rowH = H < 700 ? 28 : 34
    const h1 = $('.la h1')!
    const rg = document.createRange()
    rg.selectNodeContents(h1)
    const cbr = cv.getBoundingClientRect()
    const ox = cbr.left
    const hr = Math.max(rg.getBoundingClientRect().right, xa.getBoundingClientRect().right) - ox
    let x0 = narrow ? W * 0.07 : Math.min(Math.max(W * 0.5, hr + W * 0.04), W * 0.66)
    let x1 = narrow ? W * 0.93 : W * 0.88
    let y0 = H * 0.22
    const cb = cbr.top
    if (narrow) {
      y0 = h1.getBoundingClientRect().bottom - cb + rowH * 1.9
      const yb = xa.getBoundingClientRect().top - cb - rowH * 0.6
      rows = Math.max(3, Math.min(10, Math.floor((yb - y0 - rowH * 2.7) / rowH)))
    } else rows = Math.max(5, Math.min(16, Math.floor((H * 0.5) / rowH)))
    if (rtl && !narrow) {
      // lecture de droite à gauche : le titre est à droite, le grand livre se pose à gauche
      const hl = Math.min(rg.getBoundingClientRect().left, xa.getBoundingClientRect().left) - ox
      x0 = W * 0.06
      x1 = Math.max(W * 0.3, Math.min(W * 0.5, hl - W * 0.04))
    }
    gx = { x0, x1, y0, lab: x0, deb: x0 + (x1 - x0) * (narrow ? 0.66 : 0.74), cre: x1, w: x1 - x0 }
    const add = (txt: string, gxp: number, gyp: number, align: CanvasTextAlign, bold: number, cls?: string) =>
      parts.push({ t: txt, gx: gxp, gy: gyp, al: align, b: bold, cx: r() * W, cy: r() * H, cs: 12 + r() * 34, rot: (r() - 0.5) * 2.4, ph: r() * 6.28, sp: 0.3 + r() * 0.6, ca: 0.1 + r() * 0.22, cls: cls || 'n', gs: H < 700 ? 12 : 14 })
    add(cfg.ledger.head[0], gx.lab, y0 - rowH * 0.9, 'left', 1, 'h'); add(cfg.ledger.head[1], gx.deb, y0 - rowH * 0.9, 'right', 1, 'h'); add(cfg.ledger.head[2], gx.cre, y0 - rowH * 0.9, 'right', 1, 'h')
    for (let i = 0; i < rows; i++) {
      const y = y0 + i * rowH
      const deb = r() > 0.45
      const amt = Math.round((40 + r() * 3200) * 100) / 100
      add(LAB[(r() * LAB.length) | 0] + ' ' + (1000 + ((r() * 8999) | 0)), gx.lab, y, 'left', 0)
      add(deb ? fmt(amt) : '', gx.deb, y, 'right', 1); add(deb ? '' : fmt(amt), gx.cre, y, 'right', 1)
      if (deb) totD += amt; else totC += amt
    }
    const yt = y0 + rows * rowH + rowH * 0.5
    add(cfg.ledger.total, gx.lab, yt, 'left', 1, 't'); add(fmt(totD), gx.deb, yt, 'right', 1, 't'); add(fmt(totC), gx.cre, yt, 'right', 1, 't')
    const bal = totD - totC
    add(cfg.ledger.balance, gx.lab, yt + rowH, 'left', 1, 's'); add(fmt(Math.abs(bal)) + ' ' + (bal >= 0 ? cfg.ledger.debit : cfg.ledger.credit), gx.cre, yt + rowH, 'right', 1, 's')
    const syms = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '%', '+', '−', '×', '÷', ',', '00', '19', '7', '13']
    for (let k = 0; k < (narrow ? 26 : 56); k++) noise.push({ t: syms[(r() * syms.length) | 0], x: r() * W, y: r() * H, s: 14 + r() * 70, rot: (r() - 0.5) * 1.6, ph: r() * 6.28, sp: 0.2 + r() * 0.5, a: 0.05 + r() * 0.18 })
  }
  const dark = () => document.documentElement.classList.contains('dark')
  const draw = (o: number) => {
    oNow = o
    const t = (performance.now() - t0) / 1000
    const inv = 1 - o
    cx.clearRect(0, 0, W, H)
    cx.textBaseline = 'middle'
    const ink = dark() ? '#E6EBEF' : '#0B2545'
    const ruleC = dark() ? '#3B5268' : '#CBD3D8'
    const headC = dark() ? '#AAC5DF' : '#285378'
    if (inv > 0.02)
      noise.forEach((n) => {
        const x = n.x + Math.sin(t * n.sp + n.ph) * 30 * inv
        const y = n.y + Math.cos(t * n.sp * 0.8 + n.ph) * 24 * inv
        cx.save(); cx.translate(x, y); cx.rotate(n.rot * inv); cx.globalAlpha = n.a * inv * inv; cx.fillStyle = ink
        setFont('600 ' + Math.round(n.s) + 'px Inter, system-ui, sans-serif'); cx.textAlign = 'center'; cx.fillText(n.t, 0, 0); cx.restore()
      })
    const ra = clamp((o - 0.5) * 2, 0, 1)
    if (ra > 0) {
      cx.save(); cx.globalAlpha = ra * 0.55; cx.strokeStyle = ruleC; cx.lineWidth = 1
      for (let i = 0; i <= rows; i++) {
        const y = gx.y0 + i * rowH - rowH / 2
        const xe = gx.x0 + gx.w * ease(clamp(ra * 1.4 - i * 0.03, 0, 1))
        cx.beginPath(); cx.moveTo(gx.x0 - 10, y); cx.lineTo(xe, y); cx.stroke()
      }
      cx.strokeStyle = '#35658D'; cx.beginPath(); cx.moveTo(gx.deb - gx.w * 0.3 - 10, gx.y0 - rowH * 1.4); cx.lineTo(gx.deb - gx.w * 0.3 - 10, gx.y0 + rows * rowH - rowH / 2); cx.stroke()
      const yt = gx.y0 + rows * rowH + rowH * 0.5
      cx.strokeStyle = ink; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(gx.x0 - 10, yt - rowH / 2); cx.lineTo(gx.x0 - 10 + (gx.w + 10) * ra, yt - rowH / 2); cx.stroke()
      const ys = yt + rowH * 1.5
      cx.strokeStyle = '#246549'; cx.lineWidth = 1.2
      ;[0, 4].forEach((d) => { cx.beginPath(); cx.moveTo(gx.cre - gx.w * 0.42, ys + d); cx.lineTo(gx.cre - gx.w * 0.42 + gx.w * 0.42 * ra, ys + d); cx.stroke() })
      cx.restore()
    }
    const e = ease(o)
    parts.forEach((p) => {
      if (!p.t) return
      let x = lerp(p.cx + Math.sin(t * p.sp + p.ph) * 26 * inv, p.gx, e)
      let y = lerp(p.cy + Math.cos(t * p.sp * 0.8 + p.ph) * 20 * inv, p.gy, e)
      const s = lerp(p.cs, p.gs, e)
      const rot = p.rot * inv * (1 - e * 0.2)
      const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy)
      if (d < 150 && d > 0) { const f = Math.pow(1 - d / 150, 2) * (36 * (0.35 + 0.65 * inv)); x += (dx / d) * f; y += (dy / d) * f }
      const a = lerp(p.ca, p.cls === 'h' ? 0.7 : p.cls === 'n' ? 0.78 : 0.95, e)
      cx.save(); cx.translate(x, y); cx.rotate(rot); cx.globalAlpha = a
      cx.fillStyle = p.cls === 's' ? (e > 0.95 ? '#4FA27A' : headC) : p.cls === 'h' ? headC : ink
      if (p.cls === 's' && e > 0.95 && !dark()) cx.fillStyle = '#246549'
      setFont((p.cls === 'h' ? '700 ' : p.b ? '600 ' : '500 ') + Math.round(s * 2) / 2 + 'px Inter, system-ui, sans-serif')
      cx.textAlign = p.al; cx.fillText(p.t, 0, 0); cx.restore()
    })
  }
  let curFont = ''
  const setFont = (f: string) => { if (f !== curFont) { cx.font = f; curFont = f } }
  let heroRunning = false
  const heroLoop = () => {
    if (!heroVis) { heroRunning = false; return }
    const o = Math.max(heroO, oAuto)
    draw(o)
    if (o < 0.985 || performance.now() - mouse.t < 900) raf(heroLoop)
    else heroRunning = false
  }
  const heroKick = () => { if (!heroRunning) { heroRunning = true; raf(heroLoop) } }
  const sizeCanvas = () => {
    meas()
    const s = cv.parentElement!.getBoundingClientRect()
    DPR = Math.min(1.5, devicePixelRatio || 1)
    W = s.width; H = s.height
    cv.width = W * DPR; cv.height = H * DPR
    curFont = ''
    cx.setTransform(DPR, 0, 0, DPR, 0, 0)
    build(); draw(oNow)
  }
  on(cv.parentElement!, 'pointermove', (e) => {
    const pe = e as PointerEvent
    const r = cv.getBoundingClientRect()
    mouse.x = pe.clientX - r.left; mouse.y = pe.clientY - r.top; mouse.t = performance.now(); heroKick()
  })
  on(cv.parentElement!, 'pointerleave', () => { mouse.x = mouse.y = -999 })
  const roHero = new ResizeObserver(sizeCanvas)
  roHero.observe(cv.parentElement!)
  cleanups.push(() => roHero.disconnect())
  ;(() => {
    const s = performance.now()
    const st = (t: number) => {
      const k = clamp((t - s - 350) / 2300, 0, 1)
      oAuto = ease(k); heroKick()
      if (k < 1) raf(st)
    }
    if (reduce) oAuto = 1
    raf(st)
  })()
  const ioHero = new IntersectionObserver((es) => { heroVis = es[0].isIntersecting; if (heroVis) heroKick() })
  ioHero.observe(hero)
  cleanups.push(() => ioHero.disconnect())
  // un changement de thème redessine le canevas
  const mo = new MutationObserver(() => { draw(oNow) })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  cleanups.push(() => mo.disconnect())

  const keys = $$('.lyb .keys i')
  scene(hero, (p) => {
    if (!heroO) { heroO = 1; heroKick() }
    const ip = ease(seg(p, 0, 0.8))
    IPv = ip
    hero.style.setProperty('--ip', ip.toFixed(3))
    const hs = ip < 0.004 ? '0' : ip > 0.996 ? '1' : 'm'
    if (hero.dataset.ip !== hs) hero.dataset.ip = hs
    const open = ip > 0.9
    if (open) { xa.setAttribute('inert', ''); xb.removeAttribute('inert') } else { xb.setAttribute('inert', ''); xa.removeAttribute('inert') }
    keys.forEach((k, i) => k.style.setProperty('--k', ease(seg(p, 0.45 + i * 0.07, 0.85 + i * 0.04)).toFixed(3)))
  })

  /* ---------- services : pellicule fluide + touches ---------- */
  const SC = $$('.sc')
  const tr = $('#track')!
  const sv = $('#services')!
  const NK = $$('#nk button')
  const TR = $('.tr')!
  const scnt = $('#scnt')
  const SCI = SC.map((c) => c.querySelector('.mkw .in') as El)
  let pinned: string | null = null
  let actI = -1
  const MOB = () => innerWidth < 900
  const setAct = (b: number) => { if (b === actI) return; actI = b; SC.forEach((c, i) => c.classList.toggle('act', i === b)) }
  const svUpdate = () => {
    let best = 0, bd = 1e9
    const ds = SC.map((c) => { const r = c.getBoundingClientRect(); return (r.left + r.width / 2 - innerWidth / 2) / innerWidth })
    ds.forEach((d, i) => { if (Math.abs(d) < bd) { bd = Math.abs(d); best = i } })
    const curK = SC[best].dataset.c
    NK.forEach((b) => b.setAttribute('aria-pressed', String(pinned ? b.dataset.k === pinned : b.dataset.k === curK)))
    if (scnt) scnt.textContent = pad(best + 1) + ' / ' + pad(SC.length)
    setAct(best)
    SC.forEach((c) => { const dim = pinned && c.dataset.c !== pinned; c.style.opacity = MOB() ? (dim ? '.35' : '1') : '' })
  }
  on(TR, 'scroll', () => { if (MOB()) svUpdate() }, { passive: true })
  const sbar = $('.sprog .bar i')
  const svLast = SC.map(() => ({ t: '', o: '', i: '' }))
  let svBest = -1
  scene(sv, (p) => {
    if (sbar) sbar.style.setProperty('--p', p.toFixed(3))
    if (MOB()) { tr.style.transform = ''; svUpdate(); return }
    if (!G.sc) return
    const tot = G.tot || 0
    tr.style.transform = 'translate3d(' + (-p * tot).toFixed(1) + 'px,0,0)'
    let best = 0, bd = 1e9
    SC.forEach((c, i) => {
      const d = (G.sc![i] - p * tot - innerWidth / 2) / innerWidth
      const ad = Math.min(Math.abs(d), 1)
      const dim = pinned && c.dataset.c !== pinned
      const t = 'scale(' + (1 - 0.12 * ad).toFixed(3) + ') translateY(' + (ad * 26).toFixed(0) + 'px)'
      const o = dim ? '.28' : (1 - ad * 0.25).toFixed(2)
      const ti = 'translateX(' + (clamp(d * 1.4, -1, 1) * -14).toFixed(0) + 'px)'
      const L = svLast[i]
      if (t !== L.t) { c.style.transform = t; L.t = t }
      if (o !== L.o) { c.style.opacity = o; L.o = o }
      if (ti !== L.i) { SCI[i].style.transform = ti; L.i = ti }
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = i }
    })
    if (best !== svBest) {
      svBest = best
      const curK = SC[best].dataset.c
      NK.forEach((b) => b.setAttribute('aria-pressed', String(pinned ? b.dataset.k === pinned : b.dataset.k === curK)))
      if (scnt) scnt.textContent = pad(best + 1) + ' / ' + pad(SC.length)
      setAct(best)
    }
  })
  NK.forEach((b) =>
    on(b, 'click', () => {
      const k = b.dataset.k!
      pinned = pinned === k ? null : k
      if (pinned && MOB()) {
        const f = SC.filter((c) => c.dataset.c === k)[0]
        TR.scrollTo({ left: f.offsetLeft - (innerWidth - f.offsetWidth) / 2, behavior: 'smooth' })
        svUpdate()
        return
      }
      if (pinned) {
        let idx = 0
        SC.some((c, i) => { if (c.dataset.c === k) { idx = i; return true } return false })
        const total = tr.scrollWidth - innerWidth
        const c = SC[idx]
        const pc = (c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2) / total
        const tot = sv.offsetHeight - innerHeight
        scrollToY(sv.offsetTop + tot * clamp(pc, 0, 1))
      }
      start()
    }),
  )

  /* ---------- ruban de chiffres : vitesse liée au défilement ---------- */
  const mq = $('#mq')!
  let mx = 0, dir = -1, mqVis = true, hw = 0
  const ioMq = new IntersectionObserver((es) => { mqVis = es[0].isIntersecting })
  ioMq.observe($('#bilan')!)
  cleanups.push(() => ioMq.disconnect())
  const mqLoop = () => {
    if (dead) return
    if (mqVis) {
      hw = hw || mq.scrollWidth / 2
      const v = vel
      if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1
      mx += dir * (reduce ? 0 : 0.5 + Math.min(Math.abs(v), 60) * 0.4)
      if (mx < -hw) mx += hw
      if (mx > 0) mx -= hw
      mq.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,0,0) skewX(' + clamp(-v * 0.12, -9, 9).toFixed(2) + 'deg)'
    }
    raf(mqLoop)
  }
  raf(mqLoop)

  /* ---------- différence : volet ---------- */
  const diff = $('#diff')!
  scene(diff, (p) => { DKv = ease(seg(p, 0.12, 0.88)); diff.style.setProperty('--k', DKv.toFixed(4)) })

  /* ---------- méthode : numéro collant ---------- */
  const MN = $$('#mn b')
  const MS = $$('#ms article')
  const mnEl = $('#mn')!
  const msEl = $('#ms')!
  let curM = -1
  frame(() => {
    if (!G.ms || !G.msr) return
    const c = scrollY + innerHeight * 0.5
    let best = 0, bd = 1e9
    G.ms.forEach((m, i) => { const d = Math.abs(m - c); if (d < bd) { bd = d; best = i } })
    if (best !== curM) { curM = best; MN.forEach((b, i) => b.classList.toggle('on', i === best)); MS.forEach((a, i) => a.classList.toggle('on', i === best)) }
    mnEl.style.setProperty('--mp', clamp((c - G.msr[0]) / (G.msr[1] - G.msr[0]), 0, 1).toFixed(3))
  })

  /* ---------- rail, navigation, en-tête ---------- */
  const SECS: Array<[string, string]> = [['hero', ''], ['services', ''], ['bilan', ''], ['diff', ''], ['methode', ''], ['outils', ''], ['faq', ''], ['contact', '']]
  const RA = $$('#rail a')
  const railEl = $('#rail')!
  const NL = $$('#cnav a')
  const ind = $('#cnav .ind')
  const NM: Record<string, string> = { hero: 'hero', bilan: 'bilan', diff: 'bilan', services: 'services', methode: 'services', outils: 'outils', faq: 'faq', contact: '' }
  let actN = ''
  let curSec = ''
  let lastScroll = 0
  const placeInd = (a: El | undefined) => {
    if (!ind) return
    if (!a) { ind.style.opacity = '0'; return }
    ind.style.opacity = '1'; ind.style.width = a.offsetWidth + 'px'; ind.style.transform = 'translateX(' + a.offsetLeft + 'px)'
  }
  NL.forEach((a) => on(a, 'pointerenter', () => placeInd(a)))
  const cnav = $('#cnav')
  if (cnav) on(cnav, 'pointerleave', () => placeInd(NL.filter((a) => a.dataset.n === actN)[0]))

  const meas = () => {
    measScenes()
    const y = scrollY
    const g = (el: El) => { const r = el.getBoundingClientRect(); return [r.top + y, r.bottom + y] }
    G.secs = SECS.map((s) => { const el = document.getElementById(s[0]); return el ? g(el) : [0, 0] })
    G.dark = ['#services', '.dl', '#cta', '.foot'].map((q) => { const el = $(q); return el ? g(el) : [0, 0] })
    G.hero = G.secs[0]; G.diff = G.secs[3]
    G.ms = MS.map((a) => { const r = g(a); return (r[0] + r[1]) / 2 })
    G.msr = g(msEl)
    G.ct = g($('#contact')!)
    G.vb = g($('.vb')!)
    G.sc = SC.map((c) => c.offsetLeft + c.offsetWidth / 2)
    G.tot = Math.max(0, tr.scrollWidth - innerWidth)
    G.cta = g($('#cta')!)
  }
  const isDark = (yv: number, x: number) => {
    const y = scrollY + yv
    if (dark()) return true
    if (y >= G.hero![0] && y < G.hero![1]) return IPv > 0.5
    if (y >= G.diff![0] && y < G.diff![1]) return innerWidth < 900 ? y >= G.vb![0] && y < G.vb![1] : x < DKv * innerWidth
    return G.dark!.some((d) => y >= d[0] && y < d[1])
  }
  const cta = $('#cta')!
  let lastIo = ''
  let lastSp = ''
  frame(() => {
    if (!G.secs) return
    const y = scrollY
    const mid = y + innerHeight * 0.5
    let curId = SECS[0][0]
    SECS.forEach((s, i) => { if (G.secs![i][0] < mid) curId = s[0] })
    if (curId !== curSec) {
      curSec = curId
      RA.forEach((a) => a.classList.toggle('on', a.dataset.s === curId))
      actN = NM[curId] || ''
      NL.forEach((a) => a.classList.toggle('on', a.dataset.n === actN))
      placeInd(NL.filter((a) => a.dataset.n === actN)[0])
    }
    const io = clamp(1 - (G.cta![0] - y) / innerHeight, 0, 1).toFixed(2)
    if (io !== lastIo) { lastIo = io; cta.style.setProperty('--io', io) }
    const menu = !!mnav && mnav.classList.contains('open')
    const dk = isDark(40, innerWidth / 2)
    hdr.classList.toggle('iv', menu || dk)
    hdr.classList.toggle('cmp', y > 80)
    const dy = y - lastScroll
    lastScroll = y
    void dy
    const mm = document.documentElement.scrollHeight - innerHeight
    const sp = (mm > 0 ? y / mm : 0).toFixed(3)
    if (sp !== lastSp) { lastSp = sp; hdr.style.setProperty('--sp', sp) }
    railEl.classList.toggle('lt', !isDark(innerHeight * 0.5, innerWidth - 18))
    if (fab) fab.classList.toggle('on', G.hero![1] - y < innerHeight * 0.35 && !(G.ct![0] - y < innerHeight * 0.6 && G.ct![1] - y > 0))
  })

  meas()
  const roBody = new ResizeObserver(() => { meas(); start() })
  roBody.observe(document.body)
  cleanups.push(() => roBody.disconnect())
  on(window, 'load', () => { meas(); start() })
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) { sizeCanvas(); meas() } })
  start()
  sizeCanvas()

  return () => { dead = true; cleanups.forEach((c) => c()) }
}
