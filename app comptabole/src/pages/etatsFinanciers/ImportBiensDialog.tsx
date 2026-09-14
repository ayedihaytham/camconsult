import { useRef, useState } from "react";
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
import { useImmobilisations, type BulkBienInput } from "@/store/immobilisations";
import { fmt } from "@/lib/etatsFinanciers/postes";
import type { ImmoMasseCategorie } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societeId: string;
}

const HEADER_KEYS: Record<string, keyof BulkBienInput> = {
  categorie: "categorieNom",
  "catégorie": "categorieNom",
  masse: "masse",
  libelle: "libelle",
  "libellé": "libelle",
  "date d'acquisition": "dateAcquisition",
  dateacquisition: "dateAcquisition",
  cout: "coutAcquisition",
  "coût": "coutAcquisition",
  "cout d'acquisition": "coutAcquisition",
  "coût d'acquisition": "coutAcquisition",
  taux: "taux",
};

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function toNum(cell: unknown): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : 0;
  const s = String(cell ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(cell: unknown): string {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  const s = String(cell ?? "").trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd déjà correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

function parseRows(raw: unknown[][]): BulkBienInput[] {
  let headerIdx = -1;
  let colMap: Partial<Record<keyof BulkBienInput, number>> = {};
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i] ?? [];
    const map: Partial<Record<keyof BulkBienInput, number>> = {};
    row.forEach((cell, j) => {
      const key = HEADER_KEYS[normalize(String(cell ?? ""))];
      if (key) map[key] = j;
    });
    if (map.categorieNom !== undefined && map.dateAcquisition !== undefined) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const out: BulkBienInput[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const categorieNom = String(row[colMap.categorieNom!] ?? "").trim();
    const dateAcquisition = toIsoDate(row[colMap.dateAcquisition!]);
    if (!categorieNom || !dateAcquisition) continue;
    const masseRaw = normalize(String(colMap.masse !== undefined ? row[colMap.masse] : ""));
    const masse: ImmoMasseCategorie = masseRaw.startsWith("incorp") ? "incorporelle" : "corporelle";
    out.push({
      categorieNom,
      masse,
      libelle: colMap.libelle !== undefined ? String(row[colMap.libelle] ?? "").trim() : "",
      dateAcquisition,
      coutAcquisition: colMap.coutAcquisition !== undefined ? toNum(row[colMap.coutAcquisition]) : 0,
      taux: colMap.taux !== undefined ? toNum(row[colMap.taux]) : 0,
    });
  }
  return out;
}

export function ImportBiensDialog({ open, onOpenChange, societeId }: Props) {
  const bulkAddBiens = useImmobilisations((s) => s.bulkAddBiens);
  const fetchCategories = useImmobilisations((s) => s.fetchCategories);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BulkBienInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        toast.error("Aucune ligne reconnue — vérifiez les colonnes Catégorie et Date d'acquisition.");
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
      const count = await bulkAddBiens(societeId, rows);
      await fetchCategories();
      toast.success(`${count} bien(s) importé(s)`);
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
          <DialogTitle>Importer des biens</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : Catégorie, Masse (incorporelle/corporelle, utilisé seulement si la
            catégorie n'existe pas encore), Libellé, Date d'acquisition, Coût, Taux. Un nom de
            catégorie déjà connu est réutilisé automatiquement.
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
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {fileName} · <b className="text-foreground">{rows.length}</b> bien(s) reconnu(s)
            </p>
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Catégorie
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Libellé
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Date acq.
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Coût
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Taux
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={(i + 1) % 5 === 0 ? "border-b-[1.5px] border-rule-strong" : "border-b border-border"}
                    >
                      <td className="px-2 py-1.5">{r.categorieNom}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5">{r.libelle}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">{r.dateAcquisition}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.coutAcquisition)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.taux}%</td>
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
              {saving ? "Import en cours…" : `Importer ${rows.length} bien(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
