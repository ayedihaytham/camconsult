import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'
import { BlogPage } from '@/components/content-pages'

export default function BlogRoute() {
  return <><CamconsultHeader lang="fr" theme="navy" /><BlogPage lang="fr" /><CamconsultFooter lang="fr" /></>
}
