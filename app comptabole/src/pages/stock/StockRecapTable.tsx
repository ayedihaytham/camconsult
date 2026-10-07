import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, FolderInput, Paperclip, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { fmtMontant, fmtQuantiteUnite, recapStock, totauxCote, uniteCommune } from "@/lib/stockRecap";
import type { StockLigne, StockMouvement } from "@/types";

type Categorie = "achat" | "vente" | "douane";

/** Largeur visible d'un conteneur à défilement horizontal (0 si inconnue) : le détail d'une ligne
 * y est ancré, pour rester entier à l'écran au lieu de s'étendre sur toute la largeur du tableau. */
function useLargeurVisible(ref: RefObject<HTMLElement | null>): number {
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [ref]);
  return largeur;
}

interface Props {
  mouvements: StockMouvement[];
  /** Mouvement qui vient d'être enregistré : mis en évidence. */
  nouveauId: string | null;
  /** `${id}-${categorie}` du document en cours de classement. */
  classing: string | null;
  onEdit: (m: StockMouvement) => void;
  onDelete: (m: StockMouvement) => void;
  onPreview: (title: string, dataUrl: string | null) => void;
  onClasser: (m: StockMouvement, categorie: Categorie) => void;
}

const TITRES: Record<Categorie, string> = {
  achat: "Facture d'achat",
  vente: "Document de vente",
  douane: "Document douanier",
};

const th = "overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "overflow-hidden text-ellipsis whitespace-nowrap px-2 py-3 align-middle";
const tdNum = `${td} text-right tabular-nums`;
const debutGroupe = "border-l border-accent/30";

const jour = (d: string | null) => (d ? formatDate(d) : "—");
const montantOuTiret = (n: number) => (n ? fmtMontant(n) : "—");

function docUrl(m: StockMouvement, c: Categorie) {
  return c === "achat" ? m.achatDocDataUrl : c === "vente" ? m.venteDocDataUrl : m.douaneDocDataUrl;
}

/** Récapitulatif des opérations de stock : une ligne par mouvement, achat, vente et
 * douane côte à côte, et le détail des produits et des pièces en dépliant la ligne. */
