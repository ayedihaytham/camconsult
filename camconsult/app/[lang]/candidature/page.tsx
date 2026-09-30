import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { CareersPage } from '@/components/careers-page'
import { isLang, type Lang } from '@/lib/i18n'

export default async function CandidatureRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><CareersPage lang={lang} /><CamconsultFooter lang={lang} /></>
}
