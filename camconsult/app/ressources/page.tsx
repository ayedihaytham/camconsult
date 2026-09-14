import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ResourcesPage } from '@/components/content-pages'

export default function ResourcesRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><ResourcesPage lang="fr" /><CamconsultFooter lang="fr" /></>
}
