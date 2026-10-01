'use client'

import { ExternalLink, LockKeyhole } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDictionary, type Lang } from '@/lib/i18n'

type ClientPortalLinkProps = {
  href?: string
  lang?: Lang
  compact?: boolean
}

const DEFAULT_CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://cabinet.camconsult.com.tn/login'

export function ClientPortalLink({ href = DEFAULT_CLIENT_PORTAL_URL, lang = 'fr', compact = false }: ClientPortalLinkProps) {
  const { clientPortal } = getDictionary(lang)
  const isExternal = /^https?:\/\//i.test(href)

  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      title={clientPortal.tooltip}
      aria-label={`${clientPortal.label} — ${clientPortal.tooltip}`}
      className={cn(
        'client-portal-link group inline-flex items-center gap-2 transition-all duration-300',
        compact
          ? 'text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70 hover:text-white'
          : 'rounded-lg border border-gold bg-transparent px-4 py-3 text-xs font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-navy'
      )}
    >
      <LockKeyhole className={cn('client-portal-lock size-3.5 shrink-0 transition-transform duration-300', compact && 'text-gold')} aria-hidden="true" />
      <span>{clientPortal.label}</span>
      {!compact && <ExternalLink className="size-3 shrink-0 opacity-65 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />}
    </a>
  )
}
