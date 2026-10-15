import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { notFound } from 'next/navigation'
import { LOCALES, isLang, getDictionary } from '@/lib/i18n'
import { BackToTop } from '@/components/back-to-top'
import { ThemeToggle } from '@/components/theme-toggle'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import { SITE_INDEXABLE, SITE_URL, businessStructuredData } from '@/lib/seo'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'CAMCONSULT',
  robots: { index: SITE_INDEXABLE, follow: true },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
}

export const viewport: Viewport = { colorScheme: 'light dark', themeColor: '#E3E7E7' }

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const dict = getDictionary(lang)

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessStructuredData()).replace(/</g, '\\u003c') }}
        />
        {children}
        <ThemeToggle lang={lang} />
        <BackToTop label={dict.nav.backToTop} />
      </body>
    </html>
  )
}
