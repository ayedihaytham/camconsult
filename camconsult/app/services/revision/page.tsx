import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ServiceDetailTemplate } from '@/components/service-templates'

export default function ServiceRevisionPage() {
  return <><CamconsultHeader lang="fr" theme="navy" /><ServiceDetailTemplate lang="fr" serviceTitle="Révision comptable & commissariat aux comptes" /><CamconsultFooter lang="fr" /></>
}
