import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ResourcesPage } from '@/components/content-pages'
import { isLang, type Lang } from '@/lib/i18n'
import { getPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return getPageMetadata((await params).lang, '/ressources')
}

export default async function ResourcesRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : 'fr'
  return <><CamconsultHeader lang={lang} theme="navy" /><ResourcesPage lang={lang} /><CamconsultFooter lang={lang} /></>
}