export function StockRecapTable({ mouvements, nouveauId, classing, onEdit, onDelete, onPreview, onClasser }: Props) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const conteneur = useRef<HTMLDivElement>(null);
  const largeurVisible = useLargeurVisible(conteneur);
  const total = recapStock(mouvements);

  const basculer = (id: string) =>
    setOuverts((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  return (
    <div ref={conteneur} className="overflow-x-auto" data-tour="stock-register">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
        {/* Largeurs en pourcentage : le tableau occupe exactement la largeur de la page. */}
        <colgroup>
          <col style={{ width: "9.5%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "9.5%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "9.5%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "8.5%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "5%" }} />
        </colgroup>
        <thead>
          <tr className="border-y border-accent/25 bg-accent/[0.07]">
            <th rowSpan={2} className={`${th} sticky left-0 z-10 bg-[hsl(var(--card))]`}>
              Mouvement
            </th>
            <th rowSpan={2} className={`${thNum} ${debutGroupe}`}>Écart</th>
            <th colSpan={3} className={`${th} ${debutGroupe} text-primary`}>Achat</th>
            <th colSpan={3} className={`${th} ${debutGroupe} text-primary`}>Vente</th>
            <th colSpan={3} className={`${th} ${debutGroupe} text-primary`}>Douane</th>
            <th rowSpan={2} className={`${th} ${debutGroupe} text-center`}>Pièces</th>
            <th rowSpan={2} className={`${th} sticky right-0 z-10 bg-[hsl(var(--card))]`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
          <tr className="border-b border-accent/25 bg-accent/[0.04]">
            <th className={`${th} ${debutGroupe}`}>Fournisseur · facture</th>
            <th className={thNum}>Qté</th>
            <th className={thNum}>Montant</th>
            <th className={`${th} ${debutGroupe}`}>Client · facture</th>
            <th className={thNum}>Qté</th>
            <th className={thNum}>Montant</th>
            <th className={`${th} ${debutGroupe}`}>Type</th>
            <th className={thNum}>Taux</th>
            <th className={thNum}>Valeur TND</th>
          </tr>
        </thead>

        <tbody>
          {mouvements.map((m) => {
            const a = totauxCote(m.achatLignes);
            const v = totauxCote(m.venteLignes);
            const ouvert = ouverts.has(m.id);
            const fond = nouveauId === m.id ? "bg-accent/15" : "bg-card";
            return (
              <Fragment key={m.id}>
                <tr
                  id={`mouvement-${m.id}`}
                  onClick={() => basculer(m.id)}
                  className={cn(
                    "cursor-pointer border-b border-accent/20 transition-colors hover:bg-accent/[0.06]",
                    nouveauId === m.id && "bg-accent/15",
                  )}
                >
                  <td className={cn(td, "sticky left-0 z-[1]", fond)}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={ouvert}
                        aria-label={ouvert ? "Masquer le détail" : "Afficher le détail"}
                        onClick={(e) => {
                          e.stopPropagation();
                          basculer(m.id);
                        }}
                        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform", ouvert && "rotate-90")} />
                      </button>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary" title={m.natureMarchandise}>
                          {m.natureMarchandise || "Mouvement sans nature"}
                        </p>
                        {(a.produits > 1 || v.produits > 1) && (
                          <p className="text-xs text-muted-foreground">
                            {Math.max(a.produits, v.produits)} produits
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className={cn(tdNum, debutGroupe, "font-bold", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>
                    {fmtQuantiteUnite(m.ecart, m.ecartUnite)}
                  </td>

                  <TiersCell
                    tiers={m.fournisseur}
                    date={m.achatDate}
                    numero={m.achatNumFacture}
                    className={`${td} ${debutGroupe}`}
                  />
                  <td className={tdNum}>{a.produits ? fmtQuantiteUnite(a.quantite, uniteCommune(m.achatLignes)) : "—"}</td>
                  <MontantCell cote={a} devise={m.achatDevise} />

                  <TiersCell
                    tiers={m.client}
                    date={m.venteDate}
                    numero={m.venteNumFacture}
                    className={`${td} ${debutGroupe}`}
                  />
                  <td className={tdNum}>{v.produits ? fmtQuantiteUnite(v.quantite, uniteCommune(m.venteLignes)) : "—"}</td>
                  <MontantCell cote={v} devise={m.venteDevise} />

                  <td className={`${td} ${debutGroupe}`}>{m.douaneTypeDeclaration || "—"}</td>
                  <td className={tdNum}>{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "—"}</td>
                  <td className={tdNum}>{montantOuTiret(m.douaneValeurTnd)}</td>

                  <td className={`${td} text-center`}>
                    <span className="inline-flex items-center gap-0.5">
                      {(["achat", "vente", "douane"] as const).map((c) =>
                        docUrl(m, c) ? (
                          <button
                            key={c}
                            type="button"
                            title={`Voir : ${TITRES[c]}`}
                            aria-label={`Voir : ${TITRES[c]}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreview(TITRES[c], docUrl(m, c));
                            }}
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.62rem] font-bold uppercase text-muted-foreground hover:bg-accent/15 hover:text-primary"
                          >
                            <Paperclip className="h-3 w-3" aria-hidden="true" />
                            {c[0]}
                          </button>
                        ) : null,
                      )}
                      {!m.achatDocDataUrl && !m.venteDocDataUrl && !m.douaneDocDataUrl && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </td>

                  <td className={cn(td, "sticky right-0 z-[1]", fond)}>
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label="Modifier ce mouvement"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(m);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Supprimer ce mouvement"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(m);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {ouvert && (
                  <tr className="border-b border-accent/20 bg-secondary/30">
                    <td colSpan={13} className="p-0">
                      <div
                        className="sticky left-0 box-border px-5 py-4"
                        style={largeurVisible ? { width: largeurVisible } : undefined}
                      >
                        <DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-accent/40 bg-accent/[0.07] font-bold text-primary">
            <td className={cn(td, "sticky left-0 z-[1] bg-[hsl(var(--card))]")}>
              <span title={`${total.mouvements} mouvement${total.mouvements > 1 ? "s" : ""}`}>Total ({total.mouvements})</span>
            </td>
            <td className={cn(tdNum, debutGroupe, total.ecart !== 0 && "text-destructive")}>{fmtQuantiteUnite(total.ecart, total.unite)}</td>
            <td className={`${td} ${debutGroupe}`} />
            <td className={tdNum}>{fmtQuantiteUnite(total.achat.quantite, total.unite)}</td>
            <td className={tdNum}>{total.achat.montantTnd ? `${fmtMontant(total.achat.montantTnd)} TND` : ""}</td>
            <td className={`${td} ${debutGroupe}`} />
            <td className={tdNum}>{fmtQuantiteUnite(total.vente.quantite, total.unite)}</td>
            <td className={tdNum}>{total.vente.montantTnd ? `${fmtMontant(total.vente.montantTnd)} TND` : ""}</td>
            <td className={`${td} ${debutGroupe}`} colSpan={3} />
            <td className={`${td} ${debutGroupe}`} />
            <td className={cn(td, "sticky right-0 z-[1] bg-[hsl(var(--card))]")} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Tiers (fournisseur ou client) avec, dessous, la date et le n° de la facture. */
function TiersCell({
  tiers,
  date,
  numero,
  className,
}: {
  tiers: string;
  date: string | null;
  numero: string;
  className: string;
}) {
  return (
    <td className={className}>
      <p className="truncate font-medium text-foreground" title={tiers}>{tiers || "—"}</p>
      {(date || numero) && (
        <p className="text-xs text-muted-foreground">
          {date && <span>{jour(date)}</span>}
          {date && numero && " · "}
          {numero && <span className="font-mono">{numero}</span>}
        </p>
      )}
    </td>
  );
}

/** Montant dans la devise de la facture et, dessous, sa contre-valeur en dinars si elle est connue. */
function MontantCell({ cote, devise }: { cote: ReturnType<typeof totauxCote>; devise: string }) {
  if (!cote.montantDevise) return <td className={tdNum}>—</td>;
  return (
    <td className={tdNum}>
      <p>
        {fmtMontant(cote.montantDevise)} <span className="text-xs text-muted-foreground">{devise}</span>
      </p>
      {cote.montantTnd ? <p className="text-xs text-muted-foreground">{fmtMontant(cote.montantTnd)} TND</p> : null}
    </td>
  );
}

const etiquette = "text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground";

function Fait({ label, children, large = false }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={cn("min-w-0", large && "col-span-2")}>
      <dt className={etiquette}>{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

function LignesProduits({ lignes, devise }: { lignes: StockLigne[]; devise: string }) {
  const total = totauxCote(lignes);
  const unite = uniteCommune(lignes);
  if (lignes.length === 0) return <p className="text-sm text-muted-foreground">Aucun produit.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 pr-2 text-left font-semibold">Produit</th>
            <th className="px-2 py-1 text-right font-semibold">Qté</th>
            <th className="px-2 py-1 text-right font-semibold">P.U.</th>
            <th className="px-2 py-1 text-right font-semibold" title={`Montant en ${devise}`}>Montant</th>
            <th className="py-1 pl-2 text-right font-semibold">TND</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.id ?? i} className="border-t border-accent/20 align-top">
              <td className="py-1.5 pr-2 text-foreground">{l.designation || "(sans désignation)"}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(l.quantite, l.unite ?? "")}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{l.prixUnitaire ? fmtMontant(l.prixUnitaire) : "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{l.montantDevise ? fmtMontant(l.montantDevise) : "—"}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">{l.montantTnd ? fmtMontant(l.montantTnd) : "—"}</td>
            </tr>
          ))}
        </tbody>
        {lignes.length > 1 && (
          <tfoot>
            <tr className="border-t-2 border-accent/30 font-semibold text-primary">
              <td className="py-1.5 pr-2">Total</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(total.quantite, unite)}</td>
              <td />
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtMontant(total.montantDevise)}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">{total.montantTnd ? fmtMontant(total.montantTnd) : "—"}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Carte({ titre, resume, children }: { titre: string; resume?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-accent/30 bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2 border-b border-accent/25 pb-2">
        <h3 className="font-serif text-lg font-medium text-primary">{titre}</h3>
        {resume && <span className="text-xs text-muted-foreground">{resume}</span>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CarteFacture({
  titre,
  tiersLabel,
  tiers,
  date,
  numero,
  devise,
  cours,
  lignes,
}: {
  titre: string;
  tiersLabel: string;
  tiers: string;
  date: string | null;
  numero: string;
  devise: string;
  cours: number;
  lignes: StockLigne[];
}) {
  const vide = !tiers && !date && !numero && lignes.length === 0;
  return (
    <Carte
      titre={titre}
      resume={vide ? undefined : `${devise}${cours ? ` · cours ${cours.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}` : ""}`}
    >
      {vide ? (
        <p className="text-sm text-muted-foreground">Rien de renseigné.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Fait label={tiersLabel} large>{tiers}</Fait>
            <Fait label="Date">{date ? formatDate(date) : ""}</Fait>
            <Fait label="N° facture">{numero && <span className="font-mono text-xs">{numero}</span>}</Fait>
          </dl>
          <LignesProduits lignes={lignes} devise={devise} />
        </>
      )}
    </Carte>
  );
}

function CarteDouane({ m }: { m: StockMouvement }) {
  const rien = !m.douaneNumDeclaration && !m.douaneDate && !m.douaneValeurTnd && !m.douanePtfn && !m.douaneExportateur && !m.douaneImportateur;
  return (
    <Carte titre="Douane">
      {rien ? (
        <p className="text-sm text-muted-foreground">Aucune déclaration douanière.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Fait label="N° déclaration">{m.douaneNumDeclaration && <span className="font-mono text-xs">{m.douaneNumDeclaration}</span>}</Fait>
          <Fait label="Date">{m.douaneDate ? formatDate(m.douaneDate) : ""}</Fait>
          <Fait label="Type de déclaration">{m.douaneTypeDeclaration}</Fait>
          <Fait label="Taux de change">{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : ""}</Fait>
          <Fait label="Valeur en douane (TND)">{m.douaneValeurTnd ? fmtMontant(m.douaneValeurTnd) : ""}</Fait>
          <Fait label="PTFN">{m.douanePtfn ? fmtMontant(m.douanePtfn) : ""}</Fait>
          <Fait label="Exportateur" large>{m.douaneExportateur}</Fait>
          <Fait label="Importateur" large>{m.douaneImportateur}</Fait>
        </dl>
      )}
    </Carte>
  );
}

export function DetailMouvement({
  m,
  classing,
  onPreview,
  onClasser,
}: {
  m: StockMouvement;
  classing: string | null;
  onPreview: Props["onPreview"];
  onClasser: Props["onClasser"];
}) {
  const pieces = (["achat", "vente", "douane"] as const).filter((c) => docUrl(m, c));
  // Un détail par produit n'a de sens que si une facture en liste plusieurs : avec un seul
  // produit de chaque côté, des désignations rédigées différemment donneraient un écart
  // « +370 / −370 » trompeur alors que le total est nul.
  const detailParProduit = m.achatLignes.length > 1 || m.venteLignes.length > 1;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <CarteFacture
          titre="Achat"
          tiersLabel="Fournisseur"
          tiers={m.fournisseur}
          date={m.achatDate}
          numero={m.achatNumFacture}
          devise={m.achatDevise}
          cours={m.achatCours}
          lignes={m.achatLignes}
        />
        <CarteFacture
          titre="Vente"
          tiersLabel="Client"
          tiers={m.client}
          date={m.venteDate}
          numero={m.venteNumFacture}
          devise={m.venteDevise}
          cours={m.venteCours}
          lignes={m.venteLignes}
        />
        <CarteDouane m={m} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-accent/30 bg-card px-4 py-3 text-sm">
        <span>
          <span className={etiquette}>Écart achat − vente </span>
          <span className={cn("font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>
            {fmtQuantiteUnite(m.ecart, m.ecartUnite)}
          </span>
        </span>
        {detailParProduit &&
          m.ecartParDesignation.map((e) => (
            <span key={e.designation} className="text-xs text-muted-foreground">
              {e.designation}{" "}
              <span className={cn("font-semibold", e.ecart !== 0 ? "text-destructive" : "text-foreground")}>
                {fmtQuantiteUnite(e.ecart, m.ecartUnite)}
              </span>
            </span>
          ))}
        {m.note && <span className="text-xs text-muted-foreground">Note : {m.note}</span>}

        {pieces.length > 0 && (
          <span className="ml-auto flex flex-wrap gap-2">
            {pieces.map((c) => (
              <span key={c} className="inline-flex items-center overflow-hidden rounded-lg border border-accent/30 bg-secondary/40 text-xs">
                <button
                  type="button"
                  onClick={() => onPreview(TITRES[c], docUrl(m, c))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-primary hover:bg-accent/10"
                >
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  {TITRES[c]}
                </button>
                <button
                  type="button"
                  disabled={classing === `${m.id}-${c}`}
                  onClick={() => onClasser(m, c)}
                  title="Classer dans Structuration"
                  aria-label={`Classer dans Structuration : ${TITRES[c]}`}
                  className="border-l border-accent/30 px-2.5 py-1.5 text-muted-foreground hover:bg-accent/10 hover:text-primary disabled:opacity-50"
                >
                  <FolderInput className={cn("h-3.5 w-3.5", classing === `${m.id}-${c}` && "animate-pulse")} />
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
