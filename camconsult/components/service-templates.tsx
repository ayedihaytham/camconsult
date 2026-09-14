'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronDown,
  FileCheck2,
  FileText,
  Lightbulb,
  LineChart,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Lang = 'fr' | 'ar'

const serviceData = [
  { icon: Calculator, title: 'Expertise comptable', ar: 'الخبرة المحاسبية', description: 'Une information financière fiable pour piloter votre activité avec confiance.', audience: 'PME & dirigeants' },
  { icon: Lightbulb, title: 'Conseil & stratégie', ar: 'الاستشارة والاستراتيجية', description: 'Des décisions structurées pour transformer vos ambitions en résultats durables.', audience: 'Entrepreneurs' },
  { icon: ShieldCheck, title: 'Audit & conformité', ar: 'التدقيق والامتثال', description: 'Sécurisez vos opérations avec une lecture indépendante et rigoureuse.', audience: 'Organisations' },
  { icon: Scale, title: 'Fiscalité', ar: 'الاستشارات الضريبية', description: 'Anticipez vos obligations et construisez une stratégie fiscale maîtrisée.', audience: 'Entreprises' },
  { icon: Users, title: 'Paie & ressources humaines', ar: 'الرواتب والموارد البشرية', description: 'Une gestion sociale précise, fluide et adaptée à vos équipes.', audience: 'Employeurs' },
  { icon: BriefcaseBusiness, title: 'Juridique', ar: 'الاستشارات القانونية', description: 'Les bons réflexes pour protéger vos décisions et vos activités.', audience: 'Dirigeants' },
  { icon: Sparkles, title: 'Création d’entreprise', ar: 'إنشاء الشركات', description: 'Un lancement éclairé, de la structuration aux premiers arbitrages.', audience: 'Créateurs' },
  { icon: LineChart, title: 'Finance d’entreprise', ar: 'تمويل الشركات', description: 'Des indicateurs clairs pour financer vos projets et accélérer votre croissance.', audience: 'PME en croissance' },
]

const faqItems = [
  { q: 'Comment démarre une mission ?', a: 'Nous commençons par un échange de cadrage afin de comprendre votre contexte, vos objectifs et vos échéances. Une proposition claire vous est ensuite adressée.' },
  { q: 'Pouvez-vous accompagner une entreprise existante ?', a: 'Oui. Nous intervenons aussi bien lors d’une création que dans le cadre d’une reprise, d’une réorganisation ou d’un changement de cabinet.' },
  { q: 'Quel est le rythme des échanges ?', a: 'Le rythme est défini selon vos besoins. Un interlocuteur dédié reste disponible pour les points de pilotage et les questions courantes.' },
]

function Breadcrumb({ lang, current }: { lang: Lang; current: string }) {
  const isArabic = lang === 'ar'
  return <div className="flex items-center gap-2 text-xs text-white/55"><span>{isArabic ? 'الرئيسية' : 'Accueil'}</span><span>/</span><span>{isArabic ? 'الخدمات' : 'Services'}</span><span>/</span><span className="text-gold">{current}</span></div>
}

function TemplateHero({ lang, eyebrow, title, description }: { lang: Lang; eyebrow: string; title: string; description: string }) {
  return <section className="bg-navy px-6 pb-14 pt-28 text-white sm:px-10 lg:px-16"><div className="mx-auto max-w-7xl"><Breadcrumb lang={lang} current={title} /><p className="eyebrow mt-12">{eyebrow}</p><h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[1.05] sm:text-7xl">{title}</h1><p className="mt-7 max-w-2xl text-base leading-7 text-white/65">{description}</p></div></section>
}

