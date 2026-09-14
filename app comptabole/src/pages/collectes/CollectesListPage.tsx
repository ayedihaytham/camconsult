import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { CollecteStatusDot } from "@/components/ledger/StatusDot";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn, formatRelative } from "@/lib/utils";
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

  return (
    <div>
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

      {list.length > 0 && (
        <div className="mb-4 mt-3">
          <LedgerSegmented
            value={vue}
            onChange={setVue}
            options={[
              { value: "actives", label: `Actives (${list.length - nbArchivees})` },
              { value: "archivees", label: `Archivées (${nbArchivees})` },
              { value: "toutes", label: "Toutes" },
            ]}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <LedgerSheet className="mt-4">
          <EmptyState
            icon={ClipboardList}
            title={
              loading
                ? "Chargement…"
                : list.length === 0
                  ? "Aucune collecte"
                  : vue === "archivees"
                    ? "Aucune collecte archivée"
                    : "Aucune collecte active"
            }
            description={
              isAdmin
                ? "Créez une collecte : choisissez un client, une période et les tableaux à remplir."
                : "Aucune collecte ne vous a été confiée pour le moment."
            }
            action={
              isAdmin && !loading ? (
                <Button variant="ledger" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nouvelle collecte
                </Button>
              ) : undefined
            }
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className={list.length > 0 ? "" : "mt-4"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-foreground px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Société
                  </th>
                  <th className="border-b-2 border-foreground px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Période
                  </th>
                  <th className="border-b-2 border-foreground px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Statut
                  </th>
                  <th className="border-b-2 border-foreground px-3 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Tableaux
                  </th>
                  <th className="border-b-2 border-foreground px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Dernière activité
                  </th>
                  {isAdmin && (
                    <th className="w-[1%] border-b-2 border-foreground px-3 py-2.5" />
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/collectes/${c.id}`)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-primary/[0.03]",
                      (i + 1) % 5 === 0
                        ? "border-b-[1.5px] border-rule-strong"
                        : "border-b border-border",
                      c.statut === "archive" && "opacity-60",
                    )}
                  >
                    <td className="px-3 py-2.5 font-semibold text-foreground">
                      {socNom(c.societeId)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.periode}
                    </td>
                    <td className="px-3 py-2.5">
                      <CollecteStatusDot statut={c.statut} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.onglets.length}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {formatRelative(c.majLe)}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(c);
                          }}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LedgerSheet>
      )}

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
              {toDelete ? `${socNom(toDelete.societeId)} — ${toDelete.periode}` : ""}
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
