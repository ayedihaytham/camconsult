import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Receipt, Search } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { totauxClients, trierParSolde } from "@/lib/honoraires/recap";
import { fmtMontant } from "@/lib/stockRecap";
import { cn, formatDate } from "@/lib/utils";
import { useHonoraires } from "@/store/honoraires";

const th = "overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const td = "overflow-hidden text-ellipsis whitespace-nowrap px-2 py-3 align-middle";

/** Récapitulatif de tous les clients : une ligne par société avec ce qu'elle doit au cabinet,
 * les plus gros soldes d'abord. Un clic ouvre le compte détaillé de la société. */
export function HonorairesRecapPage() {
  const navigate = useNavigate();
  const recap = useHonoraires((s) => s.recap);
  const loading = useHonoraires((s) => s.loadingRecap);
  const fetchRecap = useHonoraires((s) => s.fetchRecap);
  const [recherche, setRecherche] = useState("");
  const [soldeSeul, setSoldeSeul] = useState(false);

  useEffect(() => {
    void fetchRecap().catch(() => {});
  }, [fetchRecap]);

  const triees = useMemo(() => trierParSolde(recap), [recap]);
  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase("fr");
    return triees.filter(
      (r) => (!soldeSeul || r.solde > 0) && (!q || `${r.raisonSociale} ${r.code}`.toLocaleLowerCase("fr").includes(q)),
    );
  }, [triees, recherche, soldeSeul]);
  const total = totauxClients(visibles);
  const general = totauxClients(recap);

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={Receipt}
        eyebrow="Comptabilité · Financial Ledger"
        title="État client"
        description="Récapitulatif des comptes clients : ce que chaque société doit au cabinet, les plus gros soldes d'abord."
        metrics={[
          { label: general.clients > 1 ? "Clients" : "Client", value: general.clients, loading },
          { label: "Avec solde dû", value: general.avecSolde, tone: general.avecSolde > 0 ? "warning" : "default", loading },
          { label: "Solde total dû", value: fmtMontant(general.solde), tone: general.solde > 0 ? "warning" : "default", loading },
          { label: "Règlements reçus", value: fmtMontant(general.reglements), tone: "success", loading },
        ]}
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour="honoraires-summary">
        <div className="flex flex-wrap items-center gap-3 border-b border-accent/25 px-5 py-4">
          <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une société ou un code"
              aria-label="Rechercher une société"
              className="h-11 w-full rounded-lg border border-accent/35 bg-card pl-10 pr-3 text-base outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--accent)/0.22)]"
            />
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-3 rounded-lg border border-accent/35 px-4 text-base text-primary">
            <Checkbox checked={soldeSeul} onCheckedChange={(c) => setSoldeSeul(Boolean(c))} className="size-5 rounded-md" />
            Avec solde dû seulement
          </label>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">
            {visibles.length} client{visibles.length > 1 ? "s" : ""}
          </span>
        </div>

        {visibles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-serif text-2xl font-medium text-primary">
              {loading ? "Chargement…" : recap.length === 0 ? "Aucune société" : "Aucun client ne correspond"}
            </p>
            <p className="mt-1 text-base text-muted-foreground">
              {recap.length === 0 ? "Créez une société pour suivre son compte d'honoraires." : "Modifiez la recherche ou le filtre."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "5%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-accent/25 bg-accent/[0.07]">
                  <th className={`${th} text-left`}>Client</th>
                  <th className={`${th} text-right`}>Lignes</th>
                  <th className={`${th} text-right`}>Déclaré</th>
                  <th className={`${th} text-right`}>Honoraires</th>
                  <th className={`${th} text-right`}>Total dû</th>
                  <th className={`${th} text-right`}>Règlements</th>
                  <th className={`${th} text-right`}>Solde</th>
                  <th className={`${th} text-right`}>Dernier règl.</th>
                  <th className={th}>
                    <span className="sr-only">Ouvrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr
                    key={r.societeId}
                    onClick={() => navigate(`/honoraires/${r.societeId}`)}
                    className={cn(
                      "cursor-pointer border-b border-accent/20 transition-colors hover:bg-accent/[0.06]",
                      r.statut !== "actif" && "text-muted-foreground",
                    )}
                  >
                    <td className={`${td} font-semibold text-primary`} title={r.raisonSociale}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/honoraires/${r.societeId}`);
                        }}
                        aria-label={`Ouvrir l'état client de ${r.raisonSociale}`}
                        className="block max-w-full truncate text-left hover:underline"
                      >
                        {r.raisonSociale}
                      </button>
                    </td>
                    <td className={`${td} text-right tabular-nums text-muted-foreground`}>{r.nbLignes}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtMontant(r.declare)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtMontant(r.honoraires)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtMontant(r.total)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtMontant(r.reglements)}</td>
                    <td className={cn(td, "text-right font-bold tabular-nums", r.solde > 0 ? "text-warning" : "text-foreground")}>
                      {fmtMontant(r.solde)}
                    </td>
                    <td className={`${td} text-right text-muted-foreground`}>{r.dernierReglement ? formatDate(r.dernierReglement) : "—"}</td>
                    <td className={`${td} text-right`}>
                      <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-accent/40 bg-accent/[0.07] font-bold text-primary">
                  <td className={td}>Total ({total.clients})</td>
                  <td className={td} />
                  <td className={`${td} text-right tabular-nums`}>{fmtMontant(total.declare)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtMontant(total.honoraires)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtMontant(total.total)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtMontant(total.reglements)}</td>
                  <td className={cn(td, "text-right tabular-nums", total.solde > 0 && "text-warning")}>{fmtMontant(total.solde)}</td>
                  <td className={td} />
                  <td className={td} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
