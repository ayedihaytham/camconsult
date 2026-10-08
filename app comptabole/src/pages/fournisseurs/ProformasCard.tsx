import { cn, formatDate } from "@/lib/utils";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import type { ProformaSuivie, StatutProforma } from "@/lib/fournisseurs";

const STATUTS: Record<StatutProforma, { label: string; classe: string }> = {
  cloturee: { label: "Clôturée", classe: "bg-success/15 text-success" },
  ouverte: { label: "En cours", classe: "bg-warning/20 text-warning" },
  depassee: { label: "Dépassée", classe: "bg-destructive/15 text-destructive" },
  "sans-quantite": { label: "Quantité à saisir", classe: "bg-secondary text-muted-foreground" },
};

const th = "whitespace-nowrap px-3 py-2 text-left text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";

/** Proformas d'un fournisseur : quantité annoncée, quantité déjà facturée par les factures d'achat qui s'y rattachent, et reste. */
export function ProformasCard({ proformas }: { proformas: ProformaSuivie[] }) {
  if (proformas.length === 0) return null;
  return (
    <section aria-label="Proformas" className="border-t border-accent/25">
      <h3 className="px-5 pb-1 pt-3 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Proformas</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-accent/25 bg-accent/[0.04]">
              <th className={th}>N° proforma</th>
              <th className={th}>Date</th>
              <th className={`${th} text-right`}>Qté proforma</th>
              <th className={`${th} text-right`}>Qté facturée</th>
              <th className={`${th} text-right`}>Reste</th>
              <th className={`${th} text-right`}>Montant</th>
              <th className={th}>Factures</th>
              <th className={th}>État</th>
            </tr>
          </thead>
          <tbody>
            {proformas.map((p) => (
              <tr key={`${p.fournisseurCle}-${p.num}`} className="border-b border-accent/15">
                <td className="whitespace-nowrap px-3 py-2 font-mono">{p.num}</td>
                <td className="whitespace-nowrap px-3 py-2">{p.date ? formatDate(p.date) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.qte ? fmtQuantite(p.qte) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtQuantite(p.facturee)}</td>
                <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", p.statut === "depassee" && "text-destructive")}>{p.qte ? fmtQuantite(p.reste) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.montant ? fmtMontant(p.montant) : "—"}</td>
                <td className="px-3 py-2 tabular-nums">{p.nbFactures}</td>
                <td className="px-3 py-2">
                  <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", STATUTS[p.statut].classe)}>{STATUTS[p.statut].label}</span>
                  {p.etat && <span className="ml-2 text-muted-foreground">{p.etat}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
