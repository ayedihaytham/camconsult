import { cn } from "@/lib/utils";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import { dateJourMoisAnnee, type CoteRecap, type RecapSociete } from "@/lib/stockRecapSociete";
import { COLONNES_RECAP, nombreFiltresRecap, valeursDeColonne, type ColonneRecap, type FiltresRecap, FILTRES_RECAP_VIDES } from "@/lib/filtresRecapSociete";
import { FiltreColonneRecap } from "./FiltreColonneRecap";

/**
 * Récapitulatif des mouvements de la société : le tableau que le cabinet tient dans son tableur, affiché avant l'export.
 * Ventes à gauche, écart au milieu, achats à droite ; ce qui s'affiche ici est exactement ce que contiennent l'Excel et le PDF.
 */

const th = "border-b border-primary-foreground/20 px-1.5 py-2 text-[0.6875rem] font-semibold leading-tight";
const td = "px-1.5 py-1.5 text-xs";
const num = "text-right tabular-nums";
/** Filet vertical qui sépare les trois blocs. */
const bloc = "border-l-2 border-l-primary/30";

function Cote({ c, nature, achat }: { c: CoteRecap; nature: string; achat: boolean }) {
  const vide = <span className="text-muted-foreground/60">—</span>;
  return (
    <>
      <td className={cn(td, "tabular-nums", achat ? bloc : "")}>{dateJourMoisAnnee(c.date) || vide}</td>
      <td className={cn(td, "break-all font-mono text-[0.6875rem]")}>{c.numFacture || vide}</td>
      <td className={cn(td, "truncate")} title={nature}>{c.present ? nature || vide : vide}</td>
      <td className={cn(td, "truncate")} title={c.tiers}>{c.tiers || vide}</td>
      <td className={cn(td, num)}>{c.present ? fmtQuantite(c.quantite) : vide}</td>
      <td className={cn(td, num)}>{c.present ? fmtMontant(c.enDevise) : vide}</td>
      <td className={td}>{c.devise || vide}</td>
      {achat && <td className={cn(td, num)}>{c.cours ? c.cours.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 6 }) : vide}</td>}
      <td className={cn(td, num, "font-medium")}>{c.present ? fmtMontant(c.mtTnd) : vide}</td>
    </>
  );
}

export function StockRecapSocieteTable({
  base,
  recap,
  filtres,
  onFiltres,
  onOuvrir,
}: {
  /** Toutes les lignes (avant filtres de colonnes) : source des valeurs proposées par chaque filtre. */
  base: RecapSociete;
  /** Lignes visibles (après filtres et tri) : ce qui s'affiche, et ce qui part en Excel et en PDF. */
  recap: RecapSociete;
  filtres: FiltresRecap;
  onFiltres: (f: FiltresRecap) => void;
  onOuvrir?: (id: string) => void;
}) {
  const q = recap.unite ? ` (${recap.unite})` : "";
  const t = recap.totaux;
  const nbFiltres = nombreFiltresRecap(filtres);
  const titreDe = (c: ColonneRecap) => (c.id === "ecart" || c.titre === "Quantité" ? `${c.titre}${q}` : c.titre);
  const contenuEntete = (c: ColonneRecap) => (
    <div className={cn("flex flex-wrap items-center gap-x-1 gap-y-0.5", c.bloc === "ecart" ? "justify-center" : "justify-between")}>
      <span className="min-w-0">{titreDe(c)}</span>
      <FiltreColonneRecap colonneId={c.id} titre={c.bloc === "ecart" ? c.titre : `${c.titre} (${c.bloc})`} valeurs={valeursDeColonne(base.lignes, c.id, filtres)} filtres={filtres} onFiltres={onFiltres} />
    </div>
  );
  const entete = (c: ColonneRecap, classes?: string) => (
    <th key={c.id} scope="col" className={cn(th, classes)}>{contenuEntete(c)}</th>
  );
  const colVente = COLONNES_RECAP.filter((c) => c.bloc === "vente");
  const colAchat = COLONNES_RECAP.filter((c) => c.bloc === "achat");
  const colEcart = COLONNES_RECAP.find((c) => c.bloc === "ecart")!;
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
      <table className="w-full min-w-[1360px] table-fixed border-collapse text-left">
        <colgroup>
          {[2.5, 5.4, 6.2, 6.4, 8.2, 4.6, 6, 3.8, 6.4, 4.2, 5.4, 6.2, 6.2, 8, 4.6, 6, 3.8, 4.2, 6.4].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
        <caption className="sr-only">Récapitulatif des mouvements : ventes, écart et achats</caption>
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th rowSpan={2} scope="col" className={cn(th, "w-10 text-center")}>N°</th>
            <th colSpan={8} scope="colgroup" className={cn(th, "bg-primary text-center text-xs tracking-widest")}>VENTE</th>
            <th rowSpan={2} scope="col" className={cn(th, bloc, "align-middle")}>{contenuEntete(colEcart)}</th>
            <th colSpan={9} scope="colgroup" className={cn(th, bloc, "bg-primary/80 text-center text-xs tracking-widest")}>ACHAT</th>
          </tr>
          <tr>
            {colVente.map((c) => entete(c))}
            {colAchat.map((c, i) => entete(c, i === 0 ? bloc : undefined))}
          </tr>
        </thead>
        <tbody>
          {recap.lignes.map((l, i) => (
            <tr
              key={l.id}
              className={cn("border-b border-border/70", i % 2 === 1 && "bg-muted/40", onOuvrir && "cursor-pointer hover:bg-accent/10")}
              onClick={onOuvrir ? () => onOuvrir(l.id) : undefined}
            >
              <td className={cn(td, "text-center font-mono text-xs text-muted-foreground")}>{l.rang}</td>
              <Cote c={l.vente} nature={l.nature} achat={false} />
              <td className={cn(td, num, bloc, "font-semibold", l.ecart !== 0 ? "text-destructive" : "text-success")}>{fmtQuantite(l.ecart)}</td>
              <Cote c={l.achat} nature={l.nature} achat />
            </tr>
          ))}
        </tbody>
        {recap.lignes.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={19} className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune ligne ne correspond aux filtres.{" "}
                <button type="button" className="font-medium text-info hover:underline" onClick={() => onFiltres(FILTRES_RECAP_VIDES)}>Effacer tous les filtres</button>
              </td>
            </tr>
          </tbody>
        )}
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
          </tr>
        </tfoot>
      </table>
    </div>
    </div>
  );
}
