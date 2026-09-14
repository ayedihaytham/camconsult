import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ServicesTemplate } from '@/components/service-templates'

export default function ServicesPage() {
  return <><CamconsultHeader lang="fr" theme="navy" /><ServicesTemplate lang="fr" /><CamconsultFooter lang="fr" /></>
}
