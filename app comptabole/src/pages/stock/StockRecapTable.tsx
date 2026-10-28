import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, FolderInput, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { ecartDevise, ecartsDeviseTotaux, fmtMontant, fmtQuantite, fmtQuantiteUnite, recapStock, totauxCote, uniteCommune } from "@/lib/stockRecap";
import { montantCote } from "@/lib/coursStock";
import type { StatutFacture } from "@/lib/fournisseurs";
import { coteRenseigne, type CoteMouvement } from "@/lib/stockLot";
import { LEGENDE_SITUATION, situationMouvement } from "@/lib/stockFiltres";
import type { ColonneStock, DensiteStock } from "@/lib/stockPrefs";
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
  /** Retire un seul type de facture (achat, vente ou douane) du mouvement ; absent : le bouton n'est pas proposé. */
  onRetirerCote?: (m: StockMouvement, cote: CoteMouvement) => void;
  onPreview: (title: string, dataUrl: string | null) => void;
  onClasser: (m: StockMouvement, categorie: Categorie) => void;
  /** Mouvements dont le n° de facture de vente ou d'achat est déjà utilisé par un autre. */
  doublons?: { vente: ReadonlySet<string>; achat: ReadonlySet<string> };
  /** Monnaie des cours et des montants affichés : dinars (cours de la facture) ou dollars (cours par rapport au dollar). */
  base?: "TND" | "USD";
  /** Statut de règlement de chaque facture d'achat (Suivi fournisseur), par id de mouvement ; absent = non affiché. */
  reglements?: ReadonlyMap<string, StatutFacture>;
  /** Colonnes masquables affichées (cours, devise, montant TND, pièce, douane) ; absent : toutes sauf la douane. */
  colonnes?: Record<ColonneStock, boolean>;
  densite?: DensiteStock;
  /** Ouvre le détail d'un mouvement dans le panneau de droite ; absent : le détail s'ouvre sous la ligne. */
  onOuvrir?: (m: StockMouvement) => void;
  /** Mouvement dont le panneau est ouvert : sa ligne est mise en évidence. */
  selectionId?: string | null;
  /** Côtés affichés : les deux (vente puis achat), ou un seul quand on filtre par client (vente) ou par fournisseur (achat) ; la somme est alors donnée sous le tableau. */
  cotes?: "les-deux" | "vente" | "achat";
}

const STATUTS_REGLEMENT: Record<StatutFacture, { texte: string; classe: string }> = {
  reglee: { texte: "Réglée", classe: "bg-success/15 text-success" },
  partielle: { texte: "Partiellement réglée", classe: "bg-warning/15 text-warning" },
  impayee: { texte: "À régler", classe: "bg-destructive/10 text-destructive" },
};

/** Pastille du statut de règlement d'une facture d'achat, calculée dans Suivi fournisseur. */
export function StatutReglement({ statut }: { statut: StatutFacture | undefined }) {
  if (!statut) return null;
  const s = STATUTS_REGLEMENT[statut];
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", s.classe)}>{s.texte}</span>;
}

export const TITRES: Record<Categorie, string> = {
  achat: "Facture d'achat",
  vente: "Document de vente",
  douane: "Document douanier",
};

/** Colonnes du tableau, dans l'ordre : largeur relative (en %) et, pour les colonnes masquables, leur clé. Les largeurs des colonnes
 * affichées sont ramenées à 100 % : le tableau occupe la largeur de la page, sans défilement horizontal. */
const COLONNES_TABLEAU: { cle: string; largeur: number; masquable?: ColonneStock }[] = [
  { cle: "n", largeur: 3.5 },
  { cle: "mouvement", largeur: 13 },
  { cle: "nmvt", largeur: 8.5 },
  { cle: "cote", largeur: 5.5 },
  { cle: "date", largeur: 7.5 },
  { cle: "facture", largeur: 7.5 },
  { cle: "tiers", largeur: 13.5 },
  { cle: "qte", largeur: 7 },
  { cle: "ecart", largeur: 7.5 },
  { cle: "enDevise", largeur: 8, masquable: "devise" },
  { cle: "devise", largeur: 5.5, masquable: "devise" },
  { cle: "cours", largeur: 5.5, masquable: "cours" },
  { cle: "tnd", largeur: 8.5, masquable: "tnd" },
  { cle: "piece", largeur: 5, masquable: "piece" },
  { cle: "douane", largeur: 10, masquable: "douane" },
];
const COLONNES_PAR_DEFAUT: Record<ColonneStock, boolean> = { cours: true, devise: true, tnd: true, piece: true, douane: false };

