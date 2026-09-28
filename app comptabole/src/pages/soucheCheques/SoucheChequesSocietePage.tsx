import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookText,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerKpiRow } from "@/components/ledger/LedgerKpiRow";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportSoucheChequesStyled } from "@/lib/soucheCheques/exportStyled";
import { fmtDate, fmtMontant, totauxParDevise } from "@/lib/soucheCheques/model";
import { buildSouchePdf } from "@/lib/soucheCheques/pdf";
import { cn } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useSoucheCheques, type SoucheChequeInput } from "@/store/soucheCheques";
import type { SoucheCheque } from "@/types";
import { SoucheChequeFormSheet } from "./SoucheChequeFormSheet";
import { SoucheChequeImportDialog } from "./SoucheChequeImportDialog";

type Vue = "tous" | "a_debiter" | "debites";

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const TH = "border-b-2 border-foreground px-2 py-2 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground";

export function SoucheChequesSocietePage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);
  const societeNom = societe?.raisonSociale ?? "Société";

  const list = useSoucheCheques((s) => s.list);
  const loading = useSoucheCheques((s) => s.loading);
  const fetchList = useSoucheCheques((s) => s.fetchList);
  const clear = useSoucheCheques((s) => s.clear);
  const create = useSoucheCheques((s) => s.create);
  const update = useSoucheCheques((s) => s.update);
  const remove = useSoucheCheques((s) => s.remove);

  const [vue, setVue] = useState<Vue>("tous");
  const [recherche, setRecherche] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<SoucheCheque | null>(null);
  const [toDelete, setToDelete] = useState<SoucheCheque | null>(null);
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    fetchList(societeId).catch(() => {});
    return () => clear();
  }, [societeId, fetchList, clear]);

  const totaux = useMemo(() => totauxParDevise(list), [list]);
  const banques = useMemo(
    () => [...new Set(list.map((l) => l.banque).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [list],
  );
  const nbADebiter = list.filter((l) => !l.debite).length;

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return list.filter((l) => {
      if (vue === "a_debiter" && l.debite) return false;
      if (vue === "debites" && !l.debite) return false;
      if (!q) return true;
      return [l.banque, l.numCheque, l.beneficiaire, l.motif].some((t) => t.toLowerCase().includes(q));
    });
  }, [list, vue, recherche]);

  async function exportPdf() {
    setBusy("pdf");
    try {
      // On exporte ce qui est affiché (filtres compris) : totaux cohérents avec le tableau.
      const { doc, fileName } = await buildSouchePdf(visibles, societeNom);
      doc.save(fileName);
    } catch {
      toast.error("PDF impossible");
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    setBusy("xlsx");
    try {
      await exportSoucheChequesStyled(visibles, societeNom);
    } catch {
      toast.error("Export Excel impossible");
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(data: SoucheChequeInput) {
    if (editing) {
      await update(editing.id, data);
      toast.success("Chèque modifié");
    } else {
      await create(societeId, data);
      toast.success("Chèque ajouté");
    }
    setEditing(null);
  }

  async function marquerDebite(l: SoucheCheque) {
    try {
      await update(l.id, {
        banque: l.banque,
        numCheque: l.numCheque,
        dateEmission: l.dateEmission,
        beneficiaire: l.beneficiaire,
        motif: l.motif,
        montant: l.montant,
        devise: l.devise,
        debite: true,
        dateDebit: todayIso(),
      });
      toast.success(`Chèque ${l.numCheque} marqué débité`);
    } catch {
      // erreur déjà affichée par le store
    }
  }

  return (
    <div>
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate("/souche-cheques")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Toutes les sociétés
          </button>
        }
        title={`Souche de chèques — ${societeNom}`}
        description="Chèques émis, montants et statut de débit. Les totaux sont calculés par devise (TND, EUR, USD) sans jamais les mélanger."
        actions={
          <>
            <Button variant="outline" onClick={exportExcel} disabled={busy !== null || list.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              {busy === "xlsx" ? "Excel…" : "Exporter Excel"}
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={busy !== null || list.length === 0}>
              <FileText className="h-4 w-4" />
              {busy === "pdf" ? "PDF…" : "Enregistrer PDF"}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importer un fichier
            </Button>
            <Button
              variant="ledger"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau chèque
            </Button>
          </>
        }
      />

      {totaux.length > 0 && (
        <LedgerSheet className="mt-4">
          {totaux.map((t, i) => (
            <LedgerKpiRow
              key={t.devise}
              hero={i === 0}
              danger={t.restant > 0.0005}
              label={`Reste à débiter (${t.devise})`}
              value={`${fmtMontant(t.restant)} ${t.devise}`}
              hint={`${t.nb} chèque(s) · émis ${fmtMontant(t.emis)} · débité ${fmtMontant(t.debite)} (${t.nbDebites})`}
            />
          ))}
        </LedgerSheet>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <LedgerSegmented<Vue>
          value={vue}
          onChange={setVue}
          ariaLabel="Filtrer par statut"
          options={[
            { value: "tous", label: `Tous (${list.length})` },
            { value: "a_debiter", label: `À débiter (${nbADebiter})` },
            { value: "debites", label: `Débités (${list.length - nbADebiter})` },
          ]}
        />
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (n°, bénéficiaire, banque, motif)…"
          className="h-9 w-full sm:w-72"
        />
      </div>

      {visibles.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={BookText}
            title={loading ? "Chargement…" : list.length === 0 ? "Aucun chèque" : "Aucun résultat"}
            description={
              list.length === 0
                ? "Ajoutez un chèque ou importez le modèle Excel de la souche de chèques."
                : "Aucun chèque ne correspond à ce filtre."
            }
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={cn(TH, "text-left")}>Banque</th>
                  <th className={cn(TH, "text-left")}>N° chèque</th>
                  <th className={cn(TH, "text-left")}>Émission</th>
                  <th className={cn(TH, "text-left")}>Bénéficiaire</th>
                  <th className={cn(TH, "text-left")}>Motif / Description</th>
                  <th className={cn(TH, "text-right")}>Montant</th>
                  <th className={cn(TH, "text-left")}>Débité</th>
                  <th className={cn(TH, "text-left")}>Date de débit</th>
                  <th className={cn(TH, "w-[1%]")} />
                </tr>
              </thead>
              <tbody>
                {visibles.map((l, i) => (
                  <tr
                    key={l.id}
                    className={cn(
                      (i + 1) % 5 === 0 ? "border-b-[1.5px] border-rule-strong" : "border-b border-border",
                      "hover:bg-primary/[0.03]",
                    )}
                  >
                    <td className="px-2 py-2 text-foreground">{l.banque || "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs">{l.numCheque || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                      {fmtDate(l.dateEmission) || "—"}
                    </td>
                    <td className="px-2 py-2 text-foreground">{l.beneficiaire || "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{l.motif || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">
                      {fmtMontant(l.montant)} <span className="text-xs font-normal text-muted-foreground">{l.devise}</span>
                    </td>
                    <td className="px-2 py-2">
                      {l.debite ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Oui
                        </span>
                      ) : (
                        <button
                          title="Marquer comme débité aujourd'hui"
                          onClick={() => marquerDebite(l)}
                          className="inline-flex items-center gap-1 rounded-[5px] border border-border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-success hover:text-success"
                        >
                          Non · marquer débité
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                      {fmtDate(l.dateDebit) || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-0.5">
                        <button
                          aria-label="Modifier"
                          onClick={() => {
                            setEditing(l);
                            setFormOpen(true);
                          }}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Supprimer"
                          onClick={() => setToDelete(l)}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LedgerSheet>
      )}

      <SoucheChequeImportDialog open={importOpen} onOpenChange={setImportOpen} societeId={societeId} />

      <SoucheChequeFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        ligne={editing}
        banques={banques}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce chèque ?"
        description={
          toDelete
            ? `Le chèque n° ${toDelete.numCheque || "—"} (${toDelete.beneficiaire || "sans bénéficiaire"}) sera définitivement supprimé de la souche.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id).catch(() => {});
          setToDelete(null);
        }}
      />
    </div>
  );
}
