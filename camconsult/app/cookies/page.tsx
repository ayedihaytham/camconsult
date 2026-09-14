import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { LegalPages } from '@/components/legal-pages'

export default function CookiesRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><LegalPages lang="fr" initialPage="cookies" /><CamconsultFooter lang="fr" /></>
}
