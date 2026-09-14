'use client'

import { ExternalLink, LockKeyhole } from 'lucide-react'
import { cn } from '@/lib/utils'

type ClientPortalLinkProps = {
  href?: string
  lang?: 'fr' | 'ar'
  compact?: boolean
}

const DEFAULT_CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://cabinet.camconsult.com.tn/login'

export function ClientPortalLink({ href = DEFAULT_CLIENT_PORTAL_URL, lang = 'fr', compact = false }: ClientPortalLinkProps) {
  const isArabic = lang === 'ar'
  const isExternal = /^https?:\/\//i.test(href)
  const label = isArabic ? 'فضاء العملاء' : 'Espace client'
  const tooltip = isArabic ? 'الوصول محجوز للعملاء' : 'Accès réservé aux clients'

  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      title={tooltip}
      aria-label={`${label} — ${tooltip}`}
      className={cn(
        'client-portal-link group inline-flex items-center gap-2 rounded-full border border-gold/70 bg-white/[0.06] text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-300 hover:border-gold hover:bg-gold hover:text-navy hover:shadow-[0_8px_22px_rgba(201,169,106,0.22)]',
        compact ? 'px-3 py-2 text-[10px] font-semibold tracking-[0.04em]' : 'px-4 py-2.5 text-xs font-semibold tracking-[0.04em]'
      )}
    >
      <LockKeyhole className="client-portal-lock size-3.5 shrink-0 transition-transform duration-300" aria-hidden="true" />
      <span>{label}</span>
      <ExternalLink className="size-3 shrink-0 opacity-65 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
    </a>
  )
}
