import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Calculator, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerFooter,
  OperationalLedgerToolbar,
  OperationalMobilePagination,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { StatusDot, type StatusTone } from "@/components/ledger/StatusDot";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDataTable } from "@/components/data-table/useDataTable";
import { usePermissions } from "@/hooks/usePermissions";
import { filterFinancialSocietes } from "@/lib/etatsFinanciers/societeSearch";
import { cn } from "@/lib/utils";
import { useData, useSocietes } from "@/store/data";
import type { Societe, Statut } from "@/types";

const PAGE_SIZE = 5;
const PAGINATION_COLUMNS: [] = [];

const STATUS: Record<Statut, { label: string; tone: StatusTone }> = {
  actif: { label: "Actif", tone: "success" },
  en_attente: { label: "En attente", tone: "warning" },
  inactif: { label: "Inactif", tone: "muted" },
};

const REGISTER_HEAD_CLASS = "h-10 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.045em] text-muted-foreground";

function SocietyStatus({ statut }: { statut: Societe["statut"] }) {
  const item = STATUS[statut];
  return <StatusDot tone={item.tone} label={item.label} className="text-[11px] font-semibold text-foreground/80" />;
}

function SocietyMonogram({ name }: { name: string }) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function RegisterSkeleton() {
  return (
    <div aria-label="Chargement des sociétés">
      <div className="hidden md:block">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-secondary/55 hover:bg-secondary/55">
              <TableHead className={cn(REGISTER_HEAD_CLASS, "w-[33%] pl-3")}>Société</TableHead>
              <TableHead className={cn(REGISTER_HEAD_CLASS, "w-[22%]")}>Code · RNE</TableHead>
              <TableHead className={cn(REGISTER_HEAD_CLASS, "w-[22%]")}>Type de structure</TableHead>
              <TableHead className={cn(REGISTER_HEAD_CLASS, "w-[13%]")}>Statut</TableHead>
              <TableHead className={cn(REGISTER_HEAD_CLASS, "w-[10%] pr-3 text-right")}>Accès</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: PAGE_SIZE }, (_, index) => (
              <TableRow key={index} className="h-[3.875rem] bg-transparent even:bg-transparent">
                <TableCell className="pl-3"><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-2/3" /></TableCell>
                <TableCell><Skeleton className="h-4 w-2/3" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-sm" /></TableCell>
                <TableCell className="pr-3"><Skeleton className="ml-auto h-4 w-14" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y divide-border/70 md:hidden">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <div key={index} className="flex min-h-[68px] items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-9 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EtatsFinanciersPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const hydrated = useData((state) => state.hydrated);
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<Statut | "all">("all");
  const [theme, setTheme] = useState<Societe["theme"] | "all">("all");

  const societes = useMemo(
    () => allSocietes.filter((societe) => canSeeSociete(societe.id)),
    [allSocietes, canSeeSociete],
  );
  const structureTypes = useMemo(
    () => [...new Set(societes.map((societe) => societe.theme).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr-FR")),
    [societes],
  );
  const filtered = useMemo(
    () => filterFinancialSocietes(societes, { query: search, statut, theme }),
    [societes, search, statut, theme],
  );
  const resetFilters = () => {
    setStatut("all");
    setTheme("all");
    table.setPageIndex(0);
  };
  const activeFilterCount = Number(statut !== "all") + Number(theme !== "all");
  const table = useDataTable({
    columns: PAGINATION_COLUMNS,
    data: filtered,
    getRowId: (societe) => societe.id,
    pageSize: PAGE_SIZE,
    resetKey: [search, statut, theme].join("|"),
  });
  const pageSocietes = table.getRowModel().rows.map((row) => row.original);

  function openSociete(societeId: string) {
    navigate(`/etats-financiers/${societeId}`);
  }

  const filters = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <FilterSelect label="Statut" value={statut} onValueChange={(value) => {
        setStatut(value as Statut | "all");
        table.setPageIndex(0);
      }}>
        <SelectItem value="all">Tous</SelectItem>
        {Object.entries(STATUS).map(([value, option]) => (
          <SelectItem key={value} value={value}>{option.label}</SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect label="Type de structure" value={theme} onValueChange={(value) => {
        setTheme(value as Societe["theme"] | "all");
        table.setPageIndex(0);
      }}>
        <SelectItem value="all">Tous les types</SelectItem>
        {structureTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
      </FilterSelect>
    </div>
  );
  const searchControl = (placeholder: string) => (
    <LedgerSearchFilter
      value={search}
      onValueChange={(value) => {
        setSearch(value);
        table.setPageIndex(0);
      }}
      onClearSearch={() => {
        setSearch("");
        table.setPageIndex(0);
      }}
      placeholder={placeholder}
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      filterLabel="Filtrer les sociétés financières"
      activeFilterCount={activeFilterCount}
      onReset={resetFilters}
    >
      {filters}
    </LedgerSearchFilter>
  );

  return (
    <div className="flex min-w-0 flex-col">
      <SignatureLedgerBanner
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title="États financiers"
        description="Classeurs comptables organisés par société et par exercice."
        metrics={[{ label: "Sociétés accessibles", value: societes.length, loading: !hydrated }]}
      />

      <LedgerWorkSurface>
        <OperationalLedgerToolbar
          label="Recherche des sociétés financières"
          search={searchControl("Rechercher une société, un code ou un RNE")}
        />
        <OperationalMobileUtility label="Recherche des sociétés financières">
          {searchControl("Société, code ou RNE…")}
        </OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">
              Registre des sociétés
            </h2>
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">
              Accès aux exercices et états financiers
            </p>
          </div>
          {hydrated && (
            <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {filtered.length} société{filtered.length === 1 ? "" : "s"} visible{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </OperationalContentHeader>

        {!hydrated ? (
          <RegisterSkeleton />
        ) : societes.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-5 text-sm">
            <Calculator className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Aucune société accessible</p>
              <p className="text-muted-foreground">Les dossiers financiers disponibles selon votre périmètre apparaîtront ici.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-5 text-sm">
            <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Aucune société correspondante</p>
              <p className="text-muted-foreground">Essayez un autre nom, code ou RNE ou ajustez vos filtres.</p>
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-9 px-2 text-xs text-primary"
                  onClick={resetFilters}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-secondary/55 hover:bg-secondary/55">
                    <TableHead scope="col" className={cn(REGISTER_HEAD_CLASS, "w-[33%] pl-3")}>Société</TableHead>
                    <TableHead scope="col" className={cn(REGISTER_HEAD_CLASS, "w-[22%]")}>Code · RNE</TableHead>
                    <TableHead scope="col" className={cn(REGISTER_HEAD_CLASS, "w-[22%]")}>Type de structure</TableHead>
                    <TableHead scope="col" className={cn(REGISTER_HEAD_CLASS, "w-[13%]")}>Statut</TableHead>
                    <TableHead scope="col" className={cn(REGISTER_HEAD_CLASS, "w-[10%] pr-3 text-right")}>Accès</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSocietes.map((societe) => (
                    <TableRow
                      key={societe.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`Ouvrir le dossier financier de ${societe.raisonSociale}`}
                      onClick={() => openSociete(societe.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openSociete(societe.id);
                        }
                      }}
                      className="group h-[3.875rem] cursor-pointer bg-transparent even:bg-transparent hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <TableCell className="max-w-[360px] py-1.5 pl-3">
                        <span className="block truncate font-semibold text-foreground">{societe.raisonSociale}</span>
                      </TableCell>
                      <TableCell className="min-w-0 py-1.5 text-[11px]">
                        <span className="block truncate font-mono font-semibold text-foreground/85">{societe.code || "—"}</span>
                        <span className="block truncate text-muted-foreground">{societe.rne || "RNE non renseigné"}</span>
                      </TableCell>
                      <TableCell className="min-w-0 py-1.5 text-muted-foreground">
                        <span className="block truncate">{societe.theme}</span>
                      </TableCell>
                      <TableCell className="py-1.5"><SocietyStatus statut={societe.statut} /></TableCell>
                      <TableCell className="whitespace-nowrap py-1.5 pr-3 text-right text-xs font-semibold text-primary">
                        <span className="inline-flex min-h-9 items-center justify-end gap-1.5 underline-offset-4 group-hover:underline group-focus-visible:underline">
                          Ouvrir <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border/70 md:hidden" aria-label="Sociétés accessibles">
              {pageSocietes.map((societe) => (
                <li key={societe.id}>
                  <button
                    type="button"
                    onClick={() => openSociete(societe.id)}
                    className="group flex min-h-[68px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/45 active:bg-secondary/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center border border-border/70 bg-muted/40 font-mono text-xs font-semibold text-muted-foreground">
                      <SocietyMonogram name={societe.raisonSociale} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{societe.raisonSociale}</span>
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                        <span className="shrink-0 font-mono font-medium text-foreground/80">{societe.code || "—"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0">{societe.rne || "RNE non renseigné"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 truncate">{societe.theme}</span>
                      </span>
                    </span>
                    <span className="flex w-[6.5rem] shrink-0 flex-col items-end gap-2">
                      <SocietyStatus statut={societe.statut} />
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary underline-offset-4 group-hover:underline group-focus-visible:underline">
                        Ouvrir <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {hydrated && societes.length > 0 && (
          <>
            <div className="hidden md:block">
              <OperationalLedgerFooter table={table} itemLabel="sociétés" />
            </div>
            <div className="md:hidden">
              <OperationalMobilePagination
                table={table}
                itemLabel="sociétés"
              />
            </div>
          </>
        )}
      </LedgerWorkSurface>
    </div>
  );
}

function FilterSelect({ label, value, onValueChange, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = `financial-filter-${label.toLocaleLowerCase("fr-FR").replace(/\s+/g, "-")}`;

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="min-h-11 lg:min-h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
