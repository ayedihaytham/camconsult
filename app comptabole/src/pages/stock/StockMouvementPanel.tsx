import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn, formatDate } from "@/lib/utils";
import { fmtMontant, fmtQuantiteUnite, totauxCote, ecartDevise, uniteCommune } from "@/lib/stockRecap";
import { coteRenseigne, type CoteMouvement } from "@/lib/stockLot";
import { situationMouvement, type SituationStock } from "@/lib/stockFiltres";
import type { StatutFacture } from "@/lib/fournisseurs";
import type { StockMouvement } from "@/types";
import { VisionneuseDocument } from "./VisionneuseDocument";
import { docUrl, LignesProduits, PieceCarte, StatutReglement, TITRES } from "./StockRecapTable";

type Onglet = "details" | "pieces";

interface Props {
  /** Mouvement affiché ; null : le panneau est fermé. */
  mouvement: StockMouvement | null;
  /** Rang du mouvement dans la liste affichée (à partir de 1) et taille de cette liste. */
  position: number;
  total: number;
  onNaviguer: (delta: -1 | 1) => void;
  onFermer: () => void;
  onEdit: (m: StockMouvement) => void;
  onDelete: (m: StockMouvement) => void;
  onRetirerCote?: (m: StockMouvement, cote: CoteMouvement) => void;
  onClasser: (m: StockMouvement, categorie: CoteMouvement) => void;
  classing: string | null;
  onPreview: (title: string, dataUrl: string | null) => void;
  /** Règlement de la facture d'achat (Suivi fournisseur), s'il est connu. */
  reglement?: StatutFacture;
}

const SITUATIONS: Record<SituationStock, { texte: (m: StockMouvement) => string; classe: string } | null> = {
  solde: { texte: () => "Soldé", classe: "bg-success/20 text-success" },
  ecart: { texte: (m) => `Écart ${fmtQuantiteUnite(m.ecart, m.ecartUnite)}`, classe: "bg-destructive/15 text-destructive" },
  "sans-achat": { texte: () => "Vendu sans achat", classe: "bg-warning/20 text-warning" },
  "sans-vente": { texte: () => "Acheté, pas vendu", classe: "bg-primary-foreground/20 text-primary-foreground" },
  vide: null,
};

function Champ({ label, children, large = false }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={cn("min-w-0", large && "col-span-2")}>
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium tabular-nums text-foreground">{children || "—"}</dd>
    </div>
  );
}

function Section({ titre, filet, actions, children }: { titre: string; filet: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-border border-t-2 bg-card px-3 py-2.5", filet)}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.09em] text-primary">{titre}</h3>
        <div className="flex items-center gap-1.5">{actions}</div>
      </header>
      {children}
    </section>
  );
}

