import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Download,
  Landmark,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import { useBordereaux, type BordereauInput } from "@/store/bordereaux";
import {
  BORDEREAU_TYPE_LABELS,
  BORDEREAU_VOLET_LABELS,
} from "@/types";
import type { Bordereau, BordereauType } from "@/types";
import { BordereauFormSheet } from "./BordereauFormSheet";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const TYPES = Object.keys(BORDEREAU_TYPE_LABELS) as BordereauType[];

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function BordereauxPage() {
  const list = useBordereaux((s) => s.list);
  const loading = useBordereaux((s) => s.loading);
  const fetchList = useBordereaux((s) => s.fetchList);
  const create = useBordereaux((s) => s.create);
  const update = useBordereaux((s) => s.update);
  const remove = useBordereaux((s) => s.remove);

  const [type, setType] = useState<BordereauType>("remise_cheque");
  const [volet, setVolet] = useState("all");
  const [annee, setAnnee] = useState("all");
  const [pointeFilter, setPointeFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bordereau | null>(null);
  const [toDelete, setToDelete] = useState<Bordereau | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const annees = useMemo(
    () =>
      [
        ...new Set(
          list
            .map((b) => b.dateOperation?.slice(0, 4))
            .filter((y): y is string => Boolean(y)),
        ),
      ].sort((a, b) => b.localeCompare(a)),
    [list],
  );

  const filtered = useMemo(
    () =>
      list.filter((b) => {
        if (b.type !== type) return false;
        if (volet !== "all" && b.volet !== volet) return false;
        if (annee !== "all" && b.dateOperation?.slice(0, 4) !== annee)
          return false;
        if (pointeFilter === "oui" && !b.pointe) return false;
        if (pointeFilter === "non" && b.pointe) return false;
        return true;
      }),
    [list, type, volet, annee, pointeFilter],
  );

  const sousTotal = (b: Bordereau) =>
    b.lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const grandTotal = filtered.reduce((s, b) => s + sousTotal(b), 0);

  function handleSubmit(data: BordereauInput) {
    if (editing) {
      update(editing.id, data);
      toast.success("Bordereau modifié");
    } else {
      create(data);
      toast.success("Bordereau créé");
    }
    setEditing(null);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const t of TYPES) {
      const items = list.filter(
        (b) =>
          b.type === t &&
          (volet === "all" || b.volet === volet) &&
          (annee === "all" || b.dateOperation?.slice(0, 4) === annee),
      );
      if (!items.length) continue;
      const aoa: (string | number)[][] = [
        [
          "N° Bordereau",
          "Date",
          "Volet",
          "N° Ordre",
          "CHQ / Effet",
          "Tiers",
          "Montant",
          "Réf. facture",
          "Remarque",
          "Pointé",
        ],
      ];
      for (const b of items) {
        b.lignes.forEach((l, i) => {
          aoa.push([
            i === 0 ? b.numero : "",
            i === 0 ? (b.dateOperation ?? "") : "",
            i === 0 ? BORDEREAU_VOLET_LABELS[b.volet] : "",
            i + 1,
            l.cheque,
            l.tiers,
            Number(l.montant) || 0,
            l.facture,
            l.remarque,
            i === 0 ? (b.pointe ? "Oui" : "Non") : "",
          ]);
        });
        aoa.push(["", "", "", "", "", "TOTAL", sousTotal(b), "", "", ""]);
        aoa.push([]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
        { wch: 9 },
        { wch: 14 },
        { wch: 28 },
        { wch: 14 },
        { wch: 18 },
        { wch: 12 },
        { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        BORDEREAU_TYPE_LABELS[t].slice(0, 31),
      );
    }
    if (!wb.SheetNames.length) return toast.error("Rien à exporter");
    XLSX.writeFile(wb, "Bordereaux_bancaires.xlsx");
  }

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Bordereaux bancaires"
        description="Registre interne du cabinet — virements, remises de traites et de chèques, par bordereau."
        actions={
          <div className="flex gap-2">
            <Button variant="ledger-text" onClick={exportXlsx}>
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="ledger"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau bordereau
            </Button>
          </div>
        }
      />

      <div className="mt-3">
        <LedgerSegmented
          value={type}
          onChange={setType}
          options={TYPES.map((t) => ({ value: t, label: BORDEREAU_TYPE_LABELS[t] }))}
        />
      </div>

      <div className="my-3 flex flex-wrap items-end gap-3">
        <Select value={volet} onValueChange={setVolet}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Clients + Fournisseurs</SelectItem>
            <SelectItem value="client">Clients (411)</SelectItem>
            <SelectItem value="fournisseur">Fournisseurs (401)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {annees.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pointeFilter} onValueChange={setPointeFilter}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pointés + non</SelectItem>
            <SelectItem value="oui">Pointés</SelectItem>
            <SelectItem value="non">Non pointés</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} bordereau(x) · total{" "}
          <span className="font-bold tabular-nums text-foreground">
            {fmt(grandTotal)}
          </span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <LedgerSheet className="flex-1">
          <EmptyState
            icon={Landmark}
            title={loading ? "Chargement…" : "Aucun bordereau"}
            description="Créez un bordereau : en-tête (n° + date) puis ses lignes."
          />
        </LedgerSheet>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <LedgerSheet key={b.id}>
              <div className="flex flex-wrap items-center gap-3 rounded-t-sm border-b border-border bg-muted px-3 py-2.5 sm:px-4">
                <span className="font-extrabold text-foreground">
                  {b.numero || "—"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {b.dateOperation ? formatDate(b.dateOperation) : "—"}
                </span>
                <span className="rounded-[3px] border border-border px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                  {BORDEREAU_VOLET_LABELS[b.volet]}
                </span>
                <button
                  onClick={() => update(b.id, { pointe: !b.pointe })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"
                  title="Basculer pointé"
                >
                  {b.pointe ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  {b.pointe ? "Pointé" : "Non pointé"}
                </button>
                <span className="ml-auto font-extrabold tabular-nums text-foreground">
                  {fmt(sousTotal(b))}
                </span>
                <button
                  onClick={() => {
                    setEditing(b);
                    setFormOpen(true);
                  }}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setToDelete(b)}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {b.note && (
                <p className="border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
                  {b.note}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-10 border-b border-border px-2 py-1.5 text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        N°
                      </th>
                      <th className="border-b border-border px-2 py-1.5 text-left text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        CHQ / Effet
                      </th>
                      <th className="border-b border-border px-2 py-1.5 text-left text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        {b.volet === "client" ? "Client" : "Fournisseur"}
                      </th>
                      <th className="border-b border-border px-2 py-1.5 text-right text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Montant
                      </th>
                      <th className="border-b border-border px-2 py-1.5 text-left text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Réf. facture
                      </th>
                      <th className="border-b border-border px-2 py-1.5 text-left text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Remarque
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.lignes.map((l, i) => (
                      <tr
                        key={l.id ?? i}
                        className={cn(
                          i === b.lignes.length - 1 ? "" : "border-b border-border",
                        )}
                      >
                        <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{l.cheque || "—"}</td>
                        <td className="px-2 py-1.5">{l.tiers || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {fmt(Number(l.montant) || 0)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                          {l.facture || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {l.remarque || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LedgerSheet>
          ))}
        </div>
      )}

      <BordereauFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        bordereau={editing}
        defaultType={type}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce bordereau ?"
        description={
          <>
            Le bordereau{" "}
            <span className="font-medium text-foreground">
              {toDelete?.numero}
            </span>{" "}
            et ses lignes seront supprimés.
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
