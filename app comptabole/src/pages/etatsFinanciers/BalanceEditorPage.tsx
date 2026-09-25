import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Download, FileText, Plus, Printer, Trash2, Upload } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocieteById } from "@/store/data";
import { useBalances, type BalanceLigneInput } from "@/store/balances";
import type { BalanceLigne } from "@/types";
import { BalanceLigneFormSheet } from "./BalanceLigneFormSheet";
import { ImportBalanceDialog } from "./ImportBalanceDialog";
import { exportToXlsx, type ExportColumn } from "@/lib/export";
import { printTable, type PrintColumn } from "@/lib/print";
import { FinancialIdentityHeader } from "./FinancialIdentityHeader";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BalanceEditorPage() {
  const { societeId = "", balanceId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const current = useBalances((s) => s.current);
  const loading = useBalances((s) => s.loadingCurrent);
  const currentError = useBalances((s) => s.currentError);
  const fetchOne = useBalances((s) => s.fetchOne);
  const clearCurrent = useBalances((s) => s.clearCurrent);
  const fetchGrille = useBalances((s) => s.fetchGrille);
  const grilleError = useBalances((s) => s.grilleError);
  const addLigne = useBalances((s) => s.addLigne);
  const updateLigne = useBalances((s) => s.updateLigne);
  const removeLigne = useBalances((s) => s.removeLigne);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BalanceLigne | null>(null);
  const [toDelete, setToDelete] = useState<BalanceLigne | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    void fetchOne(balanceId).catch(() => {});
    void fetchGrille(societeId).catch(() => {});
    return () => clearCurrent();
  }, [balanceId, societeId, fetchOne, fetchGrille, clearCurrent]);

  const lignes = current?.lignes ?? [];

  const ecartTotal = useMemo(
    () => Math.round(lignes.reduce((s, l) => s + l.solde, 0) * 1000) / 1000,
    [lignes],
  );
  const sansCode = lignes.filter((l) => !l.affectat).length;

  async function handleSubmit(data: BalanceLigneInput) {
    if (editing) {
      await updateLigne(balanceId, editing.id, data);
      toast.success("Ligne modifiée");
    } else {
      await addLigne(balanceId, data);
      toast.success("Ligne ajoutée");
    }
    setEditing(null);
  }

  const exportColumns: ExportColumn<BalanceLigne>[] = [
    { header: "Compte", value: (l) => l.compte },
    { header: "Libellé", value: (l) => l.libelle },
    { header: "Débit", value: (l) => l.debit || "" },
    { header: "Crédit", value: (l) => l.credit || "" },
    { header: "Solde", value: (l) => l.solde },
    { header: "Affectat", value: (l) => l.affectat || "" },
  ];

  const printColumns: PrintColumn<BalanceLigne>[] = [
    { header: "Compte", value: (l) => l.compte },
    { header: "Libellé", value: (l) => l.libelle },
    { header: "Débit", value: (l) => (l.debit ? fmt(l.debit) : ""), align: "right" },
    { header: "Crédit", value: (l) => (l.credit ? fmt(l.credit) : ""), align: "right" },
    { header: "Solde", value: (l) => fmt(l.solde), align: "right" },
    { header: "Affectat", value: (l) => l.affectat || "" },
  ];

  const balanceLabel = `Balance ${current?.exercice ?? ""} — ${societe?.raisonSociale ?? "Société"}`;
  const balanceFilename = balanceLabel.replace(/[\\/:*?"<>|]/g, "").trim();

  function handleExportExcel() {
    void exportToXlsx(balanceFilename, lignes, exportColumns, "Balance");
  }

  async function handleSavePdf() {
    const tri = [...lignes].sort((a, b) => a.compte.localeCompare(b.compte));
    const somme = (k: "debit" | "credit" | "solde") =>
      Math.round(tri.reduce((s, l) => s + (l[k] || 0), 0) * 1000) / 1000;
    try {
      const { downloadTablesPdf } = await import("@/lib/pdfTables");
      await downloadTablesPdf({
        title: `BALANCE ${current?.exercice ?? ""}`.trim(),
        subtitle: `${societe?.raisonSociale ?? "Société"} · ${tri.length} comptes · Écart : ${fmt(ecartTotal)}`,
        sheets: [
          {
            name: "Balance",
            headerRow: true,
            rows: [
              ["Compte", "Libellé", "Débit", "Crédit", "Solde", "Affectat"],
              ...tri.map((l) => [l.compte, l.libelle, l.debit || "", l.credit || "", l.solde, l.affectat || ""]),
              ["TOTAL", "", somme("debit"), somme("credit"), somme("solde"), ""],
            ],
          },
        ],
        fileName: balanceFilename,
      });
    } catch {
      toast.error("PDF impossible");
    }
  }

  function handlePrint() {
    printTable({
      title: balanceLabel,
      subtitle: `Écart : ${fmt(ecartTotal)}`,
      columns: printColumns,
      rows: lignes,
    });
  }

  const columns: DataTableColumn<BalanceLigne>[] = [
    {
      id: "compte",
      header: "Compte",
      headerClassName: "sticky left-0 z-30 min-w-[112px] bg-secondary",
      className: "sticky left-0 z-20 min-w-[112px] bg-card group-hover:bg-card",
      sortable: true,
      sortAccessor: (l) => l.compte,
      cell: (l) => <span className="font-mono text-xs">{l.compte}</span>,
    },
    {
      id: "libelle",
      header: "Libellé",
      headerClassName: "sticky left-[112px] z-30 min-w-[220px] bg-secondary",
      className: "sticky left-[112px] z-20 min-w-[220px] bg-card group-hover:bg-card",
      sortable: true,
      sortAccessor: (l) => l.libelle.toLowerCase(),
      cell: (l) => <span className="text-foreground">{l.libelle || "—"}</span>,
    },
    {
      id: "debit",
      header: "Débit",
      align: "right",
      headerClassName: "min-w-[132px]",
      className: "min-w-[132px]",
      cell: (l) => <span className="tabular-nums">{l.debit ? fmt(l.debit) : ""}</span>,
    },
    {
      id: "credit",
      header: "Crédit",
      align: "right",
      headerClassName: "min-w-[132px]",
      className: "min-w-[132px]",
      cell: (l) => <span className="tabular-nums">{l.credit ? fmt(l.credit) : ""}</span>,
    },
    {
      id: "solde",
      header: "Solde",
      align: "right",
      headerClassName: "min-w-[132px]",
      className: "min-w-[132px]",
      cell: (l) => <span className="font-bold tabular-nums">{fmt(l.solde)}</span>,
    },
    {
      id: "affectat",
      header: "Affectat",
      sortable: true,
      headerClassName: "min-w-[100px]",
      className: "min-w-[100px]",
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
      className: "min-w-[56px]",
      cell: (l) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setToDelete(l);
          }}
          aria-label={`Supprimer la ligne de compte ${l.compte}`}
          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleSavePdf()} disabled={!current || lignes.length === 0}>
              <FileText className="h-4 w-4" />
              Enregistrer PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!current || lignes.length === 0}>
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!current || lignes.length === 0}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="ledger-text" size="sm" disabled={!current} onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Importer une balance
            </Button>
            <Button
              variant="ledger"
              size="sm"
              disabled={!current}
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

      <div className="mt-2">
        <FinancialIdentityHeader
          eyebrow="Balance · Dossier financier"
          title={current ? `Exercice ${current.exercice}` : "Balance"}
          description={societe?.raisonSociale ?? "Dossier société"}
          monogram={societe?.raisonSociale?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "S"}
          details={[
            { label: "Code", value: societe?.code || "—" },
            { label: "RNE", value: societe?.rne || "Non renseigné" },
          ]}
        />
      </div>

      {grilleError && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs">
          <p role="alert" className="text-foreground">La grille AFFECTAT n’a pas pu être chargée; les suggestions de code à l’import peuvent être indisponibles.</p>
          <Button variant="outline" size="sm" onClick={() => void fetchGrille(societeId).catch(() => {})}>Réessayer</Button>
        </div>
      )}

      {current && !currentError && !loading && (
        <dl className="mt-3 grid grid-cols-1 divide-y divide-border border-y border-border bg-muted/35 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Écart de la balance <span className="text-muted-foreground/70">(cible : 0)</span></dt>
            <dd className={`font-mono text-sm font-semibold tabular-nums ${Math.abs(ecartTotal) > 0.01 ? "text-warning" : "text-foreground"}`}>{fmt(ecartTotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Nombre de comptes</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{lignes.length}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Sans code AFFECTAT</dt>
            <dd className={`font-mono text-sm font-semibold tabular-nums ${sansCode > 0 ? "text-warning" : "text-foreground"}`}>{sansCode}</dd>
          </div>
        </dl>
      )}

      {loading ? (
        <div aria-label="Chargement de la balance" className="mt-3 space-y-2 border-y border-border py-3">
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-7 w-full" />)}
        </div>
      ) : currentError ? (
        <div className="mt-3 border-y border-border px-3 py-4">
          <EmptyState
            icon={Calculator}
            title="Balance indisponible"
            description={currentError}
            action={<Button variant="outline" size="sm" onClick={() => void fetchOne(balanceId).catch(() => {})}>Réessayer</Button>}
          />
        </div>
      ) : lignes.length === 0 ? (
        <div className="mt-3 border-y border-border px-3 py-3">
          <EmptyState
            icon={Calculator}
            title="Balance vide"
            description="Importez un fichier Excel/CSV ou ajoutez les lignes une à une."
          />
        </div>
      ) : (
        <div className="mt-3 min-w-0 overflow-hidden border-y border-border bg-background">
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
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-border py-2.5">
        <p className="text-xs text-muted-foreground">
          La synthèse par code AFFECTAT est disponible dans l’espace du dossier.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/etats-financiers/${societeId}`)}>
          Voir la synthèse AFFECTAT
        </Button>
      </div>

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
        onConfirm={async () => {
          if (toDelete) await removeLigne(balanceId, toDelete.id);
        }}
      />
    </div>
  );
}
