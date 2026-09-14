import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { FiscalToolsPage } from '@/components/fiscal-tools-page'

export default function FiscalToolsRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><FiscalToolsPage /><CamconsultFooter lang="fr" /></>
}
