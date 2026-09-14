'use client'

import { useState } from 'react'

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PieChart,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'
import { CamconsultHeader } from '@/components/camconsult-header'
import { CamconsultFooter } from '@/components/camconsult-footer'

const services = [
  ['Tenue comptable', 'Une comptabilité fiable et organisée pour piloter votre activité.', FileText],
  ['Conseil & pilotage', 'Des indicateurs clairs pour transformer vos données en décisions.', BarChart3],
  ['Fiscalité', 'Une stratégie fiscale maîtrisée et un suivi attentif des échéances.', Landmark],
  ['Révision comptable', 'Un regard indépendant pour sécuriser vos comptes et obligations.', ShieldCheck],
  ['Paie & ressources humaines', 'Une gestion sociale précise, fluide et conforme.', Users],
  ['Création d’entreprise', 'Structure, formalités et premiers choix pour bien démarrer.', Sparkles],
  ['Juridique', 'Des actes et conseils adaptés aux moments clés de votre société.', Scale],
  ['Finance d’entreprise', 'Des analyses concrètes pour financer et développer vos projets.', PieChart],
]

const tools = [
  ['Calculateur TVA', 'Estimez rapidement vos montants HT et TTC.', WalletCards],
  ['IS / IRPP', 'Visualisez une estimation par tranche.', BarChart3],
  ['Charges CNSS', 'Simulez les cotisations salariales et patronales.', Users],
  ['Statuts juridiques', 'Comparez SUARL, SARL et SA.', Scale],
]

const posts = [
  ['/images/blog-finance.png', 'Finance', 'Piloter sa trésorerie avec méthode', 'Les repères essentiels pour garder une vision claire de vos flux.', '12 juin 2025 · 5 min'],
  ['/images/blog-strategy.png', 'Stratégie', 'Les bons indicateurs pour décider', 'Quels KPI suivre quand votre entreprise change d’échelle ?', '28 mai 2025 · 6 min'],
  ['/images/blog-tax.png', 'Fiscalité', 'Anticiper ses échéances fiscales', 'Une méthode simple pour éviter les urgences et sécuriser vos déclarations.', '09 mai 2025 · 4 min'],
]

const steps = [
  ['01', 'Prise de contact', 'Un premier échange pour comprendre votre contexte.'],
  ['02', 'Diagnostic', 'Nous identifions vos priorités et vos leviers.'],
  ['03', 'Proposition', 'Un accompagnement lisible, adapté à vos besoins.'],
  ['04', 'Suivi continu', 'Un partenaire présent dans la durée.'],
]

