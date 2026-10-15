import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ContactPage } from '@/components/contact-page'
import { isLang, type Lang } from '@/lib/i18n'
import { getPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return getPageMetadata((await params).lang, '/contact')
}

export default async function ContactRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><ContactPage lang={lang} /><CamconsultFooter lang={lang} /></>
}
