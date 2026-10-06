import { Fragment, useState } from "react";
import { ChevronRight, FolderInput, Paperclip, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { fmtMontant, fmtQuantite, recapStock, totauxCote } from "@/lib/stockRecap";
import type { StockLigne, StockMouvement } from "@/types";

type Categorie = "achat" | "vente" | "douane";

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

const th = "whitespace-nowrap px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "whitespace-nowrap px-3 py-3 align-middle";
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
  const total = recapStock(mouvements);

  const basculer = (id: string) =>
    setOuverts((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  return (
    <div className="overflow-x-auto" data-tour="stock-register">
      <table className="w-full min-w-[66rem] border-collapse text-sm">
        <thead>
          <tr className="border-y border-accent/25 bg-accent/[0.07]">
            <th rowSpan={2} className={`${th} sticky left-0 z-10 min-w-[11rem] bg-[hsl(var(--card))]`}>
              Mouvement
            </th>
            <th rowSpan={2} className={`${thNum} ${debutGroupe}`}>Écart</th>
            <th colSpan={3} className={`${th} ${debutGroupe} text-primary`}>Achat</th>
            <th colSpan={3} className={`${th} ${debutGroupe} text-primary`}>Vente</th>
            <th colSpan={5} className={`${th} ${debutGroupe} text-primary`}>Douane</th>
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
            <th className={`${th} ${debutGroupe}`}>Déclaration</th>
            <th className={th}>Régime</th>
            <th className={thNum}>Taux</th>
            <th className={thNum}>Valeur TND</th>
            <th className={thNum}>PTFN</th>
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
                  <td className={cn(td, "sticky left-0 z-[1] min-w-[11rem] max-w-[14rem]", fond)}>
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
                    {fmtQuantite(m.ecart)}
                  </td>

                  <TiersCell
                    tiers={m.fournisseur}
                    date={m.achatDate}
                    numero={m.achatNumFacture}
                    className={`${td} ${debutGroupe} max-w-[13rem]`}
                  />
                  <td className={tdNum}>{a.produits ? fmtQuantite(a.quantite) : "—"}</td>
                  <MontantCell cote={a} devise={m.achatDevise} />

                  <TiersCell
                    tiers={m.client}
                    date={m.venteDate}
                    numero={m.venteNumFacture}
                    className={`${td} ${debutGroupe} max-w-[13rem]`}
                  />
                  <td className={tdNum}>{v.produits ? fmtQuantite(v.quantite) : "—"}</td>
                  <MontantCell cote={v} devise={m.venteDevise} />

                  <td className={`${td} ${debutGroupe}`}>
                    <p className="font-mono text-xs">{m.douaneNumDeclaration || "—"}</p>
                    {m.douaneDate && <p className="text-xs text-muted-foreground">{jour(m.douaneDate)}</p>}
                  </td>
                  <td className={td}>{m.douaneRegime || "—"}</td>
                  <td className={tdNum}>{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "—"}</td>
                  <td className={tdNum}>{montantOuTiret(m.douaneValeurTnd)}</td>
                  <td className={tdNum}>{montantOuTiret(m.douanePtfn)}</td>

                  <td className={`${td} text-center`}>
                    <span className="inline-flex items-center gap-1.5">
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
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {ouvert && (
                  <tr className="border-b border-accent/20 bg-secondary/30">
                    <td colSpan={15} className="px-5 py-4">
                      <DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} />
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
              Total · {total.mouvements} mouvement{total.mouvements > 1 ? "s" : ""}
            </td>
            <td className={cn(tdNum, debutGroupe, total.ecart !== 0 && "text-destructive")}>{fmtQuantite(total.ecart)}</td>
            <td className={`${td} ${debutGroupe}`} />
            <td className={tdNum}>{fmtQuantite(total.achat.quantite)}</td>
            <td className={tdNum}>{total.achat.montantTnd ? `${fmtMontant(total.achat.montantTnd)} TND` : ""}</td>
            <td className={`${td} ${debutGroupe}`} />
            <td className={tdNum}>{fmtQuantite(total.vente.quantite)}</td>
            <td className={tdNum}>{total.vente.montantTnd ? `${fmtMontant(total.vente.montantTnd)} TND` : ""}</td>
            <td className={`${td} ${debutGroupe}`} colSpan={5} />
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

function LignesProduits({ titre, lignes, devise }: { titre: string; lignes: StockLigne[]; devise: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{titre}</p>
      {lignes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun produit.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 pr-2 text-left font-semibold">Désignation</th>
              <th className="px-2 py-1 text-right font-semibold">Qté</th>
              <th className="px-2 py-1 text-right font-semibold">P.U. ({devise})</th>
              <th className="px-2 py-1 text-right font-semibold">Montant</th>
              <th className="py-1 pl-2 text-right font-semibold">TND</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id ?? i} className="border-t border-accent/20">
                <td className="py-1.5 pr-2 text-foreground">{l.designation || "(sans désignation)"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtQuantite(l.quantite)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.prixUnitaire ? fmtMontant(l.prixUnitaire) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.montantDevise ? fmtMontant(l.montantDevise) : "—"}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{l.montantTnd ? fmtMontant(l.montantTnd) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DetailMouvement({
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
  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <LignesProduits titre="Produits achetés" lignes={m.achatLignes} devise={m.achatDevise} />
        <LignesProduits titre="Produits vendus" lignes={m.venteLignes} devise={m.venteDevise} />
      </div>

      {m.ecartParDesignation.length > 0 && (
        <div>
          <p className="mb-1.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Écart par produit</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {m.ecartParDesignation.map((e) => (
              <span key={e.designation} className="text-muted-foreground">
                {e.designation}{" "}
                <span className={cn("font-semibold", e.ecart !== 0 ? "text-destructive" : "text-foreground")}>
                  {fmtQuantite(e.ecart)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(m.douaneExportateur || m.douaneImportateur) && (
        <dl className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Exportateur</dt>
            <dd className="text-foreground">{m.douaneExportateur || "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Importateur</dt>
            <dd className="text-foreground">{m.douaneImportateur || "—"}</dd>
          </div>
        </dl>
      )}

      {m.note && <p className="text-xs text-muted-foreground">Note : {m.note}</p>}

      {pieces.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pieces.map((c) => (
            <span key={c} className="inline-flex items-center overflow-hidden rounded-lg border border-accent/30 bg-card text-xs">
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
        </div>
      )}
    </div>
  );
}