const th = "whitespace-nowrap border-b border-primary-foreground/20 px-2 py-2 text-left align-middle text-xs font-semibold leading-tight";
const thNum = `${th} text-right`;
const td = "px-2 py-2.5 align-middle [overflow-wrap:anywhere]";
const tdNum = `${td} whitespace-nowrap text-right tabular-nums`;
/** Hauteur des cellules : serrée par défaut (deux lignes par mouvement tiennent mieux), aérée au choix. */
const HAUTEUR = { compact: "[&>td]:py-1.5", aere: "[&>td]:py-2.5" } as const;
const filet = "border-l-2 border-border";
/** Filet des en-têtes marine. */
const filetEntete = "border-l-2 border-l-primary-foreground/30";
const etiquette = "text-xs font-medium text-muted-foreground";

const TEINTE = { vente: "bg-primary/[0.06]", achat: "bg-accent/10", douane: "bg-success/10" } as const;

const jour = (d: string | null) => (d ? formatDate(d) : "—");
const coursTexte = (c: number) => (c ? c.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "—");

export function docUrl(m: StockMouvement, c: Categorie) {
  return c === "achat" ? m.achatDocDataUrl : c === "vente" ? m.venteDocDataUrl : m.douaneDocDataUrl;
}

/** Bouton de pièce jointe d'une facture : ouvre l'aperçu, grisé quand il n'y a pas de pièce. */
function Piece({ m, categorie, onPreview }: { m: StockMouvement; categorie: Categorie; onPreview: Props["onPreview"] }) {
  const url = docUrl(m, categorie);
  if (!url) return <span className="inline-grid size-7 place-items-center text-muted-foreground/40" title="Aucune pièce jointe"><Paperclip className="size-3.5" aria-hidden="true" /></span>;
  return (
    <button
      type="button"
      title={`Voir : ${TITRES[categorie]}`}
      aria-label={`Voir : ${TITRES[categorie]}`}
      onClick={(e) => { e.stopPropagation(); onPreview(TITRES[categorie], url); }}
      className="inline-grid size-7 place-items-center rounded-md border border-border text-primary hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Paperclip className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/** Début d'une ligne de vente ou d'achat : côté, date, n° de facture, tiers et quantité (les colonnes avant l'écart). */
function CoteDebut({ m, cote, doublon, statut }: { m: StockMouvement; cote: "vente" | "achat"; doublon: boolean; statut?: StatutFacture }) {
  const v = cote === "vente";
  const lignes = v ? m.venteLignes : m.achatLignes;
  const numero = v ? m.venteNumFacture : m.achatNumFacture;
  const t = totauxCote(lignes);
  const vide = lignes.length === 0;
  const fond = TEINTE[cote];
  return (
    <>
      <td className={cn(td, fond, v ? "shadow-[inset_4px_0_0_hsl(var(--primary))]" : "shadow-[inset_4px_0_0_hsl(var(--accent))]")}>
        <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", v ? "bg-primary/15 text-primary" : "bg-accent/30 text-accent-foreground")}>{v ? "Vente" : "Achat"}</span>
      </td>
      <td className={cn(td, fond, "whitespace-nowrap tabular-nums")}>{jour(v ? m.venteDate : m.achatDate)}</td>
      <td className={cn(td, fond, "whitespace-nowrap tabular-nums text-[0.78rem] text-foreground/80")} title={doublon ? `${numero} : ce numéro de facture est déjà utilisé par un autre mouvement` : undefined}>
        {doublon ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-destructive/15 px-1 font-semibold text-destructive">
            <AlertTriangle className="size-3 shrink-0" aria-label="Numéro de facture en doublon" />
            {numero}
          </span>
        ) : (numero || "—")}
      </td>
      <td className={cn(td, fond, "font-medium text-foreground")}>
        {(v ? m.client : m.fournisseur) || "—"}
        {!v && !vide && statut && <span className="mt-0.5 block"><StatutReglement statut={statut} /></span>}
      </td>
      <td className={cn(tdNum, fond)}>{vide ? "—" : fmtQuantiteUnite(t.quantite, uniteCommune(lignes))}</td>
    </>
  );
}

/** Fin d'une ligne de vente ou d'achat : montant en devise, devise, cours, montant TND et pièce (selon les colonnes affichées). */
function CoteFin({ m, cote, onPreview, base, colonnes }: { m: StockMouvement; cote: "vente" | "achat"; onPreview: Props["onPreview"]; base: "TND" | "USD"; colonnes: Record<ColonneStock, boolean> }) {
  const v = cote === "vente";
  const lignes = v ? m.venteLignes : m.achatLignes;
  const t = totauxCote(lignes);
  const fond = TEINTE[cote];
  const montant = montantCote(lignes, v ? m.venteCoursUsd : m.achatCoursUsd, base);
  return (
    <>
      {colonnes.devise && <td className={cn(tdNum, fond, filet)}>{t.montantDevise ? fmtMontant(t.montantDevise) : "—"}</td>}
      {colonnes.devise && <td className={cn(td, fond, "text-muted-foreground")}>{t.montantDevise ? (v ? m.venteDevise : m.achatDevise) : "—"}</td>}
      {colonnes.cours && <td className={cn(tdNum, fond, !colonnes.devise && filet)}>{coursTexte(base === "USD" ? (v ? m.venteCoursUsd : m.achatCoursUsd) ?? 0 : v ? m.venteCours : m.achatCours)}</td>}
      {colonnes.tnd && <td className={cn(tdNum, fond, !colonnes.devise && !colonnes.cours && filet, "font-semibold text-primary")}>{montant ? fmtMontant(montant) : "—"}</td>}
      {colonnes.piece && <td className={cn(td, fond, filet, "text-center")}><Piece m={m} categorie={cote} onPreview={onPreview} /></td>}
    </>
  );
}

/** Écart d'un mouvement : valeur en pastille, avec sa situation en clair dessous (« soldé », « sans achat », « sans vente »). */
function CelluleEcart({ m, lignes = 2 }: { m: StockMouvement; lignes?: number }) {
  const legende = LEGENDE_SITUATION[situationMouvement(m)];
  return (
    <td rowSpan={lignes} className={cn(td, filet, "whitespace-nowrap text-center tabular-nums")}>
      <span className={cn("inline-grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-semibold", m.ecart !== 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
        {fmtQuantite(m.ecart)}
      </span>
      {legende && <span className="mt-0.5 block text-[0.65rem] font-normal leading-none text-muted-foreground">{legende}</span>}
    </td>
  );
}

/** Récapitulatif des opérations de stock : chaque mouvement occupe deux lignes aux colonnes alignées, une pour la vente et une pour
 * l'achat, avec la douane à droite ; le détail (produits, déclaration, pièces, actions) s'ouvre sous le mouvement. Le tableau
 * occupe la largeur de la page, sans défilement horizontal ; sur petit écran, chaque mouvement devient une carte. */
export function StockRecapTable({ mouvements, nouveauId, classing, onEdit, onDelete, onRetirerCote, onPreview, onClasser, doublons, base = "TND", reglements, colonnes = COLONNES_PAR_DEFAUT, densite = "compact", onOuvrir, selectionId = null, cotes = "les-deux" }: Props) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const colonnesAffichees = COLONNES_TABLEAU.filter((c) => !c.masquable || colonnes[c.masquable]);
  const sommeLargeurs = colonnesAffichees.reduce((t, c) => t + c.largeur, 0);
  const nbColonnes = colonnesAffichees.length;
  const nbMontants = (colonnes.devise ? 2 : 0) + (colonnes.cours ? 1 : 0) + (colonnes.tnd ? 1 : 0);
  const total = recapStock(mouvements);
  const cotesAffiches: ("vente" | "achat")[] = cotes === "les-deux" ? ["vente", "achat"] : [cotes];
  const hauteur = cotesAffiches.length;
  const premier = cotesAffiches[0];
  /** Somme du côté affiché (filtre par client ou par fournisseur) : quantité, montant par devise et montant en dinars (ou dollars). */
  const sommeCote = cotes === "les-deux" ? null : (() => {
    const parDevise = new Map<string, number>();
    let montantBase = 0;
    for (const m of mouvements) {
      const lignes = cotes === "vente" ? m.venteLignes : m.achatLignes;
      const devise = cotes === "vente" ? m.venteDevise : m.achatDevise;
      const t = totauxCote(lignes);
      if (t.montantDevise) parDevise.set(devise, Math.round(((parDevise.get(devise) ?? 0) + t.montantDevise) * 1000) / 1000);
      montantBase += montantCote(lignes, cotes === "vente" ? m.venteCoursUsd : m.achatCoursUsd, base);
    }
    return { parDevise: [...parDevise.entries()], montantBase: Math.round(montantBase * 1000) / 1000, quantite: cotes === "vente" ? total.vente.quantite : total.achat.quantite };
  })();
  const ecarts = ecartsDeviseTotaux(mouvements);
  const marge = mouvements.reduce((s, m) => s + montantCote(m.venteLignes, m.venteCoursUsd, base) - montantCote(m.achatLignes, m.achatCoursUsd, base), 0);

  const basculer = (id: string) =>
    setOuverts((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  return (
    <div data-tour="stock-register">
      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-[0.8125rem]">
          <colgroup>
            {colonnesAffichees.map((c) => <col key={c.cle} style={{ width: `${(c.largeur / sommeLargeurs) * 100}%` }} />)}
          </colgroup>
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th scope="col" rowSpan={2} className={th}>N°</th>
              <th scope="colgroup" colSpan={2} className={cn(th, "text-center text-[0.6875rem] tracking-[0.14em]")}>MOUVEMENT</th>
              <th scope="colgroup" colSpan={5} className={cn(th, filetEntete, "text-center text-[0.6875rem] tracking-[0.14em]")}>{cotes === "les-deux" ? "FACTURE" : cotes === "vente" ? "VENTE" : "ACHAT"}</th>
              <th scope="col" rowSpan={2} className={cn(th, filetEntete, "text-center")}>Écart</th>
              {nbMontants > 0 && <th scope="colgroup" colSpan={nbMontants} className={cn(th, filetEntete, "text-center text-[0.6875rem] tracking-[0.14em]")}>MONTANTS</th>}
              {colonnes.piece && <th scope="col" rowSpan={2} className={cn(th, filetEntete, "text-center")}>Pièce</th>}
              {colonnes.douane && <th scope="col" rowSpan={2} className={cn(th, filetEntete)}>Douane</th>}
            </tr>
            <tr>
              <th scope="col" className={th}>Mouvement</th>
              <th scope="col" className={th}>N° mouvement</th>
              <th scope="col" className={cn(th, filetEntete)}>Côté</th>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}>N° facture</th>
              <th scope="col" className={th}>Client / Fournisseur</th>
              <th scope="col" className={thNum}>Qté</th>
              {colonnes.devise && <th scope="col" className={cn(thNum, filetEntete)}>En devise</th>}
              {colonnes.devise && <th scope="col" className={th}>Devise</th>}
              {colonnes.cours && <th scope="col" className={cn(thNum, !colonnes.devise && filetEntete)}>{base === "USD" ? "Cours USD" : "Cours"}</th>}
              {colonnes.tnd && <th scope="col" className={cn(thNum, !colonnes.devise && !colonnes.cours && filetEntete)}>{base === "USD" ? "MT USD" : "MT TND"}</th>}
            </tr>
          </thead>
          <tbody>
            {mouvements.map((m, index) => {
              const ouvert = !onOuvrir && ouverts.has(m.id);
              const surbrillance = nouveauId === m.id;
              const choisi = selectionId === m.id;
              const activer = () => (onOuvrir ? onOuvrir(m) : basculer(m.id));
              const ligneClasse = cn("cursor-pointer", HAUTEUR[densite], index % 2 === 1 && "[&>td:not([class*=bg-])]:bg-muted/40", choisi && "[&>td]:bg-accent/15", surbrillance && "outline outline-2 -outline-offset-2 outline-accent");
              return (
                <Fragment key={m.id}>
                  <tr
                    id={`mouvement-${m.id}`}
                    data-mouvement={m.id}
                    data-nouveau={surbrillance || undefined}
                    data-selectionne={choisi || undefined}
                    onClick={activer}
                    className={cn(ligneClasse, "border-t-2 border-border")}
                  >
                    <td rowSpan={hauteur} className={cn(td, "text-muted-foreground tabular-nums")}>{index + 1}</td>
                    <td rowSpan={hauteur} className={td}>
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          aria-expanded={onOuvrir ? choisi : ouvert}
                          aria-label={onOuvrir ? "Ouvrir le détail" : ouvert ? "Masquer le détail" : "Afficher le détail"}
                          onClick={(e) => { e.stopPropagation(); activer(); }}
                          className="mt-px grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", (onOuvrir ? choisi : ouvert) && "rotate-90")} />
                        </button>
                        <p className="min-w-0 font-medium text-primary">{m.natureMarchandise || "Mouvement sans nature"}</p>
                      </div>
                    </td>
                    <td rowSpan={hauteur} className={cn(td, "whitespace-nowrap tabular-nums font-medium text-primary")} title="Numéro de la facture de vente">{m.venteNumFacture || "—"}</td>
                    <CoteDebut m={m} cote={premier} doublon={Boolean(doublons?.[premier].has(m.id))} statut={premier === "achat" ? reglements?.get(m.id) : undefined} />
                    <CelluleEcart m={m} lignes={hauteur} />
                    <CoteFin m={m} cote={premier} onPreview={onPreview} base={base} colonnes={colonnes} />
                    {colonnes.douane && (
                      <td rowSpan={hauteur} className={cn(td, TEINTE.douane, filet, "text-xs leading-snug")}>
                        {m.douaneNumDeclaration ? <p className="text-[0.8125rem] font-semibold tabular-nums text-primary">{m.douaneNumDeclaration}</p> : <p className="text-muted-foreground">—</p>}
                        {(m.douaneDate || m.douaneTypeDeclaration) && <p className="text-muted-foreground">{m.douaneDate ? formatDate(m.douaneDate) : ""}{m.douaneTypeDeclaration ? ` · type ${m.douaneTypeDeclaration}` : ""}</p>}
                        {m.douaneTauxChange ? <p className="text-muted-foreground">Taux {m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}</p> : null}
                        {m.douaneValeurTnd ? <p className="text-muted-foreground">Valeur {fmtMontant(m.douaneValeurTnd)}</p> : null}
                        {m.douanePtfn ? <p className="text-muted-foreground">PTFN {fmtMontant(m.douanePtfn)}</p> : null}
                        <div className="mt-1"><Piece m={m} categorie="douane" onPreview={onPreview} /></div>
                      </td>
                    )}
                  </tr>
                  {hauteur === 2 && (
                    <tr data-mouvement={m.id} onClick={activer} className={ligneClasse}>
                      <CoteDebut m={m} cote="achat" doublon={Boolean(doublons?.achat.has(m.id))} statut={reglements?.get(m.id)} />
                      <CoteFin m={m} cote="achat" onPreview={onPreview} base={base} colonnes={colonnes} />
                    </tr>
                  )}
                  {ouvert && (
                    <tr className="border-t border-border bg-secondary/30">
                      <td colSpan={nbColonnes} className="p-0">
                        <div className="px-5 py-4 pl-10">
                          <DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onDelete={onDelete} onRetirerCote={onRetirerCote} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div data-pied-stock className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-primary/40 bg-primary/10 px-4 py-2.5 text-[0.8125rem] font-semibold text-primary">
          <span title={`${total.mouvements} mouvement${total.mouvements > 1 ? "s" : ""}`}>Total ({total.mouvements})</span>
          {sommeCote ? (
            <>
              <span className="tabular-nums">Total {cotes === "vente" ? "vente" : "achat"} : {fmtQuantiteUnite(sommeCote.quantite, total.unite)}</span>
              <span className="tabular-nums">{sommeCote.parDevise.length > 0 ? sommeCote.parDevise.map(([devise, montant]) => `${fmtMontant(montant)} ${devise}`).join(" · ") : "—"}</span>
              <span className="tabular-nums">MT {base === "USD" ? "USD" : "TND"} : {fmtMontant(sommeCote.montantBase)}</span>
            </>
          ) : (
            <>
          <span className={cn("tabular-nums", total.ecart !== 0 && "text-destructive")}>Écart : {fmtQuantite(total.ecart)}</span>
          <span>
            Vente : {fmtQuantiteUnite(total.vente.quantite, total.unite)} · Achat : {fmtQuantiteUnite(total.achat.quantite, total.unite)}
            {total.horsUnite > 0 && <span className="font-normal text-muted-foreground" title="Lignes sans unité (pièces, sacs…) : leurs quantités ne sont pas additionnées aux tonnes"> · {total.horsUnite} ligne{total.horsUnite > 1 ? "s" : ""} sans unité non comptée{total.horsUnite > 1 ? "s" : ""}</span>}
            {ecarts.length > 0 && <> · Vente − achat : {ecarts.map((e) => (
              <span key={e.devise} className={cn("mr-1 tabular-nums", e.valeur !== 0 && "text-destructive")}>{fmtMontant(e.valeur)} {e.devise}</span>
            ))}</>}
          </span>
          <span className={cn("tabular-nums", marge >= 0 ? "text-success" : "text-destructive")}>Marge {base} {marge >= 0 ? "+" : ""}{fmtMontant(marge)}</span>
            </>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border xl:hidden" aria-label="Mouvements de stock">
        {mouvements.map((m, index) => {
          const ouvert = ouverts.has(m.id);
          const v = totauxCote(m.venteLignes);
          const a = totauxCote(m.achatLignes);
          return (
            <li key={m.id} id={`mouvement-carte-${m.id}`} className={cn("px-4 py-3", nouveauId === m.id && "bg-accent/15")}>
              <button type="button" aria-expanded={ouvert} onClick={() => basculer(m.id)} className="flex w-full items-start gap-2 text-left">
                <ChevronRight className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-90")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-primary">{index + 1}. {m.natureMarchandise || "Mouvement sans nature"}</span>
                  {cotes !== "achat" && <span className="mt-1 block text-xs text-muted-foreground">Vente · {m.client || "—"} · {v.montantTnd ? fmtMontant(v.montantTnd) : "—"} TND</span>}
                  {cotes !== "vente" && <span className="block text-xs text-muted-foreground">Achat · {m.fournisseur || "—"} · {a.montantTnd ? fmtMontant(a.montantTnd) : "—"} TND{m.achatLignes.length > 0 && reglements?.get(m.id) && <> · <StatutReglement statut={reglements.get(m.id)} /></>}</span>}
                </span>
                <span className={cn("shrink-0 text-xs font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>Écart {fmtQuantite(m.ecart)}</span>
              </button>
              {ouvert && <div className="mt-3"><DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onDelete={onDelete} onRetirerCote={onRetirerCote} /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Fait({ label, children, large = false }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={cn("min-w-0", large && "sm:col-span-2")}>
      <dt className={etiquette}>{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

export function LignesProduits({ lignes, devise }: { lignes: StockLigne[]; devise: string }) {
  const total = totauxCote(lignes);
  const unite = uniteCommune(lignes);
  if (lignes.length === 0) return <p className="text-sm text-muted-foreground">Aucun produit.</p>;
  return (
    <table className="w-full table-fixed text-xs">
      <colgroup>
        {[34, 12, 14, 20, 20].map((l, i) => <col key={i} style={{ width: `${l}%` }} />)}
      </colgroup>
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-2 text-left font-semibold">Produit</th>
          <th className="px-1 py-1 text-right font-semibold">Qté</th>
          <th className="px-1 py-1 text-right font-semibold">P.U.</th>
          <th className="px-1 py-1 text-right font-semibold" title={`Montant en ${devise}`}>Montant</th>
          <th className="py-1 pl-1 text-right font-semibold">TND</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={l.id ?? i} className="border-t border-border align-top">
            <td className="py-1.5 pr-2 text-foreground [overflow-wrap:anywhere]">{l.designation || "(sans désignation)"}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(l.quantite, l.unite ?? "")}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{l.prixUnitaire ? fmtMontant(l.prixUnitaire) : "—"}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{l.montantDevise ? fmtMontant(l.montantDevise) : "—"}</td>
            <td className="whitespace-nowrap py-1.5 pl-1 text-right font-semibold tabular-nums">{l.montantTnd ? fmtMontant(l.montantTnd) : "—"}</td>
          </tr>
        ))}
      </tbody>
      {lignes.length > 1 && (
        <tfoot>
          <tr className="border-t-2 border-border font-semibold text-primary">
            <td className="py-1.5 pr-2">Total</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(total.quantite, unite)}</td>
            <td />
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtMontant(total.montantDevise)}</td>
            <td className="whitespace-nowrap py-1.5 pl-1 text-right tabular-nums">{total.montantTnd ? fmtMontant(total.montantTnd) : "—"}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** Pièce jointe d'une carte de détail : l'aperçu, et le classement dans Structuration. */
export function PieceCarte({ m, categorie, classing, onPreview, onClasser }: { m: StockMouvement; categorie: Categorie; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"] }) {
  const url = docUrl(m, categorie);
  if (!url) return <span className="text-xs text-muted-foreground">Aucune pièce jointe</span>;
  return (
    <span className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-secondary/40 text-xs">
      <button type="button" onClick={() => onPreview(TITRES[categorie], url)} className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-primary hover:bg-accent/10">
        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
        {TITRES[categorie]}
      </button>
      <button
        type="button"
        disabled={classing === `${m.id}-${categorie}`}
        onClick={() => onClasser(m, categorie)}
        title="Classer dans Structuration"
        aria-label={`Classer dans Structuration : ${TITRES[categorie]}`}
        className="border-l border-border px-2.5 py-1.5 text-muted-foreground hover:bg-accent/10 hover:text-primary disabled:opacity-50"
      >
        <FolderInput className={cn("h-3.5 w-3.5", classing === `${m.id}-${categorie}` && "animate-pulse")} />
      </button>
    </span>
  );
}

function Carte({ titre, resume, piece, action, children, className }: { titre: string; resume?: string; piece?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{titre}</h3>
          {resume && <p className="text-xs text-muted-foreground">{resume}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {piece}
          {action}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BoutonRetirer({ m, cote, nom, onRetirerCote }: { m: StockMouvement; cote: CoteMouvement; nom: string; onRetirerCote?: (m: StockMouvement, cote: CoteMouvement) => void }) {
  if (!onRetirerCote || !coteRenseigne(m, cote)) return null;
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onRetirerCote(m, cote)} aria-label={`Supprimer ${nom}`}>
      <Trash2 className="size-3.5" aria-hidden="true" />
      Supprimer
    </Button>
  );
}

function CarteFacture({ m, cote, classing, onPreview, onClasser, onRetirerCote }: { m: StockMouvement; cote: "vente" | "achat"; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"]; onRetirerCote?: Props["onRetirerCote"] }) {
  const v = cote === "vente";
  const tiers = v ? m.client : m.fournisseur;
  const date = v ? m.venteDate : m.achatDate;
  const numero = v ? m.venteNumFacture : m.achatNumFacture;
  const devise = v ? m.venteDevise : m.achatDevise;
  const cours = v ? m.venteCours : m.achatCours;
  const lignes = v ? m.venteLignes : m.achatLignes;
  const vide = !tiers && !date && !numero && lignes.length === 0;
  const resume = vide ? undefined : [date ? formatDate(date) : "", numero ? `facture ${numero}` : "", tiers, cours ? `${devise} · cours ${cours.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}` : devise].filter(Boolean).join(" · ");
  return (
    <Carte titre={v ? "Vente" : "Achat"} resume={resume} action={<BoutonRetirer m={m} cote={cote} nom={v ? "la facture de vente" : "la facture d'achat"} onRetirerCote={onRetirerCote} />} piece={<PieceCarte m={m} categorie={cote} classing={classing} onPreview={onPreview} onClasser={onClasser} />}>
      {vide ? <p className="text-sm text-muted-foreground">Rien de renseigné.</p> : <LignesProduits lignes={lignes} devise={devise} />}
    </Carte>
  );
}

function CarteDouane({ m, classing, onPreview, onClasser, onRetirerCote }: { m: StockMouvement; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"]; onRetirerCote?: Props["onRetirerCote"] }) {
  const rien = !m.douaneNumDeclaration && !m.douaneDate && !m.douaneValeurTnd && !m.douanePtfn && !m.douaneExportateur && !m.douaneImportateur;
  const resume = [m.douaneNumDeclaration ? `Déclaration ${m.douaneNumDeclaration}` : "", m.douaneDate ? formatDate(m.douaneDate) : ""].filter(Boolean).join(" · ");
  return (
    <Carte titre="Douane" resume={resume || undefined} className="lg:col-span-2" action={<BoutonRetirer m={m} cote="douane" nom="la déclaration douanière" onRetirerCote={onRetirerCote} />} piece={<PieceCarte m={m} categorie="douane" classing={classing} onPreview={onPreview} onClasser={onClasser} />}>
      {rien ? (
        <p className="text-sm text-muted-foreground">Aucune déclaration douanière.</p>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          <Fait label="Type de déclaration">{m.douaneTypeDeclaration}</Fait>
          <Fait label="Taux de change">{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : ""}</Fait>
          <Fait label="Valeur en douane (TND)">{m.douaneValeurTnd ? fmtMontant(m.douaneValeurTnd) : ""}</Fait>
          <Fait label="PTFN">{m.douanePtfn ? fmtMontant(m.douanePtfn) : ""}</Fait>
          <Fait label="Exportateur">{m.douaneExportateur}</Fait>
          <Fait label="Importateur">{m.douaneImportateur}</Fait>
        </dl>
      )}
    </Carte>
  );
}

export function DetailMouvement({ m, classing, onPreview, onClasser, onEdit, onDelete, onRetirerCote }: {
  m: StockMouvement;
  classing: string | null;
  onPreview: Props["onPreview"];
  onClasser: Props["onClasser"];
  onEdit: Props["onEdit"];
  onDelete: Props["onDelete"];
  onRetirerCote?: Props["onRetirerCote"];
}) {
  // Un détail par produit n'a de sens que si une facture en liste plusieurs : avec un seul
  // produit de chaque côté, des désignations rédigées différemment donneraient un écart
  // « +370 / −370 » trompeur alors que le total est nul.
  const detailParProduit = m.achatLignes.length > 1 || m.venteLignes.length > 1;
  const ecart = ecartDevise(m);
  const marge = totauxCote(m.venteLignes).montantTnd - totauxCote(m.achatLignes).montantTnd;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CarteFacture m={m} cote="vente" classing={classing} onPreview={onPreview} onClasser={onClasser} onRetirerCote={onRetirerCote} />
      <CarteFacture m={m} cote="achat" classing={classing} onPreview={onPreview} onClasser={onClasser} onRetirerCote={onRetirerCote} />
      <CarteDouane m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onRetirerCote={onRetirerCote} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm lg:col-span-2">
        <span>
          <span className={etiquette}>Écart achat − vente </span>
          <span className={cn("font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>{fmtQuantiteUnite(m.ecart, m.ecartUnite)}</span>
        </span>
        {ecart && (
          <span>
            <span className={etiquette}>Vente − achat (en devise) </span>
            <span className={cn("font-bold tabular-nums", ecart.valeur !== 0 ? "text-destructive" : "text-foreground")}>{fmtMontant(ecart.valeur)} {ecart.devise}</span>
          </span>
        )}
        {(m.venteLignes.length > 0 || m.achatLignes.length > 0) && (
          <span>
            <span className={etiquette}>Marge TND </span>
            <span className={cn("font-bold tabular-nums", marge >= 0 ? "text-success" : "text-destructive")}>{fmtMontant(marge)}</span>
          </span>
        )}
        {detailParProduit &&
          m.ecartParDesignation.map((e) => (
            <span key={e.designation} className="text-xs text-muted-foreground">
              {e.designation}{" "}
              <span className={cn("font-semibold", e.ecart !== 0 ? "text-destructive" : "text-foreground")}>{fmtQuantiteUnite(e.ecart, m.ecartUnite)}</span>
            </span>
          ))}
        {m.note && <span className="text-xs text-muted-foreground">Note : {m.note}</span>}
        <span className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => onEdit(m)}>Modifier</Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9 text-destructive hover:text-destructive" onClick={() => onDelete(m)}>Supprimer</Button>
        </span>
      </div>
    </div>
  );
}
