import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { ContactPage } from '@/components/contact-page'

export default function ContactRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><ContactPage lang="fr" /><CamconsultFooter lang="fr" /></>
}
