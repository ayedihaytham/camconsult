import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Plus, Trash2, Upload } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import { LedgerKpiRow } from "@/components/ledger/LedgerKpiRow";
import type { DataTableColumn } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useSocieteById } from "@/store/data";
import { useBalances, type BalanceLigneInput } from "@/store/balances";
import type { BalanceLigne } from "@/types";
import { BalanceLigneFormSheet } from "./BalanceLigneFormSheet";
import { ImportBalanceDialog } from "./ImportBalanceDialog";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BalanceEditorPage() {
  const { societeId = "", balanceId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const current = useBalances((s) => s.current);
  const loading = useBalances((s) => s.loadingCurrent);
  const fetchOne = useBalances((s) => s.fetchOne);
  const clearCurrent = useBalances((s) => s.clearCurrent);
  const fetchGrille = useBalances((s) => s.fetchGrille);
  const addLigne = useBalances((s) => s.addLigne);
  const updateLigne = useBalances((s) => s.updateLigne);
  const removeLigne = useBalances((s) => s.removeLigne);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BalanceLigne | null>(null);
  const [toDelete, setToDelete] = useState<BalanceLigne | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetchOne(balanceId);
    fetchGrille(societeId);
    return () => clearCurrent();
  }, [balanceId, societeId, fetchOne, fetchGrille, clearCurrent]);

  const lignes = current?.lignes ?? [];

  const ecartTotal = useMemo(
    () => Math.round(lignes.reduce((s, l) => s + l.solde, 0) * 1000) / 1000,
    [lignes],
  );
  const sansCode = lignes.filter((l) => !l.affectat).length;

  // Table 4 : synthèse par code AFFECTAT (Somme du SOLDE), calculée en direct
  // depuis la balance — jamais stockée.
  const synthese = useMemo(() => {
    const byCode = new Map<string, number>();
    for (const l of lignes) {
      const key = l.affectat || "(sans code)";
      byCode.set(key, (byCode.get(key) ?? 0) + l.solde);
    }
    return [...byCode.entries()]
      .map(([code, solde]) => ({ code, solde: Math.round(solde * 1000) / 1000 }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [lignes]);

  function handleSubmit(data: BalanceLigneInput) {
    if (editing) {
      updateLigne(balanceId, editing.id, data);
      toast.success("Ligne modifiée");
    } else {
      addLigne(balanceId, data);
      toast.success("Ligne ajoutée");
    }
    setEditing(null);
  }

  const columns: DataTableColumn<BalanceLigne>[] = [
    {
      id: "compte",
      header: "Compte",
      sortable: true,
      sortAccessor: (l) => l.compte,
      cell: (l) => <span className="font-mono text-xs">{l.compte}</span>,
    },
    {
      id: "libelle",
      header: "Libellé",
      sortable: true,
      sortAccessor: (l) => l.libelle.toLowerCase(),
      cell: (l) => <span className="text-foreground">{l.libelle || "—"}</span>,
    },
    {
      id: "debit",
      header: "Débit",
      align: "right",
      cell: (l) => <span className="tabular-nums">{l.debit ? fmt(l.debit) : ""}</span>,
    },
    {
      id: "credit",
      header: "Crédit",
      align: "right",
      cell: (l) => <span className="tabular-nums">{l.credit ? fmt(l.credit) : ""}</span>,
    },
    {
      id: "solde",
      header: "Solde",
      align: "right",
      cell: (l) => <span className="font-bold tabular-nums">{fmt(l.solde)}</span>,
    },
    {
      id: "affectat",
      header: "Affectat",
      sortable: true,
      sortAccessor: (l) => l.affectat,
      cell: (l) =>
        l.affectat ? (
          <span className="font-mono text-xs font-semibold text-foreground">
            {l.affectat}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      cell: (l) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setToDelete(l);
          }}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate(`/etats-financiers/${societeId}`)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Tous les exercices
          </button>
        }
        title={`Balance ${current?.exercice ?? ""} — ${societe?.raisonSociale ?? "Société"}`}
        description="Une ligne par compte ; le code AFFECTAT reclasse chaque compte pour la synthèse ci-dessous."
        actions={
          <div className="flex gap-2">
            <Button variant="ledger-text" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Importer une balance
            </Button>
            <Button
              variant="ledger"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvelle ligne
            </Button>
          </div>
        }
      />

      {/* KPI en lignes de relevé — héros = l'écart global, le signal le plus
          critique d'une balance (doit tendre vers 0). */}
      <LedgerSheet className="mt-4">
        <LedgerKpiRow
          hero
          danger={Math.abs(ecartTotal) > 0.01}
          label="Écart de la balance (doit être 0)"
          value={fmt(ecartTotal)}
        />
        <LedgerKpiRow label="Nombre de comptes" value={String(lignes.length)} />
        <LedgerKpiRow
          label="Sans code AFFECTAT"
          value={String(sansCode)}
          danger={sansCode > 0}
        />
      </LedgerSheet>

      {lignes.length === 0 ? (
        <LedgerSheet className="mt-4">
          <EmptyState
            icon={Calculator}
            title={loading ? "Chargement…" : "Balance vide"}
            description="Importez un fichier Excel/CSV ou ajoutez les lignes une à une."
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-4">
          <LedgerTable
            columns={columns}
            data={lignes}
            getRowId={(l) => l.id}
            onRowClick={(l) => {
              setEditing(l);
              setFormOpen(true);
            }}
            pageSize={20}
            initialSort={{ columnId: "compte", direction: "asc" }}
          />
        </LedgerSheet>
      )}

      {/* Table 4 : synthèse par code AFFECTAT */}
      <LedgerSheet className="mt-4">
        <div className="border-b border-border px-[18px] py-3.5">
          <h2 className="text-[0.86rem] font-bold text-foreground">
            Synthèse par code AFFECTAT
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b-2 border-foreground px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Code
                </th>
                <th className="border-b-2 border-foreground px-[18px] py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Somme du solde
                </th>
              </tr>
            </thead>
            <tbody>
              {synthese.map((s, i) => (
                <tr
                  key={s.code}
                  className={
                    (i + 1) % 5 === 0
                      ? "border-b-[1.5px] border-rule-strong"
                      : "border-b border-border"
                  }
                >
                  <td className="px-[18px] py-2 font-mono text-xs font-semibold text-foreground">
                    {s.code}
                  </td>
                  <td className="px-[18px] py-2 text-right tabular-nums">{fmt(s.solde)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="border-t-2 border-foreground px-[18px] py-2.5 font-bold text-foreground">
                  Total général
                </td>
                <td className="border-t-2 border-foreground px-[18px] py-2.5 text-right font-extrabold tabular-nums">
                  {fmt(ecartTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </LedgerSheet>

      <BalanceLigneFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        ligne={editing}
        onSubmit={handleSubmit}
      />

      <ImportBalanceDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        balanceId={balanceId}
        societeId={societeId}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette ligne ?"
        description={
          <>
            Le compte{" "}
            <span className="font-medium text-foreground">{toDelete?.compte}</span> sera
            retiré de la balance.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) removeLigne(balanceId, toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
