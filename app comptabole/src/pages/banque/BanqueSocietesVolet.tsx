import { ChevronRight } from "lucide-react";
import { cn, formatDate, initials } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import { aFaire, aUnCompte, etatSociete } from "@/lib/banqueSocietes";
import type { Societe, SyntheseBanque } from "@/types";

const LETTRES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const STATUT_MOIS = {
  ok: { classe: "bg-success text-white", texte: "tombe juste" },
  ecart: { classe: "bg-destructive text-white", texte: "écart" },
  saisir: { classe: "bg-warning text-white", texte: "solde réel à saisir" },
} as const;

/** Pastille d'état d'une société : ce qui demande du travail, ou « À jour » / « Sans compte ». */
export function PastilleEtat({ synthese, chargee }: { synthese: SyntheseBanque | undefined; chargee: boolean }) {
  if (!chargee) return <span />;
  const etat = etatSociete(synthese);
  if (etat === "sans") return <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Sans compte</span>;
  if (etat === "jour") return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />À jour</span>;
  const s = synthese as SyntheseBanque;
  const texte = s.paiementsARapprocher > 0 ? `${s.paiementsARapprocher} à rapprocher` : s.moisEnEcart > 0 ? `${s.moisEnEcart} mois en écart` : "À traiter";
  const ton = s.paiementsARapprocher === 0 && s.moisEnEcart > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning";
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", ton)}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{texte}</span>;
}

/** Les 12 mois d'une société : vert = tombe juste, rouge = écart, orange = solde réel à saisir, gris = rien ce mois-là. */
export function BandeMois({ synthese, compact = false }: { synthese: SyntheseBanque; compact?: boolean }) {
  return (
    <ol className={cn("grid grid-cols-12", compact ? "gap-[3px]" : "gap-1")} aria-label={`Mois de ${synthese.annee}`}>
      {synthese.mois.map((statut, i) => (
        <li
          key={i}
          title={`${NOMS_MOIS[i]} ${synthese.annee} : ${statut ? STATUT_MOIS[statut].texte : "rien"}`}
          className={cn("grid place-items-center rounded-md font-bold", compact ? "h-3 text-[0]" : "h-8 text-[0.65rem]", statut ? STATUT_MOIS[statut].classe : "bg-muted text-muted-foreground/60")}
        >
          {compact ? "" : LETTRES[i]}
          <span className="sr-only">{NOMS_MOIS[i]} : {statut ? STATUT_MOIS[statut].texte : "rien"}</span>
        </li>
      ))}
    </ol>
  );
}

interface Props {
  societes: Societe[];
  synthese: Record<string, SyntheseBanque | undefined>;
  chargee: boolean;
  selectionId: string | null;
  onSelection: (id: string) => void;
  onOuvrir: (id: string) => void;
}

/** Présentation « liste et volet » des sociétés du suivi bancaire : liste à gauche (les sociétés à traiter d'abord), situation de la société choisie à droite. Aucune règle métier : tout vient de la synthèse. */
export function BanqueSocietesVolet({ societes, synthese, chargee, selectionId, onSelection, onOuvrir }: Props) {
  const choisie = societes.find((s) => s.id === selectionId) ?? null;
  const ligne = choisie ? synthese[choisie.id] : undefined;
  const taches = aFaire(ligne);
  return (
    <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_26rem]" data-testid="banque-liste-volet">
      <ul className="min-w-0 lg:border-r lg:border-border" aria-label="Sociétés">
        {societes.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucune société ne correspond.</li>}
        {societes.map((s) => {
          const l = synthese[s.id];
          const actif = s.id === selectionId;
          const sans = chargee && !aUnCompte(l);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={actif ? "true" : undefined}
                aria-label={`Société ${s.raisonSociale}`}
                onClick={() => onSelection(s.id)}
                onDoubleClick={() => onOuvrir(s.id)}
                className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/70 px-4 py-2.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]", sans && !actif && "opacity-65")}
              >
                <span aria-hidden="true" className={cn("relative grid size-10 place-items-center rounded-xl text-[0.78rem] font-bold", sans ? "bg-muted text-muted-foreground" : "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm")}>
                  {initials(s.raisonSociale)}
                  {chargee && etatSociete(l) === "traiter" && <i className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-warning" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[0.9375rem] font-medium text-primary">{s.raisonSociale}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {!chargee ? `${s.theme} · ${s.rne || "RNE non renseigné"}` : aUnCompte(l) ? `${l.comptes.map((c) => `${c.banque} ${c.devise}`).join(" · ")} · ${l.mouvements} mouvement${l.mouvements > 1 ? "s" : ""}` : "Aucun compte"}
                  </span>
                </span>
                <PastilleEtat synthese={l} chargee={chargee} />
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="hidden bg-gradient-to-b from-muted/50 to-card p-5 lg:block" aria-label="Situation bancaire de la société">
        {choisie ? (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-serif text-xl font-medium leading-tight text-primary">{choisie.raisonSociale}</h2>
              <p className="text-[0.8125rem] text-muted-foreground">
                {choisie.theme} · {choisie.rne || "RNE non renseigné"} · {choisie.code}
                {ligne?.dernierMouvement ? ` · dernière opération ${formatDate(ligne.dernierMouvement)}` : ""}
              </p>
            </div>
            {!chargee ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : !aUnCompte(ligne) ? (
              <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">Cette société n'a pas encore de compte bancaire. Ouvrez son suivi pour en créer un et importer un relevé.</p>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Comptes">
                  <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Comptes</h3>
                  <ul className="divide-y divide-border/70">
                    {ligne.comptes.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[0.8125rem]">
                        <span><b className="font-semibold text-foreground">{c.banque}</b> <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">{c.devise}</span></span>
                        <b className="tabular-nums text-foreground">{fmtMontant(c.solde)} {c.devise}</b>
                      </li>
                    ))}
                  </ul>
                </section>
                <dl className="grid grid-cols-2 gap-2.5">
                  {([
                    ["Mouvements", String(ligne.mouvements), "text-primary"],
                    ["À rapprocher", String(ligne.paiementsARapprocher), ligne.paiementsARapprocher > 0 ? "text-warning" : "text-success"],
                    ["Lignes à revoir", String(ligne.aRevoir), ligne.aRevoir > 0 ? "text-warning" : "text-success"],
                    ["Mois en écart", String(ligne.moisEnEcart), ligne.moisEnEcart > 0 ? "text-destructive" : "text-success"],
                  ] as const).map(([libelle, valeur, ton]) => (
                    <div key={libelle} className="rounded-xl border border-border bg-card px-3.5 py-2.5">
                      <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                      <dd className={cn("m-0 mt-0.5 text-xl font-bold tabular-nums tracking-tight", ton)}>{valeur}</dd>
                    </div>
                  ))}
                </dl>
                <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Mois par mois">
                  <h3 className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{ligne.annee}, mois par mois</h3>
                  <BandeMois synthese={ligne} />
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
                    <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-success align-[-1px]" />tombe juste</span>
                    <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-destructive align-[-1px]" />écart</span>
                    <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-warning align-[-1px]" />solde réel à saisir</span>
                  </p>
                </section>
                <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="À traiter">
                  <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">À traiter</h3>
                  {taches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Rien à traiter : tout tombe juste.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {taches.map((t) => (
                        <li key={t} className="flex gap-2.5 text-[0.8125rem]"><span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />{t}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
            <button
              type="button"
              onClick={() => onOuvrir(choisie.id)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ouvrir le suivi bancaire
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choisissez une société pour voir sa situation.</p>
        )}
      </aside>
    </div>
  );
}
