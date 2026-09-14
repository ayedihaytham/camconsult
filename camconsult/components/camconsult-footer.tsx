'use client'

import { ArrowRight, Globe2, Mail, Phone, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientPortalLink } from '@/components/client-portal-link'

export type CamconsultFooterProps = {
  lang?: 'fr' | 'ar'
  clientPortalUrl?: string
}

const navigation = [
  { fr: 'Accueil', ar: 'الرئيسية', href: '/' },
  { fr: 'À propos', ar: 'من نحن', href: '/#a-propos' },
  { fr: 'Services', ar: 'الخدمات', href: '/services' },
  { fr: 'Outils fiscaux', ar: 'الأدوات الضريبية', href: '/outils-fiscaux' },
  { fr: 'Blog', ar: 'المدونة', href: '/blog' },
  { fr: 'Ressources', ar: 'الموارد', href: '/ressources' },
  { fr: 'Contact', ar: 'اتصل بنا', href: '/contact' },
]

const services = [
  { fr: 'Expertise comptable', ar: 'الخبرة المحاسبية' },
  { fr: 'Conseil & stratégie', ar: 'الاستشارة والاستراتيجية' },
  { fr: 'Audit & conformité', ar: 'التدقيق والامتثال' },
  { fr: 'Fiscalité', ar: 'الاستشارات الضريبية' },
  { fr: 'Paie & RH', ar: 'الرواتب والموارد البشرية' },
  { fr: 'Juridique', ar: 'الاستشارات القانونية' },
  { fr: 'Création d’entreprise', ar: 'إنشاء الشركات' },
  { fr: 'Finance d’entreprise', ar: 'تمويل الشركات' },
]

const legal = [
  { fr: 'Mentions légales', ar: 'الإشعارات القانونية', href: '/mentions-legales' },
  { fr: 'Confidentialité', ar: 'الخصوصية', href: '/confidentialite' },
  { fr: 'CGU', ar: 'شروط الاستخدام', href: '/cgu' },
  { fr: 'Cookies', ar: 'ملفات تعريف الارتباط', href: '/cookies' },
]

export function CamconsultFooter({ lang = 'fr', clientPortalUrl }: CamconsultFooterProps) {
  const isArabic = lang === 'ar'
  const text = (item: { fr: string; ar: string }) => isArabic ? item.ar : item.fr

  return (
    <footer id="contact" dir={isArabic ? 'rtl' : 'ltr'} className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="grid gap-12 border-b border-white/15 pb-14 lg:grid-cols-[1.35fr_0.8fr_1.15fr_1.15fr] lg:gap-10">
          <div>
            <a href="#accueil" className="inline-flex items-center gap-3 text-white" aria-label="CAMCONSULT">
              <span className="grid size-11 place-items-center"><img src="/brand/logo-mark-dark.png" alt="CAMCONSULT" className="size-9 object-contain" /></span>
              <span className="text-sm font-semibold tracking-[0.28em]">CAMCONSULT</span>
            </a>
            <p className="mt-6 max-w-xs text-sm leading-7 text-white/65">{isArabic ? 'الخبرة المحاسبية والاستشارات الاستراتيجية لخدمة طموحاتكم.' : 'L’expertise comptable et le conseil stratégique au service de vos ambitions.'}</p>
            <div className="mt-7 flex items-center gap-2">
              {[{ label: 'LinkedIn', icon: Globe2 }, { label: 'Site web', icon: Globe2 }, { label: 'Avis clients', icon: ShieldCheck }].map(({ label, icon: Icon }) => <a key={label} href="#reseaux" aria-label={label} className="grid size-9 place-items-center rounded-full border border-white/20 text-white/65 transition-colors duration-200 hover:border-gold hover:text-gold"><Icon className="size-4" /></a>)}
            </div>
          </div>

          <div><h2 className="footer-heading">{isArabic ? 'Navigation' : 'Navigation'}</h2><nav className="mt-6 flex flex-col items-start gap-3">{navigation.map((item) => <a key={item.href} href={item.href} className="footer-link">{text(item)}</a>)}</nav></div>

          <div><h2 className="footer-heading">{isArabic ? 'خدماتنا' : 'Services'}</h2><nav className="mt-6 grid gap-3">{services.map((item) => <a key={item.fr} href="/services" className="footer-link">{text(item)}</a>)}</nav></div>

          <div><h2 className="footer-heading">{isArabic ? 'تواصل معنا' : 'Contact'}</h2><div className="mt-6 flex flex-col gap-4 text-sm text-white/70"><a href="#adresse" className="footer-contact"><Globe2 className="size-4 shrink-0 text-gold" />{isArabic ? '21 شارع العراق، 1001 لافاييت، تونس' : '21 Rue Iraq, 1001 Lafayette, Tunis'}</a><a href="tel:+21671847608" className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />71 847 608</a><a href="tel:+21698400368" className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="footer-contact"><Mail className="size-4 shrink-0 text-gold" />camcompta@planet.tn</a><span className="footer-contact"><Phone className="size-4 shrink-0 text-gold" />{isArabic ? 'الإثنين – السبت، 8:00 – 17:00' : 'Lun. – Sam. · 8h00 – 17h00'}</span></div><div className="mt-7"><ClientPortalLink href={clientPortalUrl} lang={lang} /></div></div>
        </div>

        <a href="/outils-fiscaux#calendrier-fiscal" className="group flex flex-col gap-3 border-b border-white/15 py-6 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-3 font-semibold text-gold"><span className="h-px w-8 bg-gold" />{isArabic ? 'التقويم الضريبي' : 'Calendrier fiscal'}</span><span className="flex items-center gap-2 text-white/65 transition-colors group-hover:text-white">{isArabic ? 'اطّلع على المواعيد النهائية والتصريحات' : 'Consultez les échéances et déclarations'}<ArrowRight className={cn('size-4 text-gold transition-transform duration-300 group-hover:translate-x-1', isArabic && 'rtl-mirror')} /></span></a>

        <div className="flex flex-col gap-4 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} CAMCONSULT. {isArabic ? 'جميع الحقوق محفوظة.' : 'Tous droits réservés.'}</p><nav className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={isArabic ? 'الروابط القانونية' : 'Liens légaux'}>{legal.map((item, index) => <span key={item.href} className="flex items-center gap-3"><a href={item.href} className="transition-colors hover:text-gold">{text(item)}</a>{index < legal.length - 1 && <span aria-hidden="true" className="text-gold/70">·</span>}</span>)}</nav></div>
      </div>
    </footer>
  )
}
