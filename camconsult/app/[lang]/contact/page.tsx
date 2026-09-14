import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ContactPage } from '@/components/contact-page'
import { isLang, type Lang } from '@/lib/i18n'

export default async function ContactRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><ContactPage lang={lang} /><CamconsultFooter lang={lang} /></>
}
