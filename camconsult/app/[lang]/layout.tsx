import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { notFound } from 'next/navigation'
import { LOCALES, isLang, getDictionary } from '@/lib/i18n'
import { BackToTop } from '@/components/back-to-top'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const dict = getDictionary(isLang(lang) ? lang : 'fr')
  return { title: dict.meta.title, description: dict.meta.description, generator: 'v0.app' }
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#0B2545' }

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const dict = getDictionary(lang)

  return (
    <html lang={lang} dir={dir}>
      <body className={`${inter.variable} ${playfair.variable} antialiased`}>
        {children}
        <BackToTop label={dict.nav.backToTop} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
