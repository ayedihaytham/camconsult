import { cn } from "@/lib/utils";
import { aUnEcart, type RapprochementMois } from "@/lib/banqueMois";
import { fmtMontant } from "@/lib/stockRecap";
import { libelleMois } from "./RapprochementMois";

/** Une ligne par mois du compte : de quoi voir d'un coup d'œil quels mois tombent juste et lesquels ont un écart à expliquer ; un clic ouvre le mois. */
export function SyntheseMensuelle({ periodes, onChoisir }: { periodes: RapprochementMois[]; onChoisir: (mois: string) => void }) {
  if (periodes.length === 0) return null;
  const th = "px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
  return (
    <section aria-label="Synthèse par mois" className="border-t border-border">
      <h3 className="px-5 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Synthèse par mois</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="text-left">
              <th className={th}>Mois</th>
              <th className={cn(th, "text-right")}>Départ</th>
              <th className={cn(th, "text-right")}>Débit</th>
              <th className={cn(th, "text-right")}>Crédit</th>
              <th className={cn(th, "text-right")}>Solde calculé</th>
              <th className={cn(th, "text-right")}>Solde réel</th>
              <th className={cn(th, "text-right")}>Écart</th>
              <th className={cn(th, "text-right")}>Solde théorique</th>
              <th className={cn(th, "text-right")}>À revoir</th>
            </tr>
          </thead>
          <tbody>
            {periodes.map((p) => (
              <tr key={p.mois} className="cursor-pointer border-t border-border/70 hover:bg-accent/[0.06]" onClick={() => onChoisir(p.mois)}>
                <td className="px-3 py-1.5 font-semibold capitalize text-primary">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onChoisir(p.mois); }} className="capitalize hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {libelleMois(p.mois)}
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right">{fmtMontant(p.ouverture)}</td>
                <td className="px-3 py-1.5 text-right">{fmtMontant(p.totalDebit)}</td>
                <td className="px-3 py-1.5 text-right">{fmtMontant(p.totalCredit)}</td>
                <td className="px-3 py-1.5 text-right font-medium">{fmtMontant(p.calcule)}</td>
                <td className="px-3 py-1.5 text-right">{p.soldeReel === null ? <span className="text-muted-foreground">à saisir</span> : fmtMontant(p.soldeReel)}</td>
                <td className={cn("px-3 py-1.5 text-right font-semibold", aUnEcart(p) ? "text-destructive" : p.ecart === null ? "text-muted-foreground" : "text-success")}>{p.ecart === null ? "—" : fmtMontant(p.ecart)}</td>
                <td className="px-3 py-1.5 text-right">{p.enCours.length > 0 ? fmtMontant(p.theorique) : "—"}</td>
                <td className="px-3 py-1.5 text-right">{p.aRevoir > 0 ? <span className="rounded-full bg-warning/20 px-2 py-0.5 font-semibold text-warning">{p.aRevoir}</span> : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
