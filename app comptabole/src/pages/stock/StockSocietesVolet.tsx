import { Link } from "react-router-dom";
import { ChevronRight, Coins } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { StockMouvement, Societe } from "@/types";
import type { SyntheseStock } from "@/store/stock";

const montant = (valeur: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valeur);
const jourMois = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));
const jourComplet = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export interface OperationRecente {
  type: "Vente" | "Facture d'achat" | "Déclaration douane";
  /** Numéro de facture ou de déclaration, tiers : ce qui permet de la reconnaître. */
  detail: string;
  date: string;
}

/** Dernières opérations d'une société, tous mouvements confondus : ventes, factures d'achat et déclarations douanières, de la plus récente à la plus ancienne. */
export function operationsRecentes(mouvements: StockMouvement[], max = 4): OperationRecente[] {
  const operations: OperationRecente[] = [];
  for (const m of mouvements) {
    if (m.venteDate) operations.push({ type: "Vente", detail: [m.venteNumFacture, m.client].filter(Boolean).join(" · "), date: m.venteDate });
    if (m.achatDate) operations.push({ type: "Facture d'achat", detail: [m.achatNumFacture, m.fournisseur].filter(Boolean).join(" · "), date: m.achatDate });
    if (m.douaneDate) operations.push({ type: "Déclaration douane", detail: m.douaneNumDeclaration, date: m.douaneDate });
  }
  return operations.sort((a, b) => b.date.localeCompare(a.date)).slice(0, max);
}

/** Part des lignes en devise dont le cours est saisi (0–100) ; null quand la société n'a aucun mouvement en devise. */
export function partCoursSaisis(ligne: Pick<SyntheseStock, "enDevise" | "coursManquants"> | undefined): number | null {
  if (!ligne || ligne.enDevise === 0) return null;
  return Math.max(0, Math.min(100, Math.round(((ligne.enDevise - ligne.coursManquants) / ligne.enDevise) * 100)));
}

function Anneau({ part }: { part: number }) {
  const circonference = 2 * Math.PI * 14;
  const complet = part === 100;
  return (
    <svg viewBox="0 0 34 34" className="size-[54px] shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="17" cy="17" r="14" fill="none" strokeWidth="4" className="stroke-muted" />
      <circle cx="17" cy="17" r="14" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(circonference * part) / 100} ${circonference}`} className={complet ? "stroke-success" : "stroke-warning"} />
    </svg>
  );
}

interface Props {
  societes: Societe[];
  synthese: Record<string, SyntheseStock | undefined>;
  selectionId: string | null;
  onSelection: (id: string) => void;
  onOuvrir: (id: string) => void;
  /** Dernières opérations de la société choisie ; null tant qu'elles se chargent. */
  recentes: OperationRecente[] | null;
  /** « il y a 5 jours » sous une date. */
  ilYA: (iso: string) => string;
}

/** Présentation « liste et volet » des sociétés du stock : liste compacte à gauche, fiche de la société choisie à droite. Aucune règle métier : tout vient de la page. */
export function StockSocietesVolet({ societes, synthese, selectionId, onSelection, onOuvrir, recentes, ilYA }: Props) {
  const choisie = societes.find((s) => s.id === selectionId) ?? null;
  const ligne = choisie ? synthese[choisie.id] : undefined;
  const part = partCoursSaisis(ligne);
  return (
    <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_26rem]" data-testid="stock-liste-volet">
      <ul className="min-w-0 lg:border-r lg:border-border" aria-label="Sociétés">
        {societes.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucune société ne correspond.</li>}
        {societes.map((s) => {
          const l = synthese[s.id];
          const n = l?.mouvements ?? 0;
          const manquants = l?.coursManquants ?? 0;
          const actif = s.id === selectionId;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={actif ? "true" : undefined}
                onClick={() => onSelection(s.id)}
                onDoubleClick={() => onOuvrir(s.id)}
                className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/70 px-4 py-2.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]", n === 0 && !actif && "opacity-65")}
              >
                <span aria-hidden="true" className={cn("relative grid size-10 place-items-center rounded-xl text-[0.78rem] font-bold", n > 0 ? "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground")}>
                  {initials(s.raisonSociale)}
                  {manquants > 0 && <i className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-warning" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{s.raisonSociale}</span>
                  <span className="block truncate text-xs text-muted-foreground">{n > 0 ? `${n} mouvement${n > 1 ? "s" : ""}${l?.dernierLe ? ` · ${ilYA(l.dernierLe)}` : ""}` : "Aucun mouvement"}</span>
                </span>
                {manquants > 0 ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{manquants} à saisir</span>
                ) : l && l.enDevise > 0 ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />Saisi</span>
                ) : <span />}
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="hidden bg-gradient-to-b from-muted/50 to-card p-5 lg:block" aria-label="Fiche de la société">
        {choisie ? (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-bold text-primary">{choisie.raisonSociale}</h2>
              <p className="text-[0.8125rem] text-muted-foreground">{choisie.theme} · {choisie.rne || "RNE non renseigné"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2.5">
              {([
                ["Mouvements", String(ligne?.mouvements ?? 0), "text-primary"],
                ["Valeur du stock", ligne && ligne.valeur > 0 ? montant(ligne.valeur) : "—", ligne && ligne.valeur > 0 ? "text-primary" : "text-muted-foreground/60"],
                ["Alertes", String(ligne?.alertes ?? 0), (ligne?.alertes ?? 0) > 0 ? "text-destructive" : "text-primary"],
                ["Dernier mouvement", ligne?.dernierLe ? jourMois(ligne.dernierLe) : "—", ligne?.dernierLe ? "text-primary" : "text-muted-foreground/60"],
              ] as const).map(([libelle, valeur, ton]) => (
                <div key={libelle} className="rounded-xl border border-border bg-card px-3.5 py-3">
                  <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                  <dd className={cn("m-0 mt-0.5 truncate text-xl font-bold tabular-nums tracking-tight", ton)}>{valeur}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5">
              {part === null ? (
                <p className="text-sm text-muted-foreground">Aucun mouvement en devise : pas de cours à saisir.</p>
              ) : (
                <>
                  <Anneau part={part} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{part === 100 ? "Cours saisis" : `${part} % saisis`}</p>
                    <p className="text-xs text-muted-foreground">{(ligne?.coursManquants ?? 0) > 0 ? `${ligne?.coursManquants} cours à saisir` : "Tous les cours sont saisis"}</p>
                  </div>
                  {(ligne?.coursManquants ?? 0) > 0 && (
                    <Link to="/cours-change" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-primary hover:bg-accent/10">
                      <Coins className="size-3.5" aria-hidden="true" />
                      Saisir les cours
                    </Link>
                  )}
                </>
              )}
            </div>
            <section className="rounded-xl border border-border bg-card px-4 py-3.5" aria-label="Activité récente">
              <h3 className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Activité récente</h3>
              {recentes === null ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : recentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune opération pour le moment.</p>
              ) : (
                <ol className="space-y-1.5">
                  {recentes.map((o, i) => (
                    <li key={`${o.type}-${o.date}-${i}`} className="flex gap-2.5 text-[0.8125rem]">
                      <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-primary/40")} />
                      <span className="min-w-0">
                        <b className="font-semibold text-foreground">{o.type}</b> <span className="text-muted-foreground">· {jourComplet(o.date)}</span>
                        {o.detail && <span className="block truncate text-xs text-muted-foreground">{o.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <button
              type="button"
              onClick={() => onOuvrir(choisie.id)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ouvrir le stock
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choisissez une société pour voir sa fiche.</p>
        )}
      </aside>
    </div>
  );
}
