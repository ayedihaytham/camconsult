import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { CollecteStatusDot } from "@/components/ledger/StatusDot";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { useDataTable } from "@/components/data-table/useDataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import type { Collecte } from "@/types";
import { CollecteCreateDialog } from "./CollecteCreateDialog";

export function CollectesListPage() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const societes = useSocietes();
  const list = useCollectes((s) => s.list);
  const loading = useCollectes((s) => s.loadingList);
  const fetchList = useCollectes((s) => s.fetchList);
  const create = useCollectes((s) => s.create);
  const remove = useCollectes((s) => s.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Collecte | null>(null);
  const [vue, setVue] = useState<"actives" | "archivees" | "toutes">("actives");

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const socNom = (id: string) =>
    societes.find((s) => s.id === id)?.raisonSociale ?? "Société";

  const nbArchivees = list.filter((c) => c.statut === "archive").length;
  const shown = list.filter((c) =>
    vue === "toutes"
      ? true
      : vue === "archivees"
        ? c.statut === "archive"
        : c.statut !== "archive",
  );

  const columns = useMemo<ColumnDef<Collecte>[]>(
    () => [
      {
        id: "societe",
        accessorFn: (collecte) => socNom(collecte.societeId),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Société" />
        ),
        cell: ({ row }) => (
          <span className="block truncate font-semibold text-foreground">
            {socNom(row.original.societeId)}
          </span>
        ),
        meta: { label: "Société", headerClassName: "w-[32%]" },
      },
      {
        accessorKey: "periode",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Période" />
        ),
        meta: { label: "Période", headerClassName: "w-36" },
      },
      {
        accessorKey: "statut",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Statut" />
        ),
        cell: ({ row }) => <CollecteStatusDot statut={row.original.statut} />,
        meta: { label: "Statut", headerClassName: "w-36" },
      },
      {
        id: "onglets",
        accessorFn: (collecte) => collecte.onglets.length,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tableaux" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.onglets.length}</span>
        ),
        meta: {
          label: "Tableaux",
          headerClassName: "w-28",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "majLe",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Dernière activité" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelative(row.original.majLe)}
          </span>
        ),
        meta: { label: "Dernière activité", headerClassName: "w-44" },
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              enableHiding: false,
              enableSorting: false,
              header: () => null,
              cell: ({ row }) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setToDelete(row.original);
                  }}
                  aria-label={`Supprimer ${socNom(row.original.societeId)}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ),
              meta: { headerClassName: "w-10", cellClassName: "w-10" },
            } satisfies ColumnDef<Collecte>,
          ]
        : []),
    ],
    [isAdmin, societes],
  );

  const table = useDataTable({
    columns,
    data: shown,
    getRowId: (collecte) => collecte.id,
    initialSorting: [{ id: "majLe", desc: true }],
    resetKey: vue,
  });

  const emptyMessage = loading
    ? "Chargement…"
    : list.length === 0
      ? "Aucune collecte."
      : vue === "archivees"
        ? "Aucune collecte archivée."
        : "Aucune collecte active.";

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Collecte de pièces"
        description={
          isAdmin
            ? "Classeurs confiés aux clients pour saisie et retour au cabinet."
            : "Classeurs à remplir et transmettre à votre cabinet."
        }
        actions={
          isAdmin ? (
            <Button variant="ledger" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle collecte
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar
        table={table}
        ariaLabel="Outils des collectes"
        showViewOptions
        leading={
          <LedgerSegmented
            value={vue}
            onChange={setVue}
            options={[
              {
                value: "actives",
                label: `Actives (${list.length - nbArchivees})`,
              },
              { value: "archivees", label: `Archivées (${nbArchivees})` },
              { value: "toutes", label: "Toutes" },
            ]}
          />
        }
        trailing={
          <>
            <DataTablePagination
              table={table}
              itemLabel="collectes"
              variant="metadata"
            />
            <DataTablePagination
              table={table}
              itemLabel="collectes"
              variant="controls"
            />
          </>
        }
      />

      <DataTable
        table={table}
        isLoading={loading}
        emptyMessage={emptyMessage}
        onRowClick={(row) => navigate(`/collectes/${row.original.id}`)}
        getRowClassName={(row) =>
          row.original.statut === "archive" ? "opacity-60" : undefined
        }
        mobileRow={(row) => {
          const collecte = row.original;
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/collectes/${collecte.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/collectes/${collecte.id}`);
                }
              }}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {socNom(collecte.societeId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {collecte.periode} · {collecte.onglets.length} tableaux
                  </p>
                </div>
                <CollecteStatusDot statut={collecte.statut} />
              </div>
              <p className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                Dernière activité {formatRelative(collecte.majLe)}
              </p>
            </div>
          );
        }}
        mobileFooter={
          <DataTablePagination
            table={table}
            itemLabel="collectes"
            variant="mobile"
          />
        }
      />

      {isAdmin && (
        <CollecteCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={async (data) => {
            const c = await create(data);
            toast.success("Collecte créée", {
              description: `${socNom(c.societeId)} — ${c.periode}`,
            });
            navigate(`/collectes/${c.id}`);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette collecte ?"
        description={
          <>
            La collecte{" "}
            <span className="font-medium text-foreground">
              {toDelete
                ? `${socNom(toDelete.societeId)} — ${toDelete.periode}`
                : ""}
            </span>{" "}
            et toutes les données saisies seront supprimées.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