export default function Home() {
  const [sent, setSent] = useState(false)

  return (
    <>
      <CamconsultHeader lang="fr" theme="navy" />
      <main>
        <section id="accueil" className="relative overflow-hidden bg-navy px-6 pb-20 pt-20 text-white sm:px-10 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="pointer-events-none absolute -right-24 -top-28 size-[30rem] rounded-full border border-gold/20 [background:radial-gradient(circle_at_center,rgba(201,169,106,.14),transparent_65%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
            <div className="animate-fade-up">
              <p className="eyebrow">Cabinet AYEDI Mohamed</p>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-[.98] sm:text-7xl lg:text-8xl">La clarté financière au service de vos ambitions.</h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-white/65 sm:text-lg">CAMCONSULT accompagne les entreprises et les entrepreneurs avec une expertise comptable exigeante, un conseil concret et une vision durable.</p>
              <div className="mt-10 flex flex-wrap gap-3"><a href="/contact" className="group inline-flex items-center gap-3 rounded-sm bg-gold px-6 py-4 text-xs font-bold uppercase tracking-wider text-navy transition-transform duration-300 hover:-translate-y-0.5">Prendre rendez-vous <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a><a href="/services" className="inline-flex items-center gap-3 rounded-sm border border-white/25 px-6 py-4 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-300 hover:border-gold hover:text-gold">Découvrir nos services</a></div>
            </div>
            <div className="relative min-h-[21rem] border-l border-gold/40 pl-8 lg:mb-4"><div className="absolute -left-3 top-8 grid size-6 place-items-center rounded-full bg-gold text-navy"><Sparkles className="size-3" /></div><p className="max-w-sm font-serif text-3xl leading-tight">Un partenaire de confiance pour chaque étape de votre développement.</p><div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2"><Stat value="15+" label="Ans d'expérience" /><Stat value="250+" label="Clients accompagnés" /><Stat value="1 200+" label="Déclarations traitées" /><Stat value="98%" label="Satisfaction" /></div></div>
          </div>
        </section>

        <section className="border-b border-border bg-white px-6 py-7 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10px] font-bold uppercase tracking-[.16em] text-navy/45 sm:justify-between"><span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Membre de l&apos;Ordre</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Cabinet certifié</span><span className="flex items-center gap-2"><Sparkles className="size-4" /> 15 ans d&apos;expertise</span><span className="flex items-center gap-2"><FileCheck2 className="size-4" /> Confidentialité garantie</span></div></section>

        <section id="services" className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Nos expertises" title="Des solutions pensées pour vous." text="De la tenue quotidienne aux décisions stratégiques, nous adaptons notre expertise à la réalité de votre activité." /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(([title, text, Icon], index) => <article key={title as string} className="group border border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-xl hover:shadow-navy/5"><div className="flex items-center justify-between"><Icon className="size-6 text-gold" /><span className="font-serif text-3xl text-navy/15">0{index + 1}</span></div><h3 className="mt-10 font-serif text-2xl text-navy">{title as string}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text as string}</p><a href="/services" className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy group-hover:text-gold">En savoir plus <ArrowRight className="size-4" /></a></article>)}</div><div className="mt-10 text-center"><a href="/services" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">Voir tous nos services <ArrowRight className="size-4" /></a></div></div></section>

        <section className="bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Notre différence" title="La rigueur, avec une vraie présence humaine." text="Nous faisons de la comptabilité un outil de décision, pas une simple obligation." light /><div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">{[['Réactivité', 'Des réponses claires, au bon moment.', MessageCircle], ['Expertise sectorielle', 'Une lecture fine de vos enjeux métier.', Landmark], ['Accompagnement personnalisé', 'Un interlocuteur qui connaît votre histoire.', Users], ['Conformité légale', 'Une veille attentive de vos obligations.', ShieldCheck], ['Technologie utile', 'Des outils simples pour gagner en visibilité.', BarChart3], ['Vision durable', 'Des décisions pensées pour demain.', Sparkles]].map(([title, text, Icon]) => <div key={title as string} className="bg-navy p-7 transition-colors hover:bg-white/5"><Icon className="size-6 text-gold" /><h3 className="mt-6 font-serif text-2xl">{title as string}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text as string}</p></div>)}</div></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Notre méthode" title="Un accompagnement qui avance par étapes." text="Une méthode simple, transparente et construite autour de vos priorités." /><div className="mt-14 grid gap-8 md:grid-cols-4">{steps.map(([number, title, text], index) => <div key={number} className="relative"><div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold bg-gold/10 font-serif text-lg text-navy">{number}</span>{index < steps.length - 1 && <span className="hidden h-px flex-1 bg-gold/40 md:block" />}</div><h3 className="mt-6 font-serif text-xl text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></div></section>

        <section className="bg-[#f0eee8] px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionIntro eyebrow="Outils fiscaux" title="Des réponses utiles, immédiatement." text="Testez nos simulateurs gratuits pour préparer vos décisions." /><a href="/outils-fiscaux" className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">Accéder à tous nos outils <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tools.map(([title, text, Icon]) => <a key={title as string} href="/outils-fiscaux" className="group border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold"><Icon className="size-6 text-gold" /><h3 className="mt-8 font-serif text-xl text-navy">{title as string}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p><ArrowRight className="mt-6 size-4 text-navy transition-transform group-hover:translate-x-1" /></a>)}</div></div></section>

        <section className="px-6 pb-20 sm:px-10 lg:px-16 lg:pb-28"><div className="mx-auto flex max-w-7xl flex-col gap-5 border border-gold bg-gold/10 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10"><div className="flex items-start gap-4"><CalendarDays className="mt-1 size-7 shrink-0 text-gold" /><div><p className="eyebrow">Calendrier fiscal</p><h2 className="mt-2 font-serif text-2xl text-navy">Prochaine échéance : déclaration périodique de TVA</h2><p className="mt-2 text-sm text-muted-foreground">Anticipez vos obligations et retrouvez toutes les dates utiles.</p></div></div><a href="/outils-fiscaux#calendrier-fiscal" className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">Voir le calendrier <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-6"><SectionIntro eyebrow="Regards & analyses" title="Nos dernières actualités." text="Des éclairages concrets pour prendre des décisions plus sereines." /><a href="/blog" className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold md:inline-flex">Tout le blog <ArrowRight className="size-4" /></a></div><div className="mt-12 grid gap-6 md:grid-cols-3">{posts.map(([image, category, title, text, date]) => <article key={title} className="group overflow-hidden border border-border bg-background"><img src={image} alt="" className="h-48 w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" /><div className="p-6"><span className="badge badge-gold">{category}</span><h3 className="mt-5 font-serif text-2xl leading-tight text-navy">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><p className="mt-6 text-xs font-semibold text-navy/50">{date}</p></div></article>)}</div></div></section>

        <section className="px-6 py-20 sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto max-w-4xl"><SectionIntro eyebrow="Questions fréquentes" title="Les premières réponses, ici." text="Une question ne trouve pas sa réponse ? Notre équipe est à votre écoute." /><div className="mt-10 divide-y divide-border border-y border-border">{['Comment prendre rendez-vous ?', 'Travaillez-vous avec les indépendants ?', 'Proposez-vous des forfaits ?', 'Quels documents préparer pour un premier échange ?'].map((question) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-serif text-xl text-navy"><span>{question}</span><ChevronDown className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180" /></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-muted-foreground">Nous commençons par un échange simple pour comprendre votre besoin et vous orienter vers la solution la plus adaptée.</p></details>)}</div><a href="/ressources" className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold">Voir toute la FAQ <ArrowRight className="size-4" /></a></div></section>

        <section className="bg-navy px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28"><div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_.8fr]"><div><SectionIntro eyebrow="Parlons de votre projet" title="Un premier échange peut tout changer." text="Décrivez-nous votre besoin, nous vous répondrons avec attention." light /><div className="mt-10 grid gap-4 text-sm text-white/70 sm:grid-cols-2"><a href="tel:+21698400368" className="flex items-center gap-3 hover:text-gold"><Phone className="size-4 text-gold" />98 400 368</a><a href="mailto:camcompta@planet.tn" className="flex items-center gap-3 hover:text-gold"><Mail className="size-4 text-gold" />camcompta@planet.tn</a><span className="flex items-center gap-3"><MapPin className="size-4 text-gold" />21 Rue Iraq, 1001 Lafayette, Tunis</span><span className="flex items-center gap-3"><CalendarDays className="size-4 text-gold" />Lundi à samedi · 8h00 à 17h00</span></div></div><form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><div className="grid gap-4 sm:grid-cols-2"><input required aria-label="Nom" placeholder="Nom" className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><input required type="email" aria-label="Email" placeholder="Email" className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /></div><input aria-label="Téléphone" placeholder="Téléphone" className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><select aria-label="Type de demande" className="field-input border-white/20 bg-white/10 text-white"><option className="text-navy">Type de demande</option><option className="text-navy">Devis</option><option className="text-navy">Rendez-vous</option><option className="text-navy">Information générale</option></select><textarea required aria-label="Message" placeholder="Votre message" rows={4} className="field-input border-white/25 bg-white/10 text-white placeholder:text-white/75 placeholder:opacity-100 focus:border-gold focus:ring-1 focus:ring-gold/40" /><button className="group inline-flex items-center justify-center gap-3 bg-gold px-6 py-4 text-xs font-bold uppercase tracking-widest text-navy">{sent ? 'Message envoyé' : 'Envoyer le message'} {sent ? <Check className="size-4" /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}</button></form></div></section>

        <section className="bg-gold px-6 py-14 text-navy sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.2em]">Votre prochaine décision commence ici</p><h2 className="mt-3 font-serif text-4xl">Construisons la suite ensemble.</h2></div><a href="/contact" className="group inline-flex items-center gap-3 border border-navy px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-navy hover:text-gold">Prendre rendez-vous <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a></div></section>
      </main>
      <CamconsultFooter lang="fr" />
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="border-t border-white/15 pt-4"><p className="font-serif text-3xl text-gold">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">{label}</p></div> }

function SectionIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) { return <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className={`mt-4 font-serif text-4xl leading-tight sm:text-5xl ${light ? 'text-white' : 'text-navy'}`}>{title}</h2><p className={`mt-5 text-base leading-7 ${light ? 'text-white/60' : 'text-muted-foreground'}`}>{text}</p></div> }

// Homepage styles are intentionally scoped through shared theme tokens in globals.css.
