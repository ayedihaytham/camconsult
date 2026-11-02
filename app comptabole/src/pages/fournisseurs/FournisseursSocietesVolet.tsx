import { ChevronRight } from "lucide-react";
import { cn, formatDate, initials } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import { aDesFactures, aFaire, etatSociete } from "@/lib/fournisseursSocietes";
import type { Societe, SyntheseFournisseurs } from "@/types";

/** Pastille d'état d'une société : ce qui demande du travail, ou « À jour » / « Sans facture ». */
export function PastilleEtat({ synthese, chargee }: { synthese: SyntheseFournisseurs | undefined; chargee: boolean }) {
  if (!chargee) return <span />;
  const etat = etatSociete(synthese);
  if (etat === "sans") return <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Sans facture</span>;
  if (etat === "jour") return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />À jour</span>;
  const s = synthese as SyntheseFournisseurs;
  const texte = s.impayees > 0 ? `${s.impayees} à régler` : s.paiementsARapprocher > 0 ? `${s.paiementsARapprocher} à rapprocher` : "À vérifier";
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{texte}</span>;
}

const lesSoldes = (soldes: { devise: string; montant: number }[]) => soldes.map((d) => `${fmtMontant(d.montant)} ${d.devise}`).join(" · ");

interface Props {
  societes: Societe[];
  synthese: Record<string, SyntheseFournisseurs | undefined>;
  chargee: boolean;
  selectionId: string | null;
  onSelection: (id: string) => void;
  onOuvrir: (id: string) => void;
}

/** Présentation « liste et volet » des sociétés du suivi fournisseur : liste à gauche (les sociétés à traiter d'abord), situation de la société choisie à droite. Aucune règle métier : tout vient de la synthèse. */
export function FournisseursSocietesVolet({ societes, synthese, chargee, selectionId, onSelection, onOuvrir }: Props) {
  const choisie = societes.find((s) => s.id === selectionId) ?? null;
  const ligne = choisie ? synthese[choisie.id] : undefined;
  const taches = aFaire(ligne);
  return (
    <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_26rem]" data-testid="fournisseurs-liste-volet">
      <ul className="min-w-0 lg:border-r lg:border-border" aria-label="Sociétés">
        {societes.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucune société ne correspond.</li>}
        {societes.map((s) => {
          const l = synthese[s.id];
          const actif = s.id === selectionId;
          const sans = chargee && etatSociete(l) === "sans";
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
                    {!chargee ? `${s.theme} · ${s.rne || "RNE non renseigné"}` : aDesFactures(l) ? `${l.fournisseurs} fournisseur${l.fournisseurs > 1 ? "s" : ""} · ${l.factures} facture${l.factures > 1 ? "s" : ""}${l.soldes.length > 0 ? ` · dû ${lesSoldes(l.soldes)}` : ""}` : "Aucune facture d'achat"}
                  </span>
                </span>
                <PastilleEtat synthese={l} chargee={chargee} />
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="hidden bg-gradient-to-b from-muted/50 to-card p-5 lg:block" aria-label="Situation du suivi fournisseur de la société">
        {choisie ? (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-serif text-xl font-medium leading-tight text-primary">{choisie.raisonSociale}</h2>
              <p className="text-[0.8125rem] text-muted-foreground">
                {choisie.theme} · {choisie.rne || "RNE non renseigné"} · {choisie.code}
                {ligne?.dernierReglement ? ` · dernier règlement ${formatDate(ligne.dernierReglement)}` : ""}
              </p>
            </div>
            {!chargee ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : etatSociete(ligne) === "sans" || !ligne ? (
              <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">Cette société n'a pas encore de facture d'achat. Les factures du suivi fournisseur viennent de la gestion de stock.</p>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Solde dû">
                  <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Solde dû</h3>
                  {ligne.soldes.length === 0 ? (
                    <p className="text-sm font-semibold text-success">Rien à régler : toutes les factures sont soldées.</p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {ligne.soldes.map((d) => (
                        <li key={d.devise} className="flex items-baseline justify-between gap-3 py-1.5 text-[0.8125rem]">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">{d.devise}</span>
                          <b className="text-base tabular-nums text-warning">{fmtMontant(d.montant)} {d.devise}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <dl className="grid grid-cols-2 gap-2.5">
                  {([
                    ["Fournisseurs", String(ligne.fournisseurs), "text-primary"],
                    ["Factures à régler", `${ligne.impayees} / ${ligne.factures}`, ligne.impayees > 0 ? "text-warning" : "text-success"],
                    ["Règlements", String(ligne.reglements), "text-primary"],
                    ["À rapprocher", String(ligne.paiementsARapprocher), ligne.paiementsARapprocher > 0 ? "text-warning" : "text-success"],
                  ] as const).map(([libelle, valeur, ton]) => (
                    <div key={libelle} className="rounded-xl border border-border bg-card px-3.5 py-2.5">
                      <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                      <dd className={cn("m-0 mt-0.5 text-xl font-bold tabular-nums tracking-tight", ton)}>{valeur}</dd>
                    </div>
                  ))}
                </dl>
                {ligne.principaux.length > 0 && (
                  <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Principaux soldes dus">
                    <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Principaux soldes dus</h3>
                    <ol className="divide-y divide-border/70">
                      {ligne.principaux.map((f) => (
                        <li key={f.nom} className="flex items-baseline justify-between gap-3 py-1.5 text-[0.8125rem]">
                          <b className="min-w-0 truncate font-semibold text-foreground">{f.nom}</b>
                          <span className="whitespace-nowrap tabular-nums text-warning">{lesSoldes(f.soldes)}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="À traiter">
                  <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">À traiter</h3>
                  {taches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Rien à traiter : tout est réglé.</p>
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
              Ouvrir le suivi fournisseur
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
