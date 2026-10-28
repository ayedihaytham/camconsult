import { cn } from "@/lib/utils";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import { dateJourMoisAnnee, type CoteRecap, type LigneRecapSociete, type RecapSociete } from "@/lib/stockRecapSociete";
import { COLONNES_RECAP, FILTRES_RECAP_VIDES, nombreFiltresRecap, valeursDeColonne, type ColonneRecap, type FiltresRecap } from "@/lib/filtresRecapSociete";
import { FiltreColonneRecap } from "./FiltreColonneRecap";

/**
 * Récapitulatif des mouvements de la société : le tableau que le cabinet tient dans son tableur, affiché avant l'export.
 * Ventes à gauche, écart au milieu, achats à droite, douane en option ; ce qui s'affiche ici est exactement ce que contiennent l'Excel et le PDF.
 * Les colonnes de chiffres ont une largeur fixe (juste ce que demande leur contenu) ; les textes (nature, client, fournisseur) se partagent le reste et passent à la ligne.
 */

/** Largeur en pixels des colonnes de valeurs courtes ; les colonnes de texte n'en ont pas (elles se partagent le reste). */
const LARGEUR: Record<string, number | undefined> = {
  "vente.date": 80, "vente.facture": 92, "vente.nature": undefined, "vente.tiers": undefined, "vente.quantite": 72, "vente.devise-montant": 92, "vente.devise": 66, "vente.mt-tnd": 94,
  ecart: 72,
  "achat.date": 80, "achat.facture": 92, "achat.nature": undefined, "achat.tiers": undefined, "achat.quantite": 72, "achat.devise-montant": 92, "achat.devise": 66, "achat.cours": 60, "achat.mt-tnd": 94,
  "douane.declaration": 92, "douane.date": 80, "douane.type": 56, "douane.taux": 72, "douane.valeur": 94,
};
const LARGEUR_RANG = 34;
/** Place minimale d'une colonne de texte avant que le tableau ne défile. */
const TEXTE_MINIMUM = 52;
/** Avec la douane, les colonnes se resserrent pour que tout tienne sans défilement, sans jamais passer sous ce que leur contenu demande. */
const RESSERREMENT_DOUANE = 0.82;
const PLANCHER_DOUANE: Record<string, number> = { date: 72, facture: 84, quantite: 66, "devise-montant": 80, devise: 64, cours: 60, type: 54, valeur: 90 };
const largeurColonne = (id: string, douane: boolean): number | undefined => {
  const l = LARGEUR[id];
  if (l === undefined || !douane) return l;
  return Math.max(Math.round(l * RESSERREMENT_DOUANE), PLANCHER_DOUANE[id.split(".")[1]] ?? 0);
};

const TITRE_COURT: Record<string, string> = { Quantité: "Qté", "Taux de change": "Taux", "N° déclaration": "N° décl.", "Valeur (TND)": "Valeur TND" };

const th = "border-b border-primary-foreground/20 px-1.5 py-2 text-[0.6875rem] font-semibold leading-tight align-middle";
const num = "text-right tabular-nums";
/** Filet vertical qui sépare les blocs. */
const bloc = "border-l-2 border-l-primary/30";
const vide = <span className="text-muted-foreground/60">—</span>;

function Texte({ valeur, className }: { valeur: string; className?: string }) {
  return valeur ? <span className={cn("line-clamp-2 break-words", className)} title={valeur}>{valeur}</span> : vide;
}

function Cote({ c, nature, achat, td }: { c: CoteRecap; nature: string; achat: boolean; td: string }) {
  return (
    <>
      <td className={cn(td, "tabular-nums", achat && bloc)}>{dateJourMoisAnnee(c.date) || vide}</td>
      <td className={cn(td, "break-all font-mono text-[0.6875rem]")}>{c.numFacture || vide}</td>
      <td className={td}>{c.present ? <Texte valeur={nature} /> : vide}</td>
      <td className={td}><Texte valeur={c.tiers} /></td>
      <td className={cn(td, num)}>{c.present ? fmtQuantite(c.quantite) : vide}</td>
      <td className={cn(td, num)}>{c.present ? fmtMontant(c.enDevise) : vide}</td>
      <td className={td}>{c.devise || vide}</td>
      {achat && <td className={cn(td, num)}>{c.cours ? c.cours.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 6 }) : vide}</td>}
      <td className={cn(td, num, "font-medium")}>{c.present ? fmtMontant(c.mtTnd) : vide}</td>
    </>
  );
}