/** Détail d'un mouvement de stock dans un panneau à droite : les deux factures, la douane (repliée) et les pièces, sans quitter le tableau. */
export function StockMouvementPanel({ mouvement: m, position, total, onNaviguer, onFermer, onEdit, onDelete, onRetirerCote, onClasser, classing, onPreview, reglement }: Props) {
  const [onglet, setOnglet] = useState<Onglet>("details");
  const [piece, setPiece] = useState<CoteMouvement>("vente");
  const id = m?.id ?? null;

  // Un autre mouvement : on revient aux détails, sur la première pièce disponible.
  useEffect(() => {
    setOnglet("details");
  }, [id]);
  useEffect(() => {
    if (!m) return;
    const ordre: CoteMouvement[] = ["vente", "achat", "douane"];
    setPiece((courante) => (docUrl(m, courante) ? courante : ordre.find((c) => docUrl(m, c)) ?? courante));
    // Le choix ne dépend que du mouvement affiché.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function clavier(e: KeyboardEvent<HTMLElement>) {
    const cible = e.target as HTMLElement;
    if (cible.closest("input, textarea, select, [role=dialog] [role=dialog]")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onNaviguer(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onNaviguer(-1);
    }
  }

  const situation = m ? SITUATIONS[situationMouvement(m)] : null;

  return (
    <Sheet open={Boolean(m)} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent
        side="right"
        onKeyDown={clavier}
        // Le focus reste sur le panneau (flèches ↑ ↓ et Échap) au lieu de se poser sur le premier bouton.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        tabIndex={-1}
        className="w-[min(34rem,96vw)] gap-0 rounded-l-xl p-0 outline-none focus:outline-none sm:max-w-[34rem] [&>button:last-child]:text-primary-foreground [&>button:last-child]:opacity-80"
      >
        {m && (
          <>
            <div className="shrink-0 bg-primary px-4 pb-3 pt-3.5 text-primary-foreground">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">Mouvement {position} sur {total}</p>
              <div className="mt-0.5 flex items-start justify-between gap-2 pr-9">
                <SheetTitle className="min-w-0 flex-1 font-sans text-lg font-bold leading-snug text-primary-foreground">{m.natureMarchandise || "Mouvement sans nature"}</SheetTitle>
                <span className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" className="size-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={() => onNaviguer(-1)} aria-label="Mouvement précédent" disabled={total < 2}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="size-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={() => onNaviguer(1)} aria-label="Mouvement suivant" disabled={total < 2}>
                    <ArrowDown className="size-4" />
                  </Button>
                </span>
              </div>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/80">
                <span>N° mouvement {m.venteNumFacture || m.achatNumFacture || "—"}</span>
                {situation && <span className={cn("rounded-full px-2 py-0.5 font-semibold", situation.classe)}>{situation.texte(m)}</span>}
              </SheetDescription>
            </div>

            <div role="tablist" aria-label="Contenu du mouvement" className="flex shrink-0 gap-1 border-b border-border bg-card px-3">
              {([["details", "Détails"], ["pieces", "Pièces"]] as const).map(([valeur, nom]) => (
                <button
                  key={valeur}
                  type="button"
                  role="tab"
                  aria-selected={onglet === valeur}
                  onClick={() => setOnglet(valeur)}
                  className={cn("-mb-px min-h-10 border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", onglet === valeur ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {nom}
                </button>
              ))}
            </div>

            <SheetBody className="space-y-2.5 bg-background px-3.5 py-3">
              {onglet === "details" ? (
                <>
                  <SectionFacture m={m} cote="vente" classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onRetirerCote={onRetirerCote} />
                  <SectionFacture m={m} cote="achat" classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onRetirerCote={onRetirerCote} reglement={reglement} />
                  <SectionDouane m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onRetirerCote={onRetirerCote} />
                  <Resume m={m} />
                  {m.note && <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Note : {m.note}</p>}
                </>
              ) : (
                <div className="space-y-2.5">
                  <div role="group" aria-label="Pièce à afficher" className="flex flex-wrap gap-1.5">
                    {(["vente", "achat", "douane"] as const).map((c) => (
                      <Button key={c} type="button" variant="outline" size="sm" aria-pressed={piece === c} disabled={!docUrl(m, c)} onClick={() => setPiece(c)} className={cn("h-8", piece === c && "border-primary bg-primary/[0.06] font-semibold")}>
                        {c === "vente" ? "Vente" : c === "achat" ? "Achat" : "Douane"}
                      </Button>
                    ))}
                  </div>
                  {docUrl(m, piece) ? (
                    <VisionneuseDocument dataUrl={docUrl(m, piece) as string} titre={TITRES[piece]} className="h-[calc(100vh-17rem)] min-h-72" onAgrandir={() => onPreview(TITRES[piece], docUrl(m, piece))} />
                  ) : (
                    <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Aucune pièce jointe à ce mouvement. Ajoutez-la avec « Modifier ».</p>
                  )}
                </div>
              )}
            </SheetBody>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-4 py-2.5">
              <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => onEdit(m)}>
                Modifier
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-9 text-destructive hover:text-destructive" onClick={() => onDelete(m)}>
                Supprimer le mouvement
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BoutonSupprimer({ m, cote, nom, onRetirerCote }: { m: StockMouvement; cote: CoteMouvement; nom: string; onRetirerCote?: (m: StockMouvement, cote: CoteMouvement) => void }) {
  if (!onRetirerCote || !coteRenseigne(m, cote)) return null;
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onRetirerCote(m, cote)} aria-label={`Supprimer ${nom}`}>
      <Trash2 className="size-3.5" aria-hidden="true" />
      Supprimer
    </Button>
  );
}

interface SectionProps {
  m: StockMouvement;
  classing: string | null;
  onPreview: Props["onPreview"];
  onClasser: Props["onClasser"];
  onEdit: Props["onEdit"];
  onRetirerCote?: Props["onRetirerCote"];
}

function SectionFacture({ m, cote, classing, onPreview, onClasser, onEdit, onRetirerCote, reglement }: SectionProps & { cote: "vente" | "achat"; reglement?: StatutFacture }) {
  const v = cote === "vente";
  const lignes = v ? m.venteLignes : m.achatLignes;
  const devise = v ? m.venteDevise : m.achatDevise;
  const cours = v ? m.venteCours : m.achatCours;
  const t = totauxCote(lignes);
  const titre = v ? "Vente" : "Achat";
  if (!coteRenseigne(m, cote)) {
    return (
      <Section titre={titre} filet={v ? "border-t-primary" : "border-t-accent"}>
        <p className="mt-1.5 text-sm text-muted-foreground">{v ? "Aucune facture de vente." : "Aucune facture d'achat."}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2 h-7 border-dashed text-xs text-info" onClick={() => onEdit(m)}>
          + Ajouter {v ? "la facture de vente" : "la facture d'achat"}
        </Button>
      </Section>
    );
  }
  const date = v ? m.venteDate : m.achatDate;
  return (
    <Section
      titre={titre}
      filet={v ? "border-t-primary" : "border-t-accent"}
      actions={
        <>
          <PieceCarte m={m} categorie={cote} classing={classing} onPreview={onPreview} onClasser={onClasser} />
          <BoutonSupprimer m={m} cote={cote} nom={v ? "la facture de vente" : "la facture d'achat"} onRetirerCote={onRetirerCote} />
        </>
      }
    >
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        <Champ label="N° facture">{v ? m.venteNumFacture : m.achatNumFacture}</Champ>
        <Champ label="Date">{date ? formatDate(date) : ""}</Champ>
        <Champ label={v ? "Client" : "Fournisseur"} large>{v ? m.client : m.fournisseur}</Champ>
        <Champ label="Devise · cours">{devise}{cours ? ` · ${cours.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}` : ""}</Champ>
        <Champ label="Quantité">{lignes.length > 0 ? fmtQuantiteUnite(t.quantite, uniteCommune(lignes)) : ""}</Champ>
        <Champ label="Montant en devise">{t.montantDevise ? `${fmtMontant(t.montantDevise)} ${devise}` : ""}</Champ>
        <Champ label="Montant TND">{t.montantTnd ? <b className="text-primary">{fmtMontant(t.montantTnd)}</b> : ""}</Champ>
        {!v && reglement && <Champ label="Règlement"><StatutReglement statut={reglement} /></Champ>}
      </dl>
      <div className="mt-2.5">
        <LignesProduits lignes={lignes} devise={devise} />
      </div>
    </Section>
  );
}

function SectionDouane({ m, classing, onPreview, onClasser, onEdit, onRetirerCote }: SectionProps) {
  const presente = coteRenseigne(m, "douane");
  if (!presente) {
    return (
      <Section titre="Douane" filet="border-t-success">
        <p className="mt-1.5 text-sm text-muted-foreground">Aucune déclaration douanière.</p>
        <Button type="button" variant="outline" size="sm" className="mt-2 h-7 border-dashed text-xs text-info" onClick={() => onEdit(m)}>
          + Ajouter une déclaration
        </Button>
      </Section>
    );
  }
  return (
    <details className="group rounded-lg border border-border border-t-2 border-t-success bg-card px-3 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.09em] text-primary">Douane{m.douaneNumDeclaration ? ` · déclaration ${m.douaneNumDeclaration}` : ""}</h3>
        <span className="text-xs font-semibold text-info group-open:hidden">Afficher</span>
        <span className="hidden text-xs font-semibold text-info group-open:inline">Masquer</span>
      </summary>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        <Champ label="N° déclaration">{m.douaneNumDeclaration}</Champ>
        <Champ label="Date">{m.douaneDate ? formatDate(m.douaneDate) : ""}</Champ>
        <Champ label="Type de déclaration">{m.douaneTypeDeclaration}</Champ>
        <Champ label="Taux de change">{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : ""}</Champ>
        <Champ label="Valeur en douane (TND)">{m.douaneValeurTnd ? fmtMontant(m.douaneValeurTnd) : ""}</Champ>
        <Champ label="PTFN">{m.douanePtfn ? fmtMontant(m.douanePtfn) : ""}</Champ>
        <Champ label="Exportateur" large>{m.douaneExportateur}</Champ>
        <Champ label="Importateur" large>{m.douaneImportateur}</Champ>
      </dl>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <PieceCarte m={m} categorie="douane" classing={classing} onPreview={onPreview} onClasser={onClasser} />
        <BoutonSupprimer m={m} cote="douane" nom="la déclaration douanière" onRetirerCote={onRetirerCote} />
      </div>
    </details>
  );
}

function Resume({ m }: { m: StockMouvement }) {
  const ecart = ecartDevise(m);
  const marge = totauxCote(m.venteLignes).montantTnd - totauxCote(m.achatLignes).montantTnd;
  const avecLesDeux = m.venteLignes.length > 0 && m.achatLignes.length > 0;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span>
        Écart achat − vente : <b className={cn("tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>{fmtQuantiteUnite(m.ecart, m.ecartUnite)}</b>
      </span>
      {ecart && (
        <span>
          Vente − achat (devise) : <b className={cn("tabular-nums", ecart.valeur !== 0 ? "text-destructive" : "text-foreground")}>{fmtMontant(ecart.valeur)} {ecart.devise}</b>
        </span>
      )}
      {avecLesDeux && (
        <span>
          Marge TND : <b className={cn("tabular-nums", marge >= 0 ? "text-success" : "text-destructive")}>{fmtMontant(marge)}</b>
        </span>
      )}
    </div>
  );
}