export function ServicesTemplate({ lang = 'fr' }: { lang?: Lang }) {
  const isArabic = lang === 'ar'
  const Arrow = isArabic ? ArrowLeft : ArrowRight
  return <div dir={isArabic ? 'rtl' : 'ltr'}><TemplateHero lang={lang} eyebrow={isArabic ? 'خبرتنا' : 'Notre savoir-faire'} title={isArabic ? 'خدماتنا' : 'Nos services'} description={isArabic ? 'خبرة دقيقة لمرافقة طموحاتكم في كل مرحلة.' : 'Une expertise précise pour accompagner vos ambitions à chaque étape.'} /><section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{serviceData.map(({ icon: Icon, title, ar, description, audience }) => <article key={title} className="group flex min-h-[285px] flex-col rounded-sm border border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-xl hover:shadow-navy/5"><div className="flex items-start justify-between"><Icon className="size-7 text-gold" aria-hidden="true" /><span className="badge border border-gold/40 text-[9px] text-navy">{audience}</span></div><h2 className="mt-10 font-serif text-2xl text-navy">{isArabic ? ar : title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><a href="/services/revision" className="mt-auto inline-flex items-center gap-2 pt-7 text-[11px] font-bold uppercase tracking-[0.14em] text-navy transition-colors group-hover:text-gold">{isArabic ? 'عرض التفاصيل' : 'Voir le détail'} <Arrow className="transition-transform group-hover:translate-x-1 rtl-mirror" data-icon="inline-end" /></a></article>)}</div></div></section></div>
}

export function ServiceDetailTemplate({ lang = 'fr', serviceTitle = 'Expertise comptable' }: { lang?: Lang; serviceTitle?: string }) {
  const isArabic = lang === 'ar'
  const [openFaq, setOpenFaq] = useState(0)
  const Arrow = isArabic ? ArrowLeft : ArrowRight
  const title = isArabic ? 'الخبرة المحاسبية' : serviceTitle
  return <div id="detail" dir={isArabic ? 'rtl' : 'ltr'}><TemplateHero lang={lang} eyebrow={isArabic ? 'خدمة متخصصة' : 'Service spécialisé'} title={title} description={isArabic ? 'رؤية واضحة وحسابات موثوقة لمساعدة مؤسستكم على التقدم بثقة.' : 'Une vision claire et des comptes fiables pour faire avancer votre entreprise avec sérénité.'} /><div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 sm:px-10 lg:grid-cols-[1fr_340px] lg:gap-20 lg:px-16 lg:py-28"><div><section><p className="eyebrow">{isArabic ? 'الوصف' : 'Description'}</p><h2 className="mt-4 font-serif text-4xl text-navy">{isArabic ? 'قراءة دقيقة لأدائكم المالي' : 'Une lecture précise de votre performance.'}</h2><div className="mt-7 max-w-2xl space-y-4 text-sm leading-7 text-muted-foreground"><p>{isArabic ? 'نرافقكم في إعداد وتحليل معلوماتكم المالية مع الحفاظ على رؤية عملية ومفهومة.' : 'Nous vous accompagnons dans la production et l’analyse de votre information financière, avec une approche pratique et lisible.'}</p><p>{isArabic ? 'تضمن خبرتنا انتظام العمليات ووضوح المؤشرات لاتخاذ قراراتكم بثقة.' : 'Notre méthode garantit la régularité de vos opérations et la clarté des indicateurs nécessaires à vos décisions.'}</p></div></section><section className="mt-20"><p className="eyebrow">{isArabic ? 'الجمهور المستهدف' : 'Public cible'}</p><h2 className="mt-4 font-serif text-3xl text-navy">{isArabic ? 'لمن صممت هذه الخدمة؟' : 'Pour qui cette expertise est-elle pensée ?'}</h2><ul className="mt-7 grid gap-4 sm:grid-cols-2">{['Dirigeants de PME', 'Entrepreneurs en croissance', 'Filiales & groupes', 'Professions réglementées'].map((item) => <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground"><Check className="size-4 shrink-0 text-gold" />{isArabic ? 'الشركات ورواد الأعمال' : item}</li>)}</ul></section><section className="mt-20"><p className="eyebrow">{isArabic ? 'المخرجات' : 'Livrables'}</p><h2 className="mt-4 font-serif text-3xl text-navy">{isArabic ? 'أدوات واضحة وقابلة للاستخدام' : 'Des livrables directement utiles.'}</h2><div className="mt-7 grid gap-4 sm:grid-cols-2">{['Comptes annuels & situations intermédiaires', 'Tableaux de bord personnalisés', 'Analyse des écarts et recommandations', 'Réunions de restitution'].map((item) => <div key={item} className="flex items-start gap-4 rounded-sm border border-border bg-white p-5"><FileText className="size-5 shrink-0 text-gold" /><span className="text-sm leading-6 text-navy">{isArabic ? 'تقارير مالية وتحليلات مخصصة' : item}</span></div>)}</div></section><section className="mt-20"><p className="eyebrow">FAQ</p><div className="mt-5 divide-y divide-border border-y border-border">{faqItems.map((item, index) => <div key={item.q}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex w-full items-center justify-between gap-6 py-5 text-start font-semibold text-navy"><span>{isArabic ? 'كيف تبدأ المهمة؟' : item.q}</span><ChevronDown className={cn('size-5 shrink-0 text-gold transition-transform', openFaq === index && 'rotate-180')} /></button>{openFaq === index && <p className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground">{isArabic ? 'نبدأ بمقابلة أولية لفهم سياقكم وأهدافكم ومواعيدكم، ثم نقترح عليكم منهجية واضحة.' : item.a}</p>}</div>)}</div></section></div><aside className="h-fit lg:sticky lg:top-28"><div className="rounded-sm bg-navy p-7 text-white"><p className="eyebrow">{isArabic ? 'لنتحدث' : 'Parlons de votre projet'}</p><h2 className="mt-4 font-serif text-3xl">{isArabic ? 'اطلبوا عرضاً' : 'Demander un devis'}</h2><p className="mt-4 text-sm leading-6 text-white/60">{isArabic ? 'فريقنا جاهز للاستماع إلى احتياجاتكم.' : 'Notre équipe est prête à comprendre vos besoins.'}</p><Button className="group mt-7 w-full justify-between">{isArabic ? 'تواصلوا معنا' : 'Prendre contact'} <Arrow className="transition-transform group-hover:translate-x-1 rtl-mirror" data-icon="inline-end" /></Button><div className="mt-8 border-t border-white/15 pt-6 text-sm leading-7 text-white/65"><p>+33 (0)1 84 80 20 20</p><p>contact@camconsult.fr</p><p>Paris · Casablanca</p></div></div>{serviceTitle.includes('Révision') && <div className="mt-4 border border-gold/60 bg-[#f2eadb] p-6"><div className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-navy" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-navy">Périmètre légal</p><p className="mt-3 text-sm leading-6 text-navy/70">Intervention définie selon les seuils légaux en vigueur et la nature de votre entité.</p></div></div></div>}</aside></div></div>
}

export function ServiceTemplatesShowcase() {
  const [template, setTemplate] = useState<'list' | 'detail'>('list')
  const [lang, setLang] = useState<Lang>('fr')
  return <main className="min-h-screen bg-background"><div className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 py-4 backdrop-blur sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">CAMCONSULT · templates</p><p className="mt-1 font-serif text-xl text-navy">Pages services</p></div><div className="flex items-center gap-2"><div className="flex rounded-full border border-border p-1">{(['list', 'detail'] as const).map((item) => <button key={item} type="button" onClick={() => setTemplate(item)} className={cn('rounded-full px-4 py-2 text-xs font-semibold transition-colors', template === item ? 'bg-navy text-white' : 'text-navy/60 hover:text-navy')}>{item === 'list' ? 'Template A · Liste' : 'Template B · Détail'}</button>)}</div><button type="button" onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')} className="rounded-full border border-gold px-4 py-2 text-xs font-bold text-navy">{lang === 'fr' ? 'FR / AR' : 'AR / FR'}</button></div></div></div>{template === 'list' ? <ServicesTemplate lang={lang} /> : <ServiceDetailTemplate lang={lang} serviceTitle="Révision comptable & commissariat aux comptes" />}</main>
}

export { serviceData }
export type { Lang }
