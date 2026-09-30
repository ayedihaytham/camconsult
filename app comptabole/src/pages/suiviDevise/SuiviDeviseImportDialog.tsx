import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSuiviDevise, type FactureInput } from "@/store/suiviDevise";
import type { SuiviDeviseLot } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suiviId: string;
  lots: SuiviDeviseLot[];
}

const HEADER_KEYS: Record<string, keyof FactureInput> = {
  nfacture: "nFacture",
  numerofacture: "nFacture",
  facture: "nFacture",
  nsecondaire: "nSecondaire",
  numerosecondaire: "nSecondaire",
  datefacture: "dateFacture",
  date: "dateFacture",
  modepaiement: "modePaiement",
  modedepaiement: "modePaiement",
  designation: "designationProduit",
  designationproduit: "designationProduit",
  produit: "designationProduit",
  fournisseur: "fournisseur",
  fournisseurs: "fournisseur",
  qtt: "qteTonnes",
  qte: "qteTonnes",
  qtet: "qteTonnes",
  quantite: "qteTonnes",
  pu: "pu",
  prixunitaire: "pu",
  montant: "montantTotal",
  montanttotal: "montantTotal",
  lot: "lotId",
};

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function toNum(cell: unknown): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : 0;
  const s = String(cell ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toDateStr(v: unknown): string | null {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Cherche la ligne d'en-tête dans les 10 premières lignes du fichier
 * (Montant est la seule colonne vraiment obligatoire pour la reconnaître). */
function parseRows(raw: unknown[][], lots: SuiviDeviseLot[]): FactureInput[] {
  let headerIdx = -1;
  let colMap: Partial<Record<keyof FactureInput, number>> = {};
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i] ?? [];
    const map: Partial<Record<keyof FactureInput, number>> = {};
    row.forEach((cell, j) => {
      const key = HEADER_KEYS[normalize(String(cell ?? ""))];
      if (key) map[key] = j;
    });
    if (map.montantTotal !== undefined) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const lotByName = new Map(lots.map((l) => [normalize(l.libelle), l.id]));
  const cellAt = (row: unknown[], key: keyof FactureInput) =>
    colMap[key] !== undefined ? row[colMap[key] as number] : undefined;

  const out: FactureInput[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const nFacture = String(cellAt(row, "nFacture") ?? "").trim();
    const qteTonnes = toNum(cellAt(row, "qteTonnes"));
    const pu = toNum(cellAt(row, "pu"));
    // Une vraie facture a un numéro ou une quantité — écarte les lignes vides,
    // les lignes « TOTAL » (montant seul) et les notes de bas de tableau.
    if (!nFacture && !qteTonnes) continue;
    // Montant = formule sans valeur en cache (fichier jamais rouvert dans
    // Excel) : retombe sur Qté × PU plutôt que d'importer 0.
    const montantLu = toNum(cellAt(row, "montantTotal"));
    const montantTotal = montantLu || Math.round(qteTonnes * pu * 1000) / 1000;
    const lotLabel = String(cellAt(row, "lotId") ?? "").trim();
    out.push({
      lotId: lotLabel ? (lotByName.get(normalize(lotLabel)) ?? null) : null,
      nFacture,
      nSecondaire: String(cellAt(row, "nSecondaire") ?? "").trim(),
      dateFacture: toDateStr(cellAt(row, "dateFacture")),
      modePaiement: String(cellAt(row, "modePaiement") ?? "").trim(),
      designationProduit: String(cellAt(row, "designationProduit") ?? "").trim(),
      fournisseur: String(cellAt(row, "fournisseur") ?? "").trim(),
      qteTonnes,
      pu,
      montantTotal,
      avoirMontant: null,
      avoirDate: null,
    });
  }
  return out;
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function SuiviDeviseImportDialog({ open, onOpenChange, suiviId, lots }: Props) {
  const importFactures = useSuiviDevise((s) => s.importFactures);

  const [rows, setRows] = useState<FactureInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      const parsed = parseRows(raw, lots);
      if (parsed.length === 0) {
        toast.error("Aucune ligne reconnue — vérifiez qu'une colonne « Montant » existe.");
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast.error("Fichier illisible — export Excel (.xlsx) ou CSV attendu.");
    }
  }

  async function confirm() {
    if (!rows) return;
    setSaving(true);
    try {
      await importFactures(suiviId, rows);
      toast.success(`${rows.length} facture(s) importée(s)`);
      close();
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setRows(null);
    setFileName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Importer des factures</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : N° facture, N° secondaire, Date facture, Mode de paiement,
            Désignation, Fournisseur, Qté (T), PU, Montant, Lot (si le nom correspond à un lot
            déjà créé sur cette fiche). S'ajoute aux factures existantes, ne les remplace pas.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <label className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-12 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              Cliquez pour choisir un fichier{" "}
              <span className="font-semibold underline underline-offset-2">.xlsx / .csv</span>
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        ) : (
          <>
            <p className="text-sm text-foreground">
              <span className="font-semibold">{fileName}</span> — {rows.length} ligne(s) reconnue(s)
            </p>
            <div className="flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">N° facture</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Date</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Désignation</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Fournisseur</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Lot</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Qté</th>
                    <th className="px-2 py-1.5 text-right font-semibold">PU</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1">{r.nFacture || "—"}</td>
                      <td className="px-2 py-1">{r.dateFacture ?? "—"}</td>
                      <td className="px-2 py-1">{r.designationProduit || "—"}</td>
                      <td className="px-2 py-1">{r.fournisseur || "—"}</td>
                      <td className="px-2 py-1">
                        {r.lotId ? lots.find((l) => l.id === r.lotId)?.libelle : "—"}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(r.qteTonnes)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(r.pu)}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.montantTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          {rows && (
            <Button variant="ledger" disabled={saving} onClick={confirm}>
              {saving ? "Import…" : `Importer ${rows.length} facture(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
