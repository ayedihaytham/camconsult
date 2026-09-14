import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { LegalPages } from '@/components/legal-pages'
import { isLang, type Lang } from '@/lib/i18n'

export default async function PrivacyRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><LegalPages lang={lang} initialPage="privacy" /><CamconsultFooter lang={lang} /></>
}
