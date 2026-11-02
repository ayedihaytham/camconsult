import { Boxes, ChevronRight, Trash2 } from "lucide-react";
import { cn, formatDate, initials } from "@/lib/utils";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { aSoldeDu, partSoldee } from "@/lib/suiviDeviseListe";
import type { SuiviDeviseResume } from "@/store/suiviDevise";

function Anneau({ part, solde }: { part: number; solde: boolean }) {
  const circonference = 2 * Math.PI * 14;
  return (
    <span className="relative grid size-[68px] shrink-0 place-items-center" role="img" aria-label={`${part} % soldé`}>
      <svg viewBox="0 0 34 34" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="17" cy="17" r="14" fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="17" cy="17" r="14" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(circonference * part) / 100} ${circonference}`} className={solde ? "stroke-success" : "stroke-warning"} />
      </svg>
      <b className="text-[0.8125rem] font-bold tabular-nums text-primary" aria-hidden="true">{part} %</b>
    </span>
  );
}

function Pastille({ children, ton }: { children: React.ReactNode; ton?: "ok" | "attention" | "or" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", ton === "ok" ? "bg-success/10 text-success" : ton === "attention" ? "bg-warning/10 text-warning" : ton === "or" ? "bg-accent/20 text-primary" : "bg-muted text-muted-foreground")}>
      {children}
    </span>
  );
}

const jour = (iso: string | null) => (iso ? formatDate(iso) : "sans date");

interface Props {
  fiches: SuiviDeviseResume[];
  selectionId: string | null;
  onSelection: (id: string) => void;
  onOuvrir: (id: string) => void;
  onSupprimer: (fiche: SuiviDeviseResume) => void;
}

/** Présentation « liste et volet » des fiches du suivi client devise : fiches à gauche, fiche du client choisi à droite. Aucune règle métier : tout vient de la liste. */
export function SuiviDeviseVolet({ fiches, selectionId, onSelection, onOuvrir, onSupprimer }: Props) {
  const choisie = fiches.find((f) => f.id === selectionId) ?? null;
  const part = choisie ? partSoldee(choisie) : null;
  const regle = choisie?.totalReglements ?? 0;
  return (
    <div className="grid min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_26rem]" data-testid="devise-liste-volet">
      <ul className="min-w-0 lg:border-r lg:border-border" aria-label="Fiches">
        {fiches.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucune fiche ne correspond.</li>}
        {fiches.map((f) => {
          const actif = f.id === selectionId;
          const du = aSoldeDu(f);
          const nb = f.nbFactures ?? 0;
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-current={actif ? "true" : undefined}
                onClick={() => onSelection(f.id)}
                onDoubleClick={() => onOuvrir(f.id)}
                className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/70 px-4 py-2.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]")}
              >
                <span aria-hidden="true" className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/90 to-primary text-[0.78rem] font-bold text-primary-foreground shadow-sm">
                  {initials(f.client)}
                  {du && <i className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-warning" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[0.9375rem] font-medium text-primary">{f.client}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {f.exercice && <Pastille>{f.exercice}</Pastille>}
                    <Pastille>{f.devise}</Pastille>
                    {nb > 0 && <span>{nb} facture{nb > 1 ? "s" : ""}</span>}
                    {(f.stockAReprendre ?? 0) > 0 && (
                      <Pastille ton="or">
                        <Boxes className="size-3" aria-hidden="true" />
                        stock à reprendre
                      </Pastille>
                    )}
                  </span>
                </span>
                {du ? <b className="whitespace-nowrap text-sm font-bold tabular-nums text-warning">{fmt(f.solde)}</b> : <Pastille ton="ok">Soldée</Pastille>}
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="hidden bg-gradient-to-b from-muted/50 to-card p-5 lg:block" aria-label="Fiche du client">
        {choisie ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3.5">
              {part !== null && <Anneau part={part} solde={!aSoldeDu(choisie)} />}
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-medium leading-tight text-primary [overflow-wrap:anywhere]">{choisie.client}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {choisie.exercice && <Pastille>Exercice {choisie.exercice}</Pastille>}
                  <Pastille>{choisie.devise}</Pastille>
                  {aSoldeDu(choisie) ? <Pastille ton="attention">Solde dû</Pastille> : <Pastille ton="ok">Soldée</Pastille>}
                  {(choisie.stockAReprendre ?? 0) > 0 && (
                    <Pastille ton="or">
                      <Boxes className="size-3" aria-hidden="true" />
                      {choisie.stockAReprendre} vente{(choisie.stockAReprendre ?? 0) > 1 ? "s" : ""} du stock à reprendre
                    </Pastille>
                  )}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2.5">
              {([
                ["Total ventes", fmt(choisie.totalVentes), "text-primary"],
                ["Réglé", fmt(regle), regle > 0 ? "text-success" : "text-muted-foreground/60"],
                ["Solde", fmt(choisie.solde), aSoldeDu(choisie) ? "text-warning" : "text-success"],
              ] as const).map(([libelle, valeur, ton]) => (
                <div key={libelle} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
                  <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                  <dd className={cn("m-0 mt-0.5 truncate text-[0.9375rem] font-bold tabular-nums tracking-tight", ton)}>{valeur}</dd>
                </div>
              ))}
            </dl>
            <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Dernières factures">
              <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dernières factures</h3>
              {(choisie.apercu?.factures ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {(choisie.apercu?.factures ?? []).map((f, i) => (
                    <li key={`${f.nFacture}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-[0.8125rem]">
                      <span className="min-w-0 truncate">
                        <b className="font-semibold text-foreground">{f.nFacture || "sans numéro"}</b> <span className="text-muted-foreground">· {jour(f.dateFacture)}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {fmt(f.montantTotal)} {f.reste <= 0.0005 ? <span className="text-success">✓</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-xl border border-border bg-card px-4 py-3" aria-label="Derniers règlements">
              <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Derniers règlements</h3>
              {(choisie.apercu?.reglements ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun règlement.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {(choisie.apercu?.reglements ?? []).map((r, i) => (
                    <li key={`${r.date}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-[0.8125rem]">
                      <span className="min-w-0 truncate"><b className="font-semibold text-foreground">{jour(r.date)}</b>{r.libelle ? <span className="text-muted-foreground"> · {r.libelle}</span> : null}</span>
                      <span className="whitespace-nowrap tabular-nums text-success">{fmt(r.montant)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <button
              type="button"
              onClick={() => onOuvrir(choisie.id)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ouvrir la fiche
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSupprimer(choisie)}
              className="inline-flex items-center justify-center gap-1.5 self-center rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Supprimer la fiche ${choisie.client}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Supprimer la fiche
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choisissez une fiche pour la voir ici.</p>
        )}
      </aside>
    </div>
  );
}
