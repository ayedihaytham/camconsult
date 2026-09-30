import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator } from "lucide-react";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";

export function EtatsFinanciersPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const hydrated = useData((state) => state.hydrated);
  const societes = useMemo(
    () => allSocietes.filter((societe) => canSeeSociete(societe.id)),
    [allSocietes, canSeeSociete],
  );

  return (
    <div className="flex min-w-0 flex-col">
      <SignatureLedgerBanner
        icon={Calculator}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title="États financiers"
        description="Classeurs comptables organisés par société et par exercice."
        metrics={[
          {
            label: "Sociétés accessibles",
            value: societes.length,
            loading: !hydrated,
          },
        ]}
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
            <span
              className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {filtered.length} société{filtered.length === 1 ? "" : "s"}{" "}
              visible{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </OperationalContentHeader>

        {hydrated && societes.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-5 text-sm">
            <Calculator
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium text-foreground">
                Aucune société accessible
              </p>
              <p className="text-muted-foreground">
                Les dossiers financiers disponibles selon votre périmètre
                apparaîtront ici.
              </p>
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
            onRowClick={(row) => openSociete(row.original.id)}
            getRowAriaLabel={(row) =>
              `Ouvrir le dossier financier de ${row.original.raisonSociale}`
            }
            mobileRow={(row) => {
              const societe = row.original;
              return (
                <button
                  type="button"
                  onClick={() => openSociete(societe.id)}
                  className="group flex min-h-[68px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/45 active:bg-secondary/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center border border-border/70 bg-muted/40 font-mono text-xs font-semibold text-muted-foreground"
                  >
                    <SocietyMonogram name={societe.raisonSociale} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {societe.raisonSociale}
                    </span>
                    <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span className="shrink-0 font-mono font-medium text-foreground/80">
                        {societe.code || "—"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">
                        {societe.rne || "RNE non renseigné"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate">{societe.theme}</span>
                    </span>
                  </span>
                  <span className="flex w-[6.5rem] shrink-0 flex-col items-end gap-2">
                    <SocietyStatus statut={societe.statut} />
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary underline-offset-4 group-hover:underline group-focus-visible:underline">
                      Ouvrir{" "}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                </button>
              );
            }}
            footer={
              societes.length > 0 ? (
                <OperationalLedgerFooter table={table} itemLabel="sociétés" />
              ) : undefined
            }
            mobileFooter={
              societes.length > 0 ? (
                <OperationalMobilePagination
                  table={table}
                  itemLabel="sociétés"
                />
              ) : undefined
            }
          />
        )}
      </LedgerWorkSurface>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = `financial-filter-${label.toLocaleLowerCase("fr-FR").replace(/\s+/g, "-")}`;

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="min-h-11 lg:min-h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
