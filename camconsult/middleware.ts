import { NextRequest, NextResponse } from 'next/server'
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locales'

function detectLocale(request: NextRequest): string {
  const header = request.headers.get('accept-language')
  if (!header) return DEFAULT_LOCALE
  const preferred = header.split(',').map((part) => part.split(';')[0].trim().toLowerCase())
  for (const tag of preferred) {
    const base = tag.split('-')[0]
    if ((LOCALES as readonly string[]).includes(base)) return base
  }
  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) return NextResponse.next()

  const locale = detectLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|espace-client|icon\\.png|apple-icon\\.png|favicon|images|brand|.*\\..*).*)'],
}
