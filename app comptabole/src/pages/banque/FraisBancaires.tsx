import { cn } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import type { SyntheseFrais } from "@/lib/banqueFrais";
import { libelleMois } from "./RapprochementMois";

/** Ce que le compte coûte : total des frais, part des débits, par mois et par nature (commissions, TVA, agios…). */
export function FraisBancaires({ synthese, devise }: { synthese: SyntheseFrais; devise: string }) {
  const th = "px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
  if (synthese.nb === 0) {
    return (
      <section aria-label="Frais bancaires" className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
        Aucun frais bancaire (commission, TVA, agios, tenue de compte) sur cette période.
      </section>
    );
  }
  const maxNature = Math.max(...synthese.parNature.map((n) => Math.abs(n.total)), 0.001);
  return (
    <section aria-label="Frais bancaires" className="border-t-2 border-accent/40 bg-accent/[0.07] px-5 py-4">
      <h3 className="mb-3 text-sm font-bold text-primary">Frais bancaires</h3>
      <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total des frais</dt>
          <dd className="m-0 mt-0.5 text-base font-bold tabular-nums text-primary">{fmtMontant(synthese.total)} {devise}</dd>
        </div>
        <div>
          <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Lignes</dt>
          <dd className="m-0 mt-0.5 text-sm font-medium tabular-nums">{synthese.nb}</dd>
        </div>
        {synthese.part !== null && (
          <div>
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Part des débits</dt>
            <dd className="m-0 mt-0.5 text-sm font-medium tabular-nums">{(synthese.part * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</dd>
          </div>
        )}
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-xs tabular-nums" aria-label="Frais par nature">
            <thead>
              <tr className="text-left">
                <th className={th}>Nature</th>
                <th className={cn(th, "text-right")}>Lignes</th>
                <th className={cn(th, "text-right")}>Total</th>
              </tr>
            </thead>
            <tbody>
              {synthese.parNature.slice(0, 12).map((n) => (
                <tr key={n.libelle} className="border-t border-border/70">
                  <td className="relative px-3 py-1.5">
                    <span aria-hidden="true" className="absolute inset-y-1 left-0 rounded-r bg-accent/25" style={{ width: `${Math.max(2, (Math.abs(n.total) / maxNature) * 100)}%` }} />
                    <span className="relative">{n.libelle}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{n.nb}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{fmtMontant(n.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {synthese.parNature.length > 12 && <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">… et {synthese.parNature.length - 12} autres natures.</p>}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-xs tabular-nums" aria-label="Frais par mois">
            <thead>
              <tr className="text-left">
                <th className={th}>Mois</th>
                <th className={cn(th, "text-right")}>Lignes</th>
                <th className={cn(th, "text-right")}>Total</th>
              </tr>
            </thead>
            <tbody>
              {synthese.parMois.map((p) => (
                <tr key={p.mois} className="border-t border-border/70">
                  <td className="px-3 py-1.5 capitalize">{libelleMois(p.mois)}</td>
                  <td className="px-3 py-1.5 text-right">{p.nb}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{fmtMontant(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
