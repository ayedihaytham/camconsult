import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ServicesTemplate } from '@/components/service-templates'
import { isLang, type Lang } from '@/lib/i18n'

export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><ServicesTemplate lang={lang} /><CamconsultFooter lang={lang} /></>
}
