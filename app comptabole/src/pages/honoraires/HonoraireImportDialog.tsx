import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseRows, type HonoraireImportLigne } from "@/lib/honoraires/importRows";
import { useHonoraires } from "@/store/honoraires";
import { HONORAIRE_TYPE_LABELS } from "@/types";

type Ligne = HonoraireImportLigne;

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societeId: string;
}

export function HonoraireImportDialog({ open, onOpenChange, societeId }: Props) {
  const importLignes = useHonoraires((s) => s.importLignes);
  const [rows, setRows] = useState<Ligne[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        toast.error(
          "Aucune ligne reconnue — il faut au moins une colonne Montant déclaration, Honoraire ou Règlement.",
        );
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast.error("Fichier illisible — export Excel (.xlsx) ou CSV attendu.");
    }
  }

  function close() {
    setRows(null);
    setFileName("");
    onOpenChange(false);
  }

  async function confirm() {
    if (!rows) return;
    setSaving(true);
    try {
      await importLignes(societeId, rows);
      toast.success(`${rows.length} ligne(s) importée(s)`);
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Importer des lignes depuis un fichier</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : Type, Période, Nature, Libellé, Réf. CNSS, N° Quittance, Montant
            déclaration, Honoraire, Règlement reçu, Note. Le libellé est suggéré s'il est vide.
            S'ajoute aux lignes existantes, ne les remplace pas.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <label className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-12 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              Cliquez pour choisir un fichier de votre ordinateur{" "}
              <span className="font-semibold underline underline-offset-2">.xlsx / .xls / .csv</span>
            </p>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
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
                    <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Libellé</th>
                    <th className="px-2 py-1.5 text-left font-semibold">CNSS</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Quittance</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Déclaration</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Honoraire</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Règlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1">{HONORAIRE_TYPE_LABELS[r.type]}</td>
                      <td className="px-2 py-1">{r.libelle || "—"}</td>
                      <td className="px-2 py-1">{r.cnss || "—"}</td>
                      <td className="px-2 py-1">{r.numQuittance || "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(r.montantDeclaration)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(r.honoraire)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(r.reglement)}</td>
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
              {saving ? "Import…" : `Importer ${rows.length} ligne(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
