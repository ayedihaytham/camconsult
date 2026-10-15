import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { FiscalToolsPage } from '@/components/fiscal-tools-page'
import { isLang, type Lang } from '@/lib/i18n'
import { getPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return getPageMetadata((await params).lang, '/outils-fiscaux')
}

export default async function FiscalToolsRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><FiscalToolsPage lang={lang} /><CamconsultFooter lang={lang} /></>
}
