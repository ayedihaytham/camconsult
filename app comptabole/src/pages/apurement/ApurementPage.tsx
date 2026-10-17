import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { api } from "@/lib/api";
import { tnd } from "@/lib/apurement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import { useSocietes } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { useApurement } from "@/store/apurement";
import { EntitySheet } from "./EntitySheet";
import { RemindersPanel } from "./RemindersPanel";
import { ImportPanel } from "./ImportPanel";
import { DeclarationPanel } from "./DeclarationPanel";
import { ProfilePanel } from "./ProfilePanel";
import type {
  ApurementKind,
  ApurementRecord,
  ApurementSummary,
  ApurementControls,
  ApurementList,
  Quarter,
} from "@/types/apurement";

const labels = {
  autorisations: "Autorisations",
  fournisseurs: "Fournisseurs",
  bcs: "Bons de commande",
  factures: "Factures",
};
const initialYear = Number(
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Tunis",
  }).format(new Date()),
);
export function ApurementPage() {
  const { societeId, bcId, factureId, declarationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const view = declarationId
    ? "declarations"
    : location.pathname.endsWith("/imports")
      ? "imports"
      : params.get("vue") ||
        (params.has("registre") || bcId || factureId ? "registre" : "overview");
  const annee = Number(params.get("annee")) || initialYear;
  const trimestre = (params.get("trimestre") || "T1") as Quarter;
  const kind = (params.get("registre") ||
    (bcId ? "bcs" : "factures")) as ApurementKind;
  const activeKind = kind in labels ? kind : "factures";
  const authorizationId = params.get("autorisationId");
  const sourceFilter = params.get("source") || "";
  const societies = useSocietes();
  const permissions = usePermissions();
  const { result, loading, load, clear } = useApurement();
  const [summary, setSummary] = useState<ApurementSummary[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const shownCompanies = summary.filter((s) =>
    s.raisonSociale
      .toLocaleLowerCase("fr")
      .includes(companyQuery.toLocaleLowerCase("fr")),
  );
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ApurementRecord | "new" | null>(null);
  const [refs, setRefs] = useState<
    Record<"autorisations" | "fournisseurs" | "bcs", ApurementRecord[]>
  >({ autorisations: [], fournisseurs: [], bcs: [] });
  const [controls, setControls] = useState<ApurementControls | null>(null);
  const [controlsPage, setControlsPage] = useState(1);
  const [stockSource, setStockSource] = useState<{
    id: string;
    numero: string;
    fournisseur: string;
    htMillimes: string;
    date: string | null;
  } | null>(null);
  const stockId = params.get("stockId");
  useEffect(() => {
    setStockSource(null);
    if (!stockId || !societeId) return;
    let live = true;
    api
      .get<NonNullable<typeof stockSource>>(`/apurement/stock/${stockId}`)
      .then((r) => {
        if (live) setStockSource(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [stockId, societeId]);
  const period = `annee=${annee}&trimestre=${trimestre}`;
  useEffect(() => setControlsPage(1), [societeId, period]);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    setEditing(null);
    setControls(null);
    return () => clear();
  }, [clear, societeId]);
  useEffect(() => {
    let last = 0;
    const refreshOnFocus = () => {
      if (Date.now() - last < 1000) return;
      last = Date.now();
      setRevision((v) => v + 1);
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);
  useEffect(() => {
    setError("");
    let live = true;
    api
      .get<ApurementSummary[]>(`/apurement/synthese?${period}`)
      .then((r) => {
        if (live) setSummary(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [period, revision]);
  useEffect(() => {
    if (!societeId || view !== "registre") return;
    const timer = setTimeout(() => {
      load(
        activeKind,
        `societeId=${societeId}&${period}&page=${page}&q=${encodeURIComponent(q)}${bcId && activeKind === "factures" ? `&bcId=${bcId}` : ""}${authorizationId && activeKind === "bcs" ? `&autorisationId=${authorizationId}` : ""}${sourceFilter && activeKind === "factures" ? `&source=${sourceFilter}` : ""}`,
      ).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(timer);
  }, [
    societeId,
    activeKind,
    period,
    page,
    q,
    revision,
    load,
    bcId,
    view,
    authorizationId,
    sourceFilter,
  ]);
  const loadRefs = useCallback(async () => {
    if (!societeId) return;
    // Bounded, paginated lookup loading; no silent truncation at the first page.
    async function all(k: ApurementKind) {
      const rows: ApurementRecord[] = [];
      let p = 1;
      for (;;) {
        const r = await api.get<ApurementList>(
          `/apurement/${k}?societeId=${societeId}&size=100&page=${p++}`,
        );
        rows.push(...r.items);
        if (!r.hasMore) return rows;
      }
    }
    const [autorisations, fournisseurs, bcs] = await Promise.all([
      all("autorisations"),
      all("fournisseurs"),
      all("bcs"),
    ]);
    return { autorisations, fournisseurs, bcs };
  }, [societeId]);
  useEffect(() => {
    let live = true;
    loadRefs()
      .then((r) => {
        if (live && r) setRefs(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [loadRefs, revision]);
  useEffect(() => {
    if (!societeId || (!bcId && !factureId)) return;
    let live = true;
    const k = factureId ? "factures" : "bcs";
    api
      .get<ApurementRecord>(`/apurement/${k}/${factureId || bcId}`)
      .then((r) => {
        if (live && r.societeId === societeId) setEditing(r);
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, [societeId, bcId, factureId]);
  async function check() {
    try {
      setControls(
        await api.get<ApurementControls>(
          `/apurement/controles?societeId=${societeId}&${period}&page=${controlsPage}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contrôle impossible.");
    }
  }
  useEffect(() => {
    setControls(null);
    if (!societeId || view !== "controls") return;
    let live = true;
    api
      .get<ApurementControls>(
        `/apurement/controles?societeId=${societeId}&${period}&page=${controlsPage}`,
      )
      .then((r) => {
        if (live) setControls(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [societeId, period, view, revision, controlsPage]);
  function selectView(value: string, registre?: string) {
    const next = new URLSearchParams(params);
    next.set("vue", value);
    if (registre) next.set("registre", registre);
    setPage(1);
    setQ("");
    setEditing(null);
    if (
      declarationId ||
      bcId ||
      factureId ||
      location.pathname.endsWith("/imports")
    )
      navigate(`/apurement/${societeId}?${next}`);
    else setParams(next);
  }
  const society = societies.find((s) => s.id === societeId);
  const stats = summary.find((s) => s.id === societeId);
  const patchParams = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
    setPage(1);
  };
  if (societeId && !permissions.canSeeSociete(societeId))
    return <p role="alert">Société hors périmètre.</p>;
  return (
    <div className="min-w-0 space-y-4">
      <div data-tour="apurement-identity">
        <SignatureLedgerBanner
          icon={ClipboardCheck}
          eyebrow="Comptabilité · achats"
          title="Apurement TVA"
          description={
            society
              ? `${society.raisonSociale} · Achats en suspension de TVA`
              : "Autorisations, bons de commande et déclarations trimestrielles"
          }
          metrics={
            stats
              ? [
                  { label: "BC", value: stats.bcs },
                  { label: "Factures", value: stats.factures },
                  { label: "HT", value: tnd(stats.ht) },
                  { label: "TVA suspendue", value: tnd(stats.tva) },
                ]
              : []
          }
          action={
            societeId
              ? {
                  label: `Ajouter ${activeKind === "bcs" ? "un BC" : activeKind === "factures" ? "une facture" : activeKind === "autorisations" ? "une autorisation" : "un fournisseur"}`,
                  onClick: () => setEditing("new"),
                }
              : undefined
          }
        />
      </div>
      <div
        className="flex flex-wrap items-end gap-3"
        data-tour="apurement-period"
      >
        <label className="text-sm">
          Année
          <Input
            aria-label="Année"
            type="number"
            min={2000}
            max={2100}
            value={annee}
            onChange={(e) => patchParams("annee", e.target.value)}
            className="w-28"
          />
        </label>
        <label className="text-sm">
          Trimestre
          <select
            className="ml-2 h-10 rounded border bg-background px-3"
            aria-label="Trimestre"
            value={trimestre}
            onChange={(e) => patchParams("trimestre", e.target.value)}
          >
            {["T1", "T2", "T3", "T4"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {societeId && (
          <Link className="text-sm underline" to={`/apurement?${period}`}>
            Toutes les sociétés
          </Link>
        )}
      </div>
      <p className="border-l border-amber-500 pl-3 text-sm text-muted-foreground">
        Calculs provisoires. Le format BCD officiel et les règles d’arrondi
        restent à valider ; l’export officiel est désactivé.
      </p>
      {error && (
        <div
          role="alert"
          className="border border-destructive p-3 text-sm text-destructive"
        >
          {error}
          <Button
            variant="ghost"
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}
      {!societeId ? (
        <>
          <Input
            aria-label="Rechercher une société dans Apurement"
            placeholder="Rechercher une société…"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            className="max-w-lg"
          />
          <div className="hidden md:block">
            <DataTable
              data={shownCompanies}
              getRowId={(s) => s.id}
              columns={[
                {
                  id: "societe",
                  header: "Société",
                  cell: (s) => (
                    <Link
                      className="font-medium underline"
                      to={`/apurement/${s.id}?${period}`}
                    >
                      {s.raisonSociale}
                    </Link>
                  ),
                },
                { id: "bc", header: "BC", cell: (s) => s.bcs },
                { id: "factures", header: "Factures", cell: (s) => s.factures },
                {
                  id: "ht",
                  header: "HT",
                  align: "right",
                  cell: (s) => tnd(s.ht),
                },
                {
                  id: "tva",
                  header: "TVA suspendue",
                  align: "right",
                  cell: (s) => tnd(s.tva),
                },
              ]}
            />
          </div>
          <div className="divide-y md:hidden">
            {shownCompanies.map((s) => (
              <Link
                key={s.id}
                className="block space-y-2 py-4"
                to={`/apurement/${s.id}?${period}`}
              >
                <span className="block font-medium">{s.raisonSociale}</span>
                <span className="block text-sm text-muted-foreground">
                  {s.bcs} BC · {s.factures} facture(s)
                </span>
                <span className="flex flex-wrap justify-between gap-2 text-sm tabular-nums">
                  <span>HT {tnd(s.ht)}</span>
                  <span>TVA {tnd(s.tva)}</span>
                </span>
              </Link>
            ))}
            {!shownCompanies.length && (
              <p className="py-8 text-sm text-muted-foreground">
                Aucune société ne correspond à la recherche.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <nav
            className="flex max-w-full gap-1 overflow-x-auto border-b pb-2"
            aria-label="Dossier Apurement"
            data-tour="apurement-sections"
          >
            {[
              ["overview", "Vue d’ensemble"],
              ["registre", "Autorisations & BC"],
              ["factures", "Factures"],
              ["controls", "Contrôles"],
              ["declarations", "Déclarations"],
              ["documents", "Documents & rappels"],
              ["imports", "Importer"],
            ].map(([v, label]) => (
              <Button
                key={v}
                className="shrink-0"
                variant={
                  (
                    v === "factures"
                      ? view === "registre" && activeKind === "factures"
                      : v === "registre"
                        ? view === "registre" && activeKind !== "factures"
                        : view === v
                  )
                    ? "secondary"
                    : "ghost"
                }
                onClick={() =>
                  selectView(
                    v === "factures" ? "registre" : v,
                    v === "factures"
                      ? "factures"
                      : v === "registre"
                        ? "bcs"
                        : undefined,
                  )
                }
              >
                {label}
              </Button>
            ))}
          </nav>
          {stockSource && (
            <p className="border-l pl-3 text-sm">
              Achat Stock sélectionné : {stockSource.numero} ·{" "}
              {stockSource.fournisseur} · {tnd(stockSource.htMillimes)}. Ouvrez
              une facture pour confirmer la liaison, ou ajoutez une facture
              préremplie.
            </p>
          )}
          {view === "registre" && activeKind === "bcs" && authorizationId && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Autorisation :{" "}
                {refs.autorisations.find((a) => a.id === authorizationId)
                  ?.numero || "sélectionnée"}
              </span>
              <Button
                variant="outline"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete("autorisationId");
                  setParams(next);
                  setPage(1);
                }}
              >
                Afficher tous les BC
              </Button>
            </div>
          )}
          {view === "overview" && (
            <section className="space-y-4">
              <h2 className="font-semibold">
                Dossier {annee} {trimestre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {stats?.factures ?? "—"} facture(s) affectée(s) à{" "}
                {stats?.bcs ?? "—"} BC sur cette période. La revue des
                justificatifs, la déclaration et le dépôt sont suivis
                séparément.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => selectView("registre", "bcs")}>
                  Gérer les autorisations et BC
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectView("registre", "factures")}
                >
                  Ouvrir les factures
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectView("controls")}
                >
                  Contrôler ce trimestre
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectView("declarations")}
                >
                  Préparer une déclaration
                </Button>
              </div>
            </section>
          )}
          {view === "registre" && (
            <>
              {activeKind !== "factures" && (
                <nav
                  className="flex flex-wrap gap-1 border-b pb-2"
                  aria-label="Registres Apurement"
                  data-tour="apurement-registers"
                >
                  {Object.entries(labels)
                    .filter(([key]) => key !== "factures")
                    .map(([key, label]) => (
                      <Button
                        key={key}
                        variant={key === activeKind ? "secondary" : "ghost"}
                        onClick={() => patchParams("registre", key)}
                      >
                        {label}
                      </Button>
                    ))}
                </nav>
              )}
              <div className="flex flex-wrap gap-2">
                {activeKind === "factures" || activeKind === "bcs" ? (
                  <LedgerSearchFilter
                    className="w-full max-w-lg"
                    value={q}
                    onValueChange={(value) => {
                      setQ(value);
                      setPage(1);
                    }}
                    placeholder="Rechercher un numéro ou un fournisseur…"
                    searchLabel="Rechercher dans le registre Apurement"
                    filterLabel="Filtrer le registre Apurement"
                    activeFilterCount={
                      activeKind === "factures"
                        ? sourceFilter
                          ? 1
                          : 0
                        : authorizationId
                          ? 1
                          : 0
                    }
                    onReset={() =>
                      patchParams(
                        activeKind === "factures" ? "source" : "autorisationId",
                        "",
                      )
                    }
                  >
                    {activeKind === "factures" ? (
                      <label className="space-y-1 text-sm">
                        Origine de la facture
                        <select
                          className="h-10 w-full rounded border bg-background px-2"
                          value={sourceFilter}
                          onChange={(e) =>
                            patchParams("source", e.target.value)
                          }
                        >
                          <option value="">Toutes les origines</option>
                          <option value="manuel">Saisie manuelle</option>
                          <option value="stock">Reprise de Stock</option>
                          <option value="import">Import</option>
                        </select>
                      </label>
                    ) : (
                      <label className="space-y-1 text-sm">
                        Autorisation
                        <select
                          className="h-10 w-full rounded border bg-background px-2"
                          value={authorizationId || ""}
                          onChange={(e) =>
                            patchParams("autorisationId", e.target.value)
                          }
                        >
                          <option value="">Toutes les autorisations</option>
                          {refs.autorisations.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.numero}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </LedgerSearchFilter>
                ) : (
                  <Input
                    className="max-w-md"
                    aria-label="Rechercher dans le registre"
                    placeholder="Rechercher un numéro ou un fournisseur…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                  />
                )}
              </div>
              <div className="hidden md:block">
                <DataTable
                  key={`${activeKind}-${page}`}
                  data={result.items}
                  getRowId={(r) => r.id}
                  isLoading={loading}
                  pageSize={25}
                  hidePagination
                  onRowClick={(r) => setEditing(r)}
                  columns={[
                    {
                      id: "numero",
                      header: labels[activeKind],
                      cell: (r) => (
                        <Button variant="link" onClick={() => setEditing(r)}>
                          {r.numero || r.numeroFacture || r.raisonSociale}
                        </Button>
                      ),
                    },
                    {
                      id: "date",
                      header: "Date / identité",
                      cell: (r) =>
                        r.dateFacture ||
                        r.dateBrute ||
                        r.dateBc ||
                        r.matriculeFiscalRaw ||
                        "—",
                    },
                    {
                      id: "ht",
                      header: "HT",
                      align: "right",
                      cell: (r) =>
                        tnd(r.montantHtMillimes || r.plafondHtMillimes),
                    },
                    {
                      id: "tva",
                      header: "TVA suspendue",
                      align: "right",
                      cell: (r) => tnd(r.tvaSuspendueMillimes),
                    },
                    {
                      id: "source",
                      header: "Source",
                      cell: (r) =>
                        r.stockMouvementId ? (
                          <span>
                            {r.source === "import" ? "Import · " : ""}
                            <Link to={`/stock/${societeId}`}>Liée à Stock</Link>
                          </span>
                        ) : activeKind === "factures" ? (
                          r.source === "import" ? (
                            "Import"
                          ) : r.source === "stock" ? (
                            "Stock délié"
                          ) : (
                            "Saisie autonome"
                          )
                        ) : (
                          "—"
                        ),
                    },
                  ]}
                />
              </div>
              <div className="divide-y md:hidden">
                {result.items.map((r) => (
                  <button
                    className="flex w-full flex-wrap items-center justify-between gap-2 py-4 text-left"
                    key={r.id}
                    onClick={() => setEditing(r)}
                  >
                    <span className="min-w-0 font-medium">
                      {r.numero || r.numeroFacture || r.raisonSociale}
                      <span className="block text-xs text-muted-foreground">
                        {r.dateFacture ||
                          r.dateBrute ||
                          r.dateBc ||
                          r.matriculeFiscalRaw}
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      {tnd(r.montantHtMillimes || r.plafondHtMillimes)}
                      <span className="block text-xs">
                        TVA {tnd(r.tvaSuspendueMillimes)}
                      </span>
                    </span>
                  </button>
                ))}
                {!loading && !result.items.length && (
                  <p className="py-8 text-sm text-muted-foreground">
                    Aucun enregistrement. Ajoutez les fournisseurs, puis les
                    autorisations et BC.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {result.total} enregistrement(s) · page {page}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!result.hasMore || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
          {view === "controls" && (
            <Button variant="outline" onClick={check}>
              Relancer les contrôles
            </Button>
          )}
          {view === "controls" && controls && (
            <section className="space-y-3 border-t pt-4">
              <h2 className="font-semibold">Contrôles du trimestre</h2>
              <p className="text-sm">
                {controls.total} contrôle(s) · page {controls.page}
              </p>
              <p className="text-sm tabular-nums">
                TVA détaillée {tnd(controls.totals.tvaLignes)} · TVA sur HT
                global {tnd(controls.totals.tvaGlobale)} · Écart{" "}
                {tnd(controls.totals.ecart)}
              </p>
              {!controls.total && (
                <p>
                  Aucune anomalie de facture détectée. La validation fiscale
                  reste conditionnée aux règles d’arrondi approuvées.
                </p>
              )}
              {controls.controls.map((c) => (
                <div
                  key={`${c.factureId}-${c.code}`}
                  className="flex flex-wrap items-center gap-2 border-b py-2 text-sm"
                >
                  <span
                    className={
                      c.severity === "blocage"
                        ? "text-destructive"
                        : "text-amber-700"
                    }
                  >
                    {c.severity === "blocage" ? "Bloquant" : "À revoir"}
                  </span>
                  <Link
                    className="underline"
                    to={`/apurement/${societeId}/factures/${c.factureId}?${period}`}
                  >
                    {c.message}
                  </Link>
                  {c.ack ? (
                    <span>Revu : {c.ack.motif}</span>
                  ) : (
                    permissions.canManageCollaborateurs &&
                    c.severity === "avertissement" && (
                      <ReviewControl control={c} onDone={check} />
                    )
                  )}
                </div>
              ))}
            </section>
          )}
          {view === "controls" && controls && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={controlsPage === 1}
                onClick={() => setControlsPage((p) => p - 1)}
              >
                Contrôles précédents
              </Button>
              <Button
                variant="outline"
                disabled={!controls.hasMore}
                onClick={() => setControlsPage((p) => p + 1)}
              >
                Contrôles suivants
              </Button>
            </div>
          )}
          {editing && (
            <EntitySheet
              key={editing === "new" ? activeKind : editing.id}
              kind={factureId ? "factures" : bcId ? "bcs" : activeKind}
              societeId={societeId}
              annee={annee}
              trimestre={trimestre}
              record={editing === "new" ? undefined : editing}
              initialValues={
                activeKind === "factures" && stockSource
                  ? {
                      numeroFacture: stockSource.numero,
                      dateFacture: stockSource.date,
                      montantHtMillimes: stockSource.htMillimes,
                      fournisseurId: refs.fournisseurs.find((f) =>
                        [f.raisonSociale, ...(f.aliases || [])].some(
                          (n) =>
                            n?.trim().toLowerCase() ===
                            stockSource.fournisseur.trim().toLowerCase(),
                        ),
                      )?.id,
                    }
                  : undefined
              }
              refs={refs}
              onClose={() => {
                setEditing(null);
                if (factureId || bcId)
                  navigate(`/apurement/${societeId}?${period}`);
              }}
              onSaved={refresh}
            />
          )}
          {view === "imports" && (
            <ImportPanel
              key={`${societeId}-${period}`}
              societeId={societeId}
              annee={annee}
              trimestre={trimestre}
              bcs={refs.bcs}
              onDone={refresh}
            />
          )}
          {view === "documents" && (
            <>
              <RemindersPanel
                societeId={societeId}
                annee={annee}
                trimestre={trimestre}
              />
              <ProfilePanel societeId={societeId} />
            </>
          )}
          {view === "declarations" && (
            <DeclarationPanel
              key={`${societeId}-${period}`}
              societeId={societeId}
              annee={annee}
              trimestre={trimestre}
              selectedId={declarationId}
            />
          )}
        </>
      )}
    </div>
  );
}
function ReviewControl({
  control,
  onDone,
}: {
  control: ApurementControls["controls"][number];
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.post(`/apurement/controles/${control.factureId}/ack`, {
            code: control.code,
            fingerprint: control.fingerprint,
            motif: note,
          });
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Revue impossible");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        aria-label="Motif de revue"
        required
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Motif de revue"
      />
      <Button disabled={busy}>Confirmer la revue</Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
