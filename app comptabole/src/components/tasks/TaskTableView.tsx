import type { Table } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import {
  OperationalContentHeader,
  OperationalLedgerFooter,
  OperationalMobileHeader,
  OperationalMobilePagination,
} from "@/components/ledger/OperationalLedgerLayout";
import { cn } from "@/lib/utils";
import type { TacheStatut } from "@/types";
import { TaskTableMobileCard } from "./TaskTableMobileCard";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

const MOBILE_GROUPS: { status: TacheStatut; label: string; rule: string }[] = [
  { status: "a_faire", label: "À faire", rule: "bg-muted-foreground/55" },
  { status: "en_cours", label: "En cours", rule: "bg-primary/60" },
  { status: "termine", label: "Terminées", rule: "bg-success" },
];

export function TaskTableView({
  table,
  emptyMessage,
  ...actions
}: TaskPresentationActions & {
  table: Table<PresentedTask>;
  emptyMessage: string;
}) {
  const visibleRows = table.getRowModel().rows;
  const allRows = table.getPrePaginationRowModel().rows;

  return (
    <section className="min-w-0">
      <OperationalContentHeader className="hidden lg:flex">
        <h2 className="text-sm font-semibold text-foreground">Vue comparaison</h2>
        <p className="text-xs text-muted-foreground">Champs réels · tri et pagination</p>
      </OperationalContentHeader>
      <DataTable
        table={table}
        emptyMessage={emptyMessage}
        desktopDensity="ledger"
        hideMobile
        className="ledger-work-table task-work-table"
        footer={<OperationalLedgerFooter table={table} itemLabel="tâches" />}
        getRowClassName={(row) =>
          actions.pendingTaskIds.has(row.original.task.id) ? "opacity-70" : undefined
        }
      />
      <div className="lg:hidden">
        <OperationalMobileHeader>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            File de travail
          </h2>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {allRows.length} tâche{allRows.length === 1 ? "" : "s"}
          </span>
        </OperationalMobileHeader>
        <div className="border-y border-border/80 bg-card">
          {MOBILE_GROUPS.map(({ status, label, rule }) => {
            const rows = visibleRows.filter((row) => row.original.task.statut === status);
            if (!rows.length) return null;
            const total = allRows.filter((row) => row.original.task.statut === status).length;
            return (
              <section key={status} aria-label={label}>
                <div className="flex min-h-8 items-center gap-2 border-b border-border/80 bg-muted/20 px-3 sm:px-4">
                  <span className={cn("h-3.5 w-px", rule)} aria-hidden="true" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{label}</h3>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {total} au total{rows.length !== total && ` · ${rows.length} ici`}
                  </span>
                </div>
                {rows.map((row) => <TaskTableMobileCard key={row.id} row={row} actions={actions} />)}
              </section>
            );
          })}
        </div>
        <OperationalMobilePagination table={table} itemLabel="tâches" />
      </div>
    </section>
  );
}
