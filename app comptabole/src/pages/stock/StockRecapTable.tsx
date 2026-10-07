import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, FolderInput, Paperclip, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ecartDevise, ecartsDeviseTotaux, fmtMontant, fmtQuantiteUnite, recapStock, totauxCote, uniteCommune } from "@/lib/stockRecap";
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

const th = "overflow-hidden text-ellipsis whitespace-nowrap px-1 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "overflow-hidden text-ellipsis whitespace-nowrap px-1 py-2.5 align-middle";
const tdNum = `${td} text-right tabular-nums`;
const debutGroupe = "border-l border-accent/30";

const jour = (d: string | null) => (d ? formatDate(d) : "—");
const montantOuTiret = (n: number) => (n ? fmtMontant(n) : "—");

function docUrl(m: StockMouvement, c: Categorie) {
  return c === "achat" ? m.achatDocDataUrl : c === "vente" ? m.venteDocDataUrl : m.douaneDocDataUrl;
}

/** Colonnes de chaque côté (achat, vente) : les mêmes que le tableau Excel du cabinet. */
const COTE_COLONNES = 8;

/** Largeurs en pourcentage : le tableau occupe exactement la largeur de la page. */
const LARGEURS = [
  1.5, 6.2, 3.6, // N°, mouvement, écart
  4.8, 4.9, 5.5, 4.7, 5.2, 3.4, 3.7, 5.6, // achat : date, facture, tiers, qté, en devise, devise, cours, MT TND
  4.8, 4.9, 5.5, 4.7, 5.2, 3.4, 3.7, 5.6, // vente
  5.3, // douane : valeur TND
  4.2, 3.6, // pièces, actions
];

const NB_COLONNES = LARGEURS.length;

const coursTexte = (c: number) => (c ? c.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "—");

/** Cellules d'un côté (achat ou vente) : date, n° de facture, tiers, quantité, montant en devise,
 * devise, cours et montant en dinars. */
function CoteCellules({
  lignes,
  tiers,
  date,
  numero,
  devise,
  cours,
}: {
  lignes: StockLigne[];
  tiers: string;
  date: string | null;
  numero: string;
  devise: string;
  cours: number;
}) {
  const t = totauxCote(lignes);
  const vide = lignes.length === 0;
  return (
    <>
      <td className={`${td} ${debutGroupe}`}>{jour(date)}</td>
      <td className={`${td} font-mono text-[0.7rem]`} title={numero}>{numero || "—"}</td>
      <td className={`${td} font-medium text-foreground`} title={tiers}>{tiers || "—"}</td>
      <td className={tdNum}>{vide ? "—" : fmtQuantiteUnite(t.quantite, uniteCommune(lignes))}</td>
      <td className={tdNum}>{t.montantDevise ? fmtMontant(t.montantDevise) : "—"}</td>
      <td className={`${td} text-muted-foreground`}>{t.montantDevise ? devise : "—"}</td>
      <td className={tdNum}>{coursTexte(cours)}</td>
      <td className={tdNum}>{montantOuTiret(t.montantTnd)}</td>
    </>
  );
}

function EnTeteCote({ tiers }: { tiers: string }) {
  return (
    <>
      <th className={`${th} ${debutGroupe}`}>Date</th>
      <th className={th}>N° facture</th>
      <th className={th}>{tiers}</th>
      <th className={thNum}>Qté</th>
      <th className={thNum}>En devise</th>
      <th className={th}>Devise</th>
      <th className={thNum}>Cours</th>
      <th className={thNum}>MT TND</th>
    </>
  );
}

/** Récapitulatif des opérations de stock : une ligne par mouvement, avec les attributs du tableau
 * Excel du cabinet — achat et vente côte à côte (date, facture, tiers, quantité, montant en devise,
 * devise, cours, montant en dinars), valeur en douane, écart — et le détail complet (type et n° de
 * déclaration, taux, produits, pièces) en dépliant la ligne. La nature de la marchandise n'est
 * écrite qu'une seule fois, dans la colonne Mouvement. */
