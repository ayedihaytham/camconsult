import { useMemo, useState, type ReactNode } from "react";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { fmtMontant } from "@/lib/stockRecap";
import { recapSociete } from "@/lib/honoraires/recap";
import { cn, formatDate } from "@/lib/utils";
import type { HonoraireLigne } from "@/types";

type Vue = "type" | "annee";

const etiquette = "text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground";
const th = "px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";

function Chiffre({ label, children, tone }: { label: string; children: ReactNode; tone?: "warning" }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className={etiquette}>{label}</dt>
      <dd className={cn("mt-1 truncate font-serif text-xl font-medium tabular-nums", tone === "warning" ? "text-warning" : "text-primary")}>
        {children}
      </dd>
    </div>
  );
}

/** Synthèse du compte d'une société : chiffres clés, puis détail par type de déclaration ou par année. */
export function HonoraireRecapCard({ list }: { list: HonoraireLigne[] }) {
  const [vue, setVue] = useState<Vue>("type");
  const recap = useMemo(() => recapSociete(list), [list]);
  const groupes = vue === "type" ? recap.parType : recap.parAnnee;

  return (
    <section data-tour="honoraires-summary" aria-label="Récapitulatif du compte client" className="mt-3 overflow-hidden rounded-xl border border-accent/30 bg-card">
      <dl className="grid grid-cols-2 divide-accent/25 border-b border-accent/25 bg-accent/[0.06] sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
        <Chiffre label="Déclarations à reverser">{fmtMontant(recap.declare)}</Chiffre>
        <Chiffre label="Honoraires">{fmtMontant(recap.honoraires)}</Chiffre>
        <Chiffre label="Total dû">{fmtMontant(recap.total)}</Chiffre>
        <Chiffre label="Règlements reçus">{fmtMontant(recap.reglements)}</Chiffre>
        <Chiffre label="Solde dû" tone={recap.solde > 0 ? "warning" : undefined}>
          {fmtMontant(recap.solde)}
        </Chiffre>
        <Chiffre label="Dernier règlement">
          <span className="text-base">{recap.dernierReglement ? formatDate(recap.dernierReglement) : "—"}</span>
        </Chiffre>
      </dl>

      <div className="px-4 pt-3">
        <LedgerSegmented<Vue>
          value={vue}
          onChange={setVue}
          ariaLabel="Détail du récapitulatif"
          options={[
            { value: "type", label: "Par type de déclaration" },
            { value: "annee", label: "Par année" },
          ]}
        />
      </div>

      {groupes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Aucune ligne à récapituler.</p>
      ) : (
        <div className="px-4 pb-4 pt-2">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-accent/25">
                <th className={`${th} text-left`}>{vue === "type" ? "Type" : "Année"}</th>
                <th className={`${th} text-right`}>Lignes</th>
                <th className={`${th} text-right`}>Déclaré</th>
                <th className={`${th} text-right`}>Honoraires</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>Règlements</th>
                <th className={`${th} text-right`}>Solde</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map((g) => (
                <tr key={g.cle} className="border-b border-accent/15 last:border-b-0">
                  <td className="truncate px-3 py-2 font-medium text-foreground">{g.libelle}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.nbLignes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(g.declare)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(g.honoraires)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(g.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(g.reglements)}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", g.solde > 0 ? "text-warning" : "text-foreground")}>
                    {fmtMontant(g.solde)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-accent/40 font-bold text-primary">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{recap.nbLignes}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(recap.declare)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(recap.honoraires)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(recap.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMontant(recap.reglements)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", recap.solde > 0 && "text-warning")}>{fmtMontant(recap.solde)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
