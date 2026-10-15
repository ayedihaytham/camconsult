import HomePage from '@/components/home-page'
import { isLang } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { getPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return getPageMetadata((await params).lang, '')
}

export default async function HomeRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  return <HomePage lang={lang} />
}
