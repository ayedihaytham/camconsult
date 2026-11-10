import type { ReactNode } from 'react'

/** Petites briques de l'accueil « grand livre vivant » : icônes, titres animés mot à mot, maquettes de services. */

const PATHS: Record<string, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  check: <path d="m5 12 5 5 9-10" />,
  clip: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  ne: <path d="M7 7h10v10M7 17 17 7" />,
  shield: <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  insta: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  badge: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14.5-1.5 7 5-3 5 3-1.5-7" /></>,
  cert: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></>,
  spark: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
}

export function Ico({ n, className }: { n: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={'ico' + (className ? ' ' + className : '')} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[n]}
    </svg>
  )
}

/** Fragment de titre découpé en mots (chaque mot monte de son masque quand le titre entre à l'écran). */
function words(text: string, start: number, key: string) {
  const out: ReactNode[] = []
  let i = start
  text.split(/(\s+)/).forEach((w, k) => {
    if (!w) return
    if (/^\s+$/.test(w)) { out.push(' '); return }
    out.push(
      <span className="w" key={key + k}>
        <i style={{ ['--i' as string]: i++ }}>{w}</i>
      </span>,
    )
  })
  return { nodes: out, next: i }
}

export type TitlePart = string | { em: string } | 'br'

/** Titre animé : `parts` mêle du texte, des mots en italique (`{em}`) et des sauts de ligne (`'br'`). */
export function Title({ as: Tag = 'h2', parts, className, style }: { as?: 'h1' | 'h2' | 'h3'; parts: TitlePart[]; className?: string; style?: React.CSSProperties }) {
  let i = 0
  const nodes: ReactNode[] = parts.map((p, k) => {
    if (p === 'br') return <br key={k} />
    if (typeof p === 'string') { const r = words(p, i, 't' + k); i = r.next; return r.nodes }
    const r = words(p.em, i, 'e' + k)
    i = r.next
    return <em key={k}>{r.nodes}</em>
  })
  return <Tag className={'hs' + (className ? ' ' + className : '')} style={style}>{nodes}</Tag>
}

type Mocks = {
  ledger: { h: string; s: string; rows: string[][] }
  kpi: { h: string; s: string; r: string[] }
  cal: { h: string; s: string; r: string[] }
  audit: { h: string; s: string; rows: string[] }
  pay: { h: string; s: string; rows: string[][] }
  doc: { h: string; s: string; rows: string[] }
  act: { h: string; s: string; r: string }
  fin: { h: string; s: string; r: string[] }
}

const Row = ({ a, b }: { a: string; b: string }) => (
  <div className="mk-r"><span>{a}</span><i /><b className="num">{b}</b></div>
)
const Head = ({ h, s }: { h: string; s: string }) => <div className="mk-h"><b>{h}</b><small>{s}</small></div>

/** Les huit services ont six visuels : un « document » miniature par service. */
export function Mock({ k, m }: { k: string; m: Mocks }) {
  switch (k) {
    case 'kpi':
      return (<><Head h={m.kpi.h} s={m.kpi.s} /><div className="mk-bars">{[42, 58, 51, 74, 68, 92].map((h) => <i key={h} style={{ ['--h' as string]: h + '%' }} />)}</div><Row a={m.kpi.r[0]} b={m.kpi.r[1]} /></>)
    case 'cal':
      return (<><Head h={m.cal.h} s={m.cal.s} /><div className="mk-cal">{[7, 14, 21, 28].map((d) => <span key={d} className={d === 28 ? 'on' : undefined}>{d}</span>)}</div><Row a={m.cal.r[0]} b={m.cal.r[1]} /></>)
    case 'audit':
      return (<><Head h={m.audit.h} s={m.audit.s} />{m.audit.rows.map((t) => <Row key={t} a={t} b="✓" />)}</>)
    case 'pay':
      return (<><Head h={m.pay.h} s={m.pay.s} />{m.pay.rows.map((r) => <Row key={r[0]} a={r[0]} b={r[1]} />)}</>)
    case 'doc':
      return (<><Head h={m.doc.h} s={m.doc.s} />{m.doc.rows.map((t, i) => <Row key={t} a={t} b={i < 3 ? '✓' : '→'} />)}</>)
    case 'act':
      return (<><Head h={m.act.h} s={m.act.s} /><div className="mk-lines"><i /><i /><i style={{ width: '70%' }} /><i /><i style={{ width: '45%' }} /></div><Row a={m.act.r} b="✓" /></>)
    case 'fin':
      return (<><Head h={m.fin.h} s={m.fin.s} /><div className="mk-bars">{[30, 44, 63, 80].map((h) => <i key={h} style={{ ['--h' as string]: h + '%' }} />)}</div><Row a={m.fin.r[0]} b={m.fin.r[1]} /></>)
    default:
      return (<><Head h={m.ledger.h} s={m.ledger.s} />{m.ledger.rows.map((r) => <Row key={r[0]} a={r[0]} b={r[1]} />)}</>)
  }
}

export const SERVICE_MOCKS = ['ledger', 'kpi', 'cal', 'audit', 'pay', 'doc', 'act', 'fin']
