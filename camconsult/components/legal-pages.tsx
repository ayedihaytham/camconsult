'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, FileText, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type Lang = 'fr' | 'ar'
type LegalKey = 'mentions' | 'privacy' | 'terms' | 'cookies'

type LegalSection = { id: string; title: string; body: string[]; bullets?: string[] }

type LegalPage = { title: string; label: string; updated: string; intro: string; sections: LegalSection[] }

const pages: Record<LegalKey, LegalPage> = {
  mentions: {
    title: 'Mentions légales', label: 'Informations éditoriales', updated: '14 septembre 2026', intro: 'Cette page présente les informations légales relatives au site CAMCONSULT et à son éditeur.', sections: [
      { id: 'editeur', title: 'Éditeur du site', body: ['Le site CAMCONSULT est édité par CAMCONSULT, cabinet d’expertise comptable et de conseil, dont le siège est situé à Tunis, Tunisie.', 'Pour toute question éditoriale ou administrative, vous pouvez nous contacter via la page Contact.'] },
      { id: 'hebergement', title: 'Hébergement', body: ['Le site est hébergé par un prestataire technique spécialisé. Les informations relatives à l’hébergeur sont tenues à jour par l’éditeur.'] },
      { id: 'propriete', title: 'Propriété intellectuelle', body: ['Les textes, éléments graphiques, marques et composants du site sont protégés par les règles applicables en matière de propriété intellectuelle.', 'Toute reproduction ou réutilisation non autorisée est interdite.'] },
    ]
  },
  privacy: {
    title: 'Confidentialité', label: 'Protection des données', updated: '14 septembre 2026', intro: 'CAMCONSULT accorde une importance particulière à la confidentialité et à la protection des données personnelles.', sections: [
      { id: 'collecte', title: 'Données collectées', body: ['Nous collectons uniquement les informations nécessaires au traitement de vos demandes, à la relation client et à l’amélioration de nos services.'] },
      { id: 'usages', title: 'Finalités et conservation', body: ['Les données sont utilisées pour répondre à vos sollicitations, organiser un rendez-vous et vous transmettre les ressources demandées.', 'Elles sont conservées pendant une durée proportionnée à la finalité poursuivie ou aux obligations applicables.'] },
      { id: 'droits', title: 'Vos droits', body: ['Vous pouvez demander l’accès, la rectification, la limitation ou la suppression de vos données, selon les conditions prévues par la réglementation applicable.', 'Pour exercer vos droits, contactez notre équipe en précisant l’objet de votre demande.'] },
    ]
  },
  terms: {
    title: 'Conditions générales d’utilisation', label: 'Règles d’utilisation', updated: '14 septembre 2026', intro: 'L’utilisation du site CAMCONSULT implique l’acceptation des présentes conditions générales.', sections: [
      { id: 'acces', title: 'Accès au site', body: ['Le site est accessible à toute personne sous réserve des interruptions nécessaires à sa maintenance ou à sa sécurité.'] },
      { id: 'contenus', title: 'Contenus et outils', body: ['Les informations publiées sont fournies à titre général et pédagogique. Elles ne constituent pas un avis professionnel personnalisé.', 'Les simulateurs fiscaux donnent des résultats indicatifs calculés localement dans le navigateur.'] },
      { id: 'responsabilite', title: 'Responsabilité', body: ['CAMCONSULT s’efforce de maintenir des informations exactes et à jour, sans pouvoir garantir l’absence totale d’erreur ou d’interruption.', 'Toute décision doit être prise après analyse de votre situation avec un professionnel.'] },
    ]
  },
  cookies: {
    title: 'Politique relative aux cookies', label: 'Préférences de navigation', updated: '14 septembre 2026', intro: 'Cette politique explique comment CAMCONSULT utilise les cookies et technologies similaires sur son site.', sections: [
      { id: 'definition', title: 'Qu’est-ce qu’un cookie ?', body: ['Un cookie est un petit fichier enregistré sur votre appareil lors de la consultation d’un site. Il permet notamment de mémoriser certaines préférences.'] },
      { id: 'categories', title: 'Catégories de cookies', body: ['Les cookies strictement nécessaires permettent le fonctionnement du site. Des cookies de mesure d’audience peuvent être utilisés uniquement selon vos choix et la configuration active.'] },
      { id: 'gestion', title: 'Gérer vos préférences', body: ['Vous pouvez modifier les paramètres de votre navigateur pour accepter, refuser ou supprimer les cookies. Certaines fonctionnalités peuvent alors être limitées.'] },
    ]
  }
}

const nav = [
  ['mentions', 'Mentions légales'], ['privacy', 'Confidentialité'], ['terms', 'CGU'], ['cookies', 'Cookies']
] as const

export function LegalPages({ lang = 'fr', initialPage = 'mentions' }: { lang?: Lang; initialPage?: LegalKey }) {
  const [active, setActive] = useState<LegalKey>(initialPage)
  const page = useMemo(() => pages[active], [active])
  const rtl = lang === 'ar'
  return <main dir={rtl ? 'rtl' : 'ltr'} className="bg-background text-foreground">
    <section className="bg-navy px-6 pb-16 pt-28 text-white sm:px-10 lg:px-16"><div className="mx-auto max-w-7xl"><div className="flex items-center gap-2 text-xs text-white/50"><span>Accueil</span><span>/</span><span className="text-gold">{page.title}</span></div><p className="eyebrow mt-12">{page.label}</p><h1 className="mt-4 max-w-3xl font-serif text-5xl leading-none sm:text-7xl">{page.title}</h1><p className="mt-6 text-sm text-white/65">Dernière mise à jour : {page.updated}</p></div></section>
    <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[250px_minmax(0,720px)] lg:gap-20 lg:px-16 lg:py-24">
      <aside className="lg:sticky lg:top-28 lg:self-start"><p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Sommaire</p><nav aria-label="Sommaire juridique" className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">{page.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="group inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs text-navy/65 transition-colors hover:border-gold hover:text-navy lg:border-0 lg:px-0"><span className="text-gold">0{index + 1}</span>{section.title}<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl-mirror" /></a>)}</nav><div className="mt-8 hidden border-t border-border pt-6 text-xs leading-5 text-muted-foreground lg:block"><ShieldCheck className="mb-3 size-5 text-gold" />Une présentation claire de nos engagements et de vos droits.</div></aside>
      <article className="max-w-[720px]"><div className="mb-12 border-b border-border pb-10"><FileText className="size-7 text-gold" /><p className="mt-6 text-lg leading-8 text-muted-foreground">{page.intro}</p></div>{page.sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-border py-10 first:pt-0 last:border-0"><h2 className="font-serif text-3xl text-navy">{section.title}</h2><div className="mt-5 flex flex-col gap-4 text-sm leading-7 text-muted-foreground">{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>{section.bullets && <ul className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><Check className="mt-1 size-4 shrink-0 text-gold" />{bullet}</li>)}</ul>}</section>)}</article>
    </div>
    <div className="border-y border-border bg-white px-6 py-5 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap gap-2">{nav.map(([key, label]) => <button key={key} type="button" onClick={() => setActive(key)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-200', active === key ? 'border-gold bg-gold text-navy' : 'border-border text-navy/60 hover:border-gold hover:text-navy')}>{label}</button>)}</div></div>
  </main>
}

export type { LegalKey }
