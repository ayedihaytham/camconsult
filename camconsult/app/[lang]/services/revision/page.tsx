import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ServiceDetailTemplate } from '@/components/service-templates'
import { isLang, type Lang } from '@/lib/i18n'

export default async function ServiceRevisionPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><ServiceDetailTemplate lang={lang} /><CamconsultFooter lang={lang} /></>
}
