import { cn } from "@/lib/utils";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import { dateJourMoisAnnee, type CoteRecap, type RecapSociete } from "@/lib/stockRecapSociete";

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

export function StockRecapSocieteTable({ recap, onOuvrir }: { recap: RecapSociete; onOuvrir?: (id: string) => void }) {
  const q = recap.unite ? ` (${recap.unite})` : "";
  const t = recap.totaux;
  return (
    <div className="overflow-x-auto" data-testid="stock-recap-societe">
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
        <colgroup>
          {[2.5, 5.4, 6.2, 6.8, 8.2, 4.6, 6, 3.2, 6.4, 4.2, 5.4, 6.2, 6.8, 8, 4.6, 6, 3.2, 3.8, 6.4].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
        <caption className="sr-only">Récapitulatif des mouvements : ventes, écart et achats</caption>
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th rowSpan={2} scope="col" className={cn(th, "w-10 text-center")}>N°</th>
            <th colSpan={8} scope="colgroup" className={cn(th, "bg-primary text-center text-xs tracking-widest")}>VENTE</th>
            <th rowSpan={2} scope="col" className={cn(th, bloc, "text-center")}>Écart{q}</th>
            <th colSpan={9} scope="colgroup" className={cn(th, bloc, "bg-primary/80 text-center text-xs tracking-widest")}>ACHAT</th>
          </tr>
          <tr>
            {["Date", "N° facture", "Nature", "Client", `Quantité${q}`, "En devise", "Devise", "MT TND"].map((h, i) => (
              <th key={`v${h}`} scope="col" className={cn(th, i >= 4 && i !== 6 && "text-right")}>{h}</th>
            ))}
            {["Date", "N° facture", "Nature", "Fournisseur", `Quantité${q}`, "En devise", "Devise", "Cours", "MT TND"].map((h, i) => (
              <th key={`a${h}`} scope="col" className={cn(th, i === 0 && bloc, i >= 4 && i !== 6 && "text-right")}>{h}</th>
            ))}
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
  );
}
