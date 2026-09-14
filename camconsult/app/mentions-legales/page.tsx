import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { LegalPages } from '@/components/legal-pages'

export default function LegalMentionsRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><LegalPages lang="fr" initialPage="mentions" /><CamconsultFooter lang="fr" /></>
}
