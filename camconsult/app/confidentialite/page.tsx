import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { LegalPages } from '@/components/legal-pages'

export default function PrivacyRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><LegalPages lang="fr" initialPage="privacy" /><CamconsultFooter lang="fr" /></>
}