export function StockRecapTable({ mouvements, nouveauId, classing, onEdit, onDelete, onPreview, onClasser }: Props) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const conteneur = useRef<HTMLDivElement>(null);
  const largeurVisible = useLargeurVisible(conteneur);
  const total = recapStock(mouvements);
  const ecarts = ecartsDeviseTotaux(mouvements);

  const basculer = (id: string) =>
    setOuverts((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  return (
    <div ref={conteneur} className="overflow-x-auto" data-tour="stock-register">
      <table className="w-full min-w-[84rem] table-fixed border-collapse text-xs">
        <colgroup>
          {LARGEURS.map((l, i) => (
            <col key={i} style={{ width: `${l}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-y border-accent/25 bg-accent/[0.07]">
            <th rowSpan={2} className={th}>N°</th>
            <th rowSpan={2} className={th}>Mouvement</th>
            <th rowSpan={2} className={`${thNum} ${debutGroupe}`}>Écart</th>
            <th colSpan={COTE_COLONNES} className={`${th} ${debutGroupe} text-primary`}>Vente</th>
            <th colSpan={COTE_COLONNES} className={`${th} ${debutGroupe} text-primary`}>Achat</th>
            <th className={`${th} ${debutGroupe} text-primary`}>Douane</th>
            <th rowSpan={2} className={`${th} ${debutGroupe} text-center`}>Pièces</th>
            <th rowSpan={2} className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
          <tr className="border-b border-accent/25 bg-accent/[0.04]">
            <EnTeteCote tiers="Client" />
            <EnTeteCote tiers="Fournisseur" />
            <th className={`${th} ${debutGroupe}`}>N° déclaration</th>
          </tr>
        </thead>

        <tbody>
          {mouvements.map((m, index) => {
            const ouvert = ouverts.has(m.id);
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
                  <td className={`${td} text-muted-foreground`}>{index + 1}</td>
                  <td className={td}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-expanded={ouvert}
                        aria-label={ouvert ? "Masquer le détail" : "Afficher le détail"}
                        onClick={(e) => {
                          e.stopPropagation();
                          basculer(m.id);
                        }}
                        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ouvert && "rotate-90")} />
                      </button>
                      <p className="min-w-0 truncate font-semibold text-primary" title={m.natureMarchandise}>
                        {m.natureMarchandise || "Mouvement sans nature"}
                      </p>
                    </div>
                  </td>
                  <td className={cn(tdNum, debutGroupe, "font-bold", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>
                    {fmtQuantiteUnite(m.ecart, m.ecartUnite)}
                  </td>

                  <CoteCellules
                    lignes={m.venteLignes}
                    tiers={m.client}
                    date={m.venteDate}
                    numero={m.venteNumFacture}
                    devise={m.venteDevise}
                    cours={m.venteCours}
                  />
                  <CoteCellules
                    lignes={m.achatLignes}
                    tiers={m.fournisseur}
                    date={m.achatDate}
                    numero={m.achatNumFacture}
                    devise={m.achatDevise}
                    cours={m.achatCours}
                  />

                  <td className={`${td} ${debutGroupe} font-mono text-[0.7rem]`} title={m.douaneNumDeclaration}>
                    {m.douaneNumDeclaration || "—"}
                  </td>

                  <td className={`${td} ${debutGroupe} text-center`}>
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
                            className="inline-flex size-[1.15rem] items-center justify-center rounded border border-accent/40 text-[0.62rem] font-bold uppercase text-primary hover:bg-accent/15"
                          >
                            {c[0]}
                          </button>
                        ) : null,
                      )}
                      {!m.achatDocDataUrl && !m.venteDocDataUrl && !m.douaneDocDataUrl && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </td>

                  <td className={td}>
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
                    <td colSpan={NB_COLONNES} className="p-0">
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
            <td className={td} colSpan={2}>
              <span title={`${total.mouvements} mouvement${total.mouvements > 1 ? "s" : ""}`}>Total ({total.mouvements})</span>
            </td>
            <td className={cn(tdNum, debutGroupe, total.ecart !== 0 && "text-destructive")}>{fmtQuantiteUnite(total.ecart, total.unite)}</td>
            <td className={`${td} ${debutGroupe}`} colSpan={3} />
            <td className={tdNum}>{fmtQuantiteUnite(total.vente.quantite, total.unite)}</td>
            <td className={`${td} whitespace-nowrap`} colSpan={4} title="Total vente − achat, en devise">
              {ecarts.length > 0 && "Vente − achat : "}
              {ecarts.map((e) => (
                <span key={e.devise} className={cn("mr-2 tabular-nums", e.valeur !== 0 && "text-destructive")}>
                  {fmtMontant(e.valeur)} {e.devise}
                </span>
              ))}
            </td>
            <td className={`${td} ${debutGroupe}`} colSpan={3} />
            <td className={tdNum}>{fmtQuantiteUnite(total.achat.quantite, total.unite)}</td>
            <td className={td} colSpan={4} />
            <td className={`${td} ${debutGroupe}`} />
            <td className={`${td} ${debutGroupe}`} />
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
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
          titre="Vente"
          tiersLabel="Client"
          tiers={m.client}
          date={m.venteDate}
          numero={m.venteNumFacture}
          devise={m.venteDevise}
          cours={m.venteCours}
          lignes={m.venteLignes}
        />
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
        <CarteDouane m={m} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-accent/30 bg-card px-4 py-3 text-sm">
        <span>
          <span className={etiquette}>Écart achat − vente </span>
          <span className={cn("font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>
            {fmtQuantiteUnite(m.ecart, m.ecartUnite)}
          </span>
        </span>
        {ecartDevise(m) && (
          <span>
            <span className={etiquette}>Vente − achat (en devise) </span>
            <span className={cn("font-bold tabular-nums", ecartDevise(m)!.valeur !== 0 ? "text-destructive" : "text-foreground")}>
              {fmtMontant(ecartDevise(m)!.valeur)} {ecartDevise(m)!.devise}
            </span>
          </span>
        )}
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
