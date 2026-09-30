// Patron partagé « registre de sociétés » (Signature Ledger / Financial
// Ledger) : bannière navy, recherche + filtres Statut/Type, registre
// DataTable — utilisé par États financiers, Souche de chèques, État client,
// Suivi client devise et Gestion de stock. Évite de dupliquer ce tableau et
// ses colonnes dans chaque module ; chaque page ne fournit que son texte, son
// filtrage par permission et sa route de destination.
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
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
import { SignatureLedgerBanner, type SignatureLedgerMetric } from "@/components/ledger/SignatureLedgerBanner";
import { StatusDot, type StatusTone } from "@/components/ledger/StatusDot";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTable } from "@/components/data-table/useDataTable";
import { filterFinancialSocietes } from "@/lib/etatsFinanciers/societeSearch";
import type { Societe, Statut } from "@/types";

const PAGE_SIZE = 5;

const STATUS: Record<Statut, { label: string; tone: StatusTone }> = {
  actif: { label: "Actif", tone: "success" },
  en_attente: { label: "En attente", tone: "warning" },
  inactif: { label: "Inactif", tone: "muted" },
};

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

const SOCIETY_COLUMNS: ColumnDef<Societe, unknown>[] = [
  {
    accessorKey: "raisonSociale",
    meta: { label: "Société", headerClassName: "w-[33%]", cellClassName: "max-w-[360px]" },
    cell: ({ row }) => (
      <span className="block truncate font-semibold text-foreground">{row.original.raisonSociale}</span>
    ),
  },
  {
    id: "codeRne",
    accessorFn: (row) => `${row.code ?? ""} ${row.rne ?? ""}`,
    meta: { label: "Code · RNE", headerClassName: "w-[22%]", cellClassName: "text-[11px]" },
    cell: ({ row }) => (
      <>
        <span className="block truncate font-mono font-semibold text-foreground/85">{row.original.code || "—"}</span>
        <span className="block truncate text-muted-foreground">{row.original.rne || "RNE non renseigné"}</span>
      </>
    ),
  },
  {
    accessorKey: "theme",
    meta: { label: "Type de structure", headerClassName: "w-[22%]", cellClassName: "text-muted-foreground" },
    cell: ({ row }) => <span className="block truncate">{row.original.theme}</span>,
  },
  {
    accessorKey: "statut",
    meta: { label: "Statut", headerClassName: "w-[13%]" },
    cell: ({ row }) => <SocietyStatus statut={row.original.statut} />,
  },
  {
    id: "access",
    meta: { label: "Accès", headerClassName: "w-[10%] text-right", cellClassName: "text-right text-xs font-semibold text-primary" },
    cell: () => (
      <span className="inline-flex min-h-9 items-center justify-end gap-1.5 underline-offset-4 group-hover:underline group-focus-visible:underline">
        Ouvrir <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </span>
    ),
  },
];

interface SocieteRegistryPageProps {
  eyebrow: string;
  title: string;
  description: string;
  /** Métriques de la bannière ; par défaut « Sociétés accessibles ». */
  metrics?: SignatureLedgerMetric[];
  /** Sociétés déjà filtrées par le périmètre/permission de l'appelant. */
  societes: Societe[];
  hydrated: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  onOpen: (societeId: string) => void;
  getAriaLabel: (societe: Societe) => string;
  registryLabel: string;
  registryDescription: string;
  searchLabel: string;
  searchPlaceholder: string;
}

export function SocieteRegistryPage({
  eyebrow,
  title,
  description,
  metrics,
  societes,
  hydrated,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onOpen,
  getAriaLabel,
  registryLabel,
  registryDescription,
  searchLabel,
  searchPlaceholder,
}: SocieteRegistryPageProps) {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<Statut | "all">("all");
  const [theme, setTheme] = useState<Societe["theme"] | "all">("all");

  const structureTypes = useMemo(
    () => [...new Set(societes.map((societe) => societe.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr-FR")),
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
    columns: SOCIETY_COLUMNS,
    data: filtered,
    getRowId: (societe) => societe.id,
    pageSize: PAGE_SIZE,
    resetKey: [search, statut, theme].join("|"),
  });

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
      searchLabel={searchLabel}
      filterLabel="Filtrer les sociétés"
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
        eyebrow={eyebrow}
        title={title}
        description={description}
        metrics={metrics ?? [{ label: "Sociétés accessibles", value: societes.length, loading: !hydrated }]}
      />

      <LedgerWorkSurface>
        <OperationalLedgerToolbar label={searchLabel} search={searchControl(searchPlaceholder)} />
        <OperationalMobileUtility label={searchLabel}>{searchControl(searchPlaceholder)}</OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">{registryLabel}</h2>
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">{registryDescription}</p>
          </div>
          {hydrated && (
            <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {filtered.length} société{filtered.length === 1 ? "" : "s"} visible{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </OperationalContentHeader>

        {hydrated && societes.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-5 text-sm">
            <EmptyIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">{emptyTitle}</p>
              <p className="text-muted-foreground">{emptyDescription}</p>
            </div>
          </div>
        ) : (
          <DataTable
            className="ledger-work-table min-w-0 [&>div:last-child]:space-y-0"
            desktopDensity="ledger"
            desktopVariant="register"
            table={table}
            isLoading={!hydrated}
            emptyMessage="Aucune société correspondante"
            onRowClick={(row) => onOpen(row.original.id)}
            getRowAriaLabel={(row) => getAriaLabel(row.original)}
            mobileRow={(row) => {
              const societe = row.original;
              return (
                <button
                  type="button"
                  onClick={() => onOpen(societe.id)}
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
              );
            }}
            footer={societes.length > 0 ? <OperationalLedgerFooter table={table} itemLabel="sociétés" /> : undefined}
            mobileFooter={societes.length > 0 ? <OperationalMobilePagination table={table} itemLabel="sociétés" /> : undefined}
          />
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
  const id = `societe-registry-filter-${label.toLocaleLowerCase("fr-FR").replace(/\s+/g, "-")}`;
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