function Douane({ l, td }: { l: LigneRecapSociete; td: string }) {
  const d = l.douane;
  return (
    <>
      <td className={cn(td, bloc, "break-all font-mono text-[0.6875rem]")}>{d.numDeclaration || vide}</td>
      <td className={cn(td, "tabular-nums")}>{dateJourMoisAnnee(d.date) || vide}</td>
      <td className={td}>{d.type || vide}</td>
      <td className={cn(td, num)}>{d.tauxChange ? d.tauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : vide}</td>
      <td className={cn(td, num, "font-medium")}>{d.valeurTnd ? fmtMontant(d.valeurTnd) : vide}</td>
    </>
  );
}

export function StockRecapSocieteTable({
  base,
  recap,
  filtres,
  onFiltres,
  douane = false,
  onOuvrir,
}: {
  /** Toutes les lignes (avant filtres de colonnes) : source des valeurs proposées par chaque filtre. */
  base: RecapSociete;
  /** Lignes visibles (après filtres et tri) : ce qui s'affiche, et ce qui part en Excel et en PDF. */
  recap: RecapSociete;
  filtres: FiltresRecap;
  onFiltres: (f: FiltresRecap) => void;
  /** Affiche les colonnes de la déclaration douanière. */
  douane?: boolean;
  onOuvrir?: (id: string) => void;
}) {
  const q = recap.unite ? ` (${recap.unite})` : "";
  const t = recap.totaux;
  const nbFiltres = nombreFiltresRecap(filtres);
  const colonnes = COLONNES_RECAP.filter((c) => douane || c.bloc !== "douane");
  const td = cn("px-1.5 py-1.5 align-middle", douane ? "text-[0.6875rem]" : "text-xs");
  const nbTextes = colonnes.filter((c) => LARGEUR[c.id] === undefined).length;
  const fixe = LARGEUR_RANG + colonnes.reduce((s, c) => s + (largeurColonne(c.id, douane) ?? 0), 0);
  const largeurMin = fixe + nbTextes * TEXTE_MINIMUM;

  const titreDe = (c: ColonneRecap) => {
    const court = TITRE_COURT[c.titre] ?? c.titre;
    return c.titre === "Quantité" || c.bloc === "ecart" ? `${court}${q}` : court;
  };
  const contenuEntete = (c: ColonneRecap) => (
    <div className={cn("flex items-center gap-1", c.bloc === "ecart" ? "flex-col" : "justify-between", LARGEUR[c.id] === undefined && "flex-wrap")}>
      <span className={LARGEUR[c.id] === undefined ? "min-w-0 break-words" : "whitespace-nowrap"}>{titreDe(c)}</span>
      <FiltreColonneRecap
        colonneId={c.id}
        titre={c.bloc === "ecart" || c.bloc === "douane" ? c.titre : `${c.titre} (${c.bloc})`}
        type={c.type}
        valeurs={valeursDeColonne(base.lignes, c.id, filtres)}
        filtres={filtres}
        onFiltres={onFiltres}
      />
    </div>
  );
  const entete = (c: ColonneRecap, debutDeBloc = false) => (
    <th key={c.id} scope="col" className={cn(th, debutDeBloc && bloc)}>{contenuEntete(c)}</th>
  );
  const colVente = colonnes.filter((c) => c.bloc === "vente");
  const colAchat = colonnes.filter((c) => c.bloc === "achat");
  const colDouane = colonnes.filter((c) => c.bloc === "douane");
  const colEcart = colonnes.find((c) => c.bloc === "ecart")!;

  return (
    <div data-testid="stock-recap-societe">
      {(nbFiltres > 0 || filtres.tri) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent/10 px-5 py-2 text-xs" role="status">
          <span className="font-semibold text-foreground">
            {nbFiltres > 0 ? `${nbFiltres} filtre${nbFiltres > 1 ? "s" : ""} de colonne` : "Tri personnalisé"} · {recap.lignes.length} ligne{recap.lignes.length > 1 ? "s" : ""} sur {base.lignes.length}
          </span>
          <button type="button" className="font-medium text-info hover:underline" onClick={() => onFiltres(FILTRES_RECAP_VIDES)}>
            {nbFiltres > 0 ? "Effacer tous les filtres" : "Rétablir l'ordre"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: largeurMin }}>
          <colgroup>
            <col style={{ width: LARGEUR_RANG }} />
            {colonnes.map((c) => <col key={c.id} style={largeurColonne(c.id, douane) === undefined ? undefined : { width: largeurColonne(c.id, douane) }} />)}
          </colgroup>
          <caption className="sr-only">Récapitulatif des mouvements : ventes, écart, achats{douane ? " et douane" : ""}</caption>
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th rowSpan={2} scope="col" className={cn(th, "text-center")}>N°</th>
              <th colSpan={colVente.length} scope="colgroup" className={cn(th, "text-center text-xs tracking-widest")}>VENTE</th>
              <th rowSpan={2} scope="col" className={cn(th, bloc)}>{contenuEntete(colEcart)}</th>
              <th colSpan={colAchat.length} scope="colgroup" className={cn(th, bloc, "bg-primary/80 text-center text-xs tracking-widest")}>ACHAT</th>
              {douane && <th colSpan={colDouane.length} scope="colgroup" className={cn(th, bloc, "text-center text-xs tracking-widest")}>DOUANE</th>}
            </tr>
            <tr>
              {colVente.map((c) => entete(c))}
              {colAchat.map((c, i) => entete(c, i === 0))}
              {colDouane.map((c, i) => entete(c, i === 0))}
            </tr>
          </thead>
          <tbody>
            {recap.lignes.map((l, i) => (
              <tr
                key={l.id}
                className={cn("border-b border-border/70", i % 2 === 1 && "bg-muted/40", onOuvrir && "cursor-pointer hover:bg-accent/10")}
                onClick={onOuvrir ? () => onOuvrir(l.id) : undefined}
              >
                <td className={cn(td, "text-center font-mono text-muted-foreground")}>{l.rang}</td>
                <Cote c={l.vente} nature={l.nature} achat={false} td={td} />
                <td className={cn(td, num, bloc, "font-semibold", l.ecart !== 0 ? "text-destructive" : "text-success")}>{fmtQuantite(l.ecart)}</td>
                <Cote c={l.achat} nature={l.nature} achat td={td} />
                {douane && <Douane l={l} td={td} />}
              </tr>
            ))}
            {recap.lignes.length === 0 && (
              <tr>
                <td colSpan={colonnes.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune ligne ne correspond aux filtres.{" "}
                  <button type="button" className="font-medium text-info hover:underline" onClick={() => onFiltres(FILTRES_RECAP_VIDES)}>Effacer tous les filtres</button>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/40 bg-primary/10 font-semibold text-primary">
              <td className={td} colSpan={4}>TOTAL</td>
              <td className={td} />
              <td className={cn(td, num)}>{fmtQuantite(t.vente.quantite)}</td>
              <td className={cn(td, num)}>{t.vente.enDevise === null ? "" : fmtMontant(t.vente.enDevise)}</td>
              <td className={td} />
              <td className={cn(td, num)}>{fmtMontant(t.vente.mtTnd)}</td>
              <td className={cn(td, num, bloc, t.ecart !== 0 && "text-destructive")}>{fmtQuantite(t.ecart)}</td>
              <td className={cn(td, bloc)} colSpan={4} />
              <td className={cn(td, num)}>{fmtQuantite(t.achat.quantite)}</td>
              <td className={cn(td, num)}>{t.achat.enDevise === null ? "" : fmtMontant(t.achat.enDevise)}</td>
              <td className={td} />
              <td className={td} />
              <td className={cn(td, num)}>{fmtMontant(t.achat.mtTnd)}</td>
              {douane && (
                <>
                  <td className={cn(td, bloc)} colSpan={4} />
                  <td className={cn(td, num)}>{t.douaneValeurTnd ? fmtMontant(t.douaneValeurTnd) : ""}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
