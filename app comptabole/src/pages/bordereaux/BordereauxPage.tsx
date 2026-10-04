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
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
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
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const TYPES = Object.keys(BORDEREAU_TYPE_LABELS) as BordereauType[];

const selectTriggerClass =
  "h-11 w-auto min-w-[10rem] gap-2 rounded-lg border border-accent/35 bg-card px-4 text-base text-primary shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

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

  const nbPointes = filtered.filter((b) => b.pointe).length;
  const compteParType = (t: BordereauType) => list.filter((b) => b.type === t).length;

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={Landmark}
        eyebrow="Comptabilité · Banque"
        title="Bordereaux bancaires"
        description="Virements, remises de traites et remises de chèques."
        metrics={[
          { label: filtered.length > 1 ? "Bordereaux" : "Bordereau", value: filtered.length, loading },
          { label: "Total", value: fmt(grandTotal), loading },
          { label: filtered.length > 1 ? "Pointés" : "Pointé", value: nbPointes, tone: "default", loading },
          { label: "Non pointé", value: filtered.length - nbPointes, loading },
        ]}
        actions={
          <div data-tour="bordereaux-actions" className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="signature-ledger__action" onClick={exportXlsx}>
              <Download className="h-4 w-4" />
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

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card">
        <div
          data-tour="bordereaux-filters"
          role="group"
          aria-label="Type de bordereau"
          className="flex min-w-0 gap-8 overflow-x-auto border-b border-accent/25 px-6"
        >
          {TYPES.map((t) => {
            const active = type === t;
            const n = compteParType(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setType(t)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 py-4 text-base transition-colors",
                  active
                    ? "border-accent font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary",
                )}
              >
                {BORDEREAU_TYPE_LABELS[t]}
                {n > 0 && (
                  <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold leading-6 text-accent-foreground">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-5">
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
          <span className="ml-auto text-base text-muted-foreground">
            {filtered.length} bordereau{filtered.length > 1 ? "x" : ""} · total{" "}
            <span className="font-bold tabular-nums text-primary">{fmt(grandTotal)}</span>
          </span>
        </div>

        <div data-tour="bordereaux-register" className="px-6 pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/40 px-4 py-12 text-center">
              <span className="grid size-[60px] place-items-center rounded-full bg-accent/15 text-primary">
                <Landmark className="size-6" aria-hidden="true" />
              </span>
              <p className="font-serif text-2xl font-medium text-primary">
                {loading ? "Chargement…" : "Aucun bordereau"}
              </p>
              <p className="max-w-md text-base text-muted-foreground">
                Créez un bordereau : en-tête (n° + date) puis ses lignes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((b) => (
                <article key={b.id} className="overflow-hidden rounded-xl border border-accent/30 bg-card">
                  <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-accent/25 bg-accent/[0.07] px-5 py-4">
                    <span className="text-base text-muted-foreground">
                      N° <span className="font-semibold text-primary">{b.numero || "—"}</span>
                    </span>
                    <span className="text-base text-muted-foreground">
                      {b.dateOperation ? formatDate(b.dateOperation) : "—"}
                    </span>
                    <span className="rounded-md border border-accent/35 bg-card px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                      {BORDEREAU_VOLET_LABELS[b.volet]}
                    </span>
                    <button
                      type="button"
                      onClick={() => update(b.id, { pointe: !b.pointe })}
                      className="inline-flex items-center gap-2 text-base font-medium text-primary"
                      title="Basculer pointé"
                    >
                      {b.pointe ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      {b.pointe ? "Pointé" : "Non pointé"}
                    </button>
                    <span className="ml-auto font-serif text-3xl font-medium tabular-nums text-primary">
                      {fmt(sousTotal(b))}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(b);
                        setFormOpen(true);
                      }}
                      className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      aria-label="Modifier ce bordereau"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(b)}
                      className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Supprimer ce bordereau"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </header>
                  {b.note && (
                    <p className="border-b border-accent/25 px-5 py-2 text-sm text-muted-foreground">{b.note}</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-base">
                      <thead>
                        <tr className="border-b border-accent/25 text-sm font-semibold text-muted-foreground">
                          <th className="w-14 px-5 py-3 text-left">N°</th>
                          <th className="px-3 py-3 text-left">CHQ / Effet</th>
                          <th className="px-3 py-3 text-left">{b.volet === "client" ? "Client" : "Fournisseur"}</th>
                          <th className="px-3 py-3 text-right">Montant</th>
                          <th className="px-3 py-3 text-left">Réf. facture</th>
                          <th className="px-3 py-3 text-left">Remarque</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.lignes.map((l, i) => (
                          <tr
                            key={l.id ?? i}
                            className={cn(i === b.lignes.length - 1 ? "" : "border-b border-accent/20")}
                          >
                            <td className="px-5 py-3.5 font-serif text-xl text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-3.5 font-mono text-sm">{l.cheque || "—"}</td>
                            <td className="px-3 py-3.5 text-primary">{l.tiers || "—"}</td>
                            <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-primary">
                              {fmt(Number(l.montant) || 0)}
                            </td>
                            <td className="px-3 py-3.5 font-mono text-sm text-muted-foreground">{l.facture || "—"}</td>
                            <td className="px-3 py-3.5 text-muted-foreground">{l.remarque || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

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
