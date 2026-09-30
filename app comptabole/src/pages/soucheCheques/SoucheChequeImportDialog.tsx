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
import { parseRows } from "@/lib/soucheCheques/importRows";
import { fmtDate, fmtMontant } from "@/lib/soucheCheques/model";
import { useSoucheCheques, type SoucheChequeInput } from "@/store/soucheCheques";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societeId: string;
}

export function SoucheChequeImportDialog({ open, onOpenChange, societeId }: Props) {
  const importLignes = useSoucheCheques((s) => s.importLignes);
  const [rows, setRows] = useState<SoucheChequeInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      // cellDates : les dates Excel arrivent en Date (et non en numéro de série)
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        toast.error("Aucun chèque reconnu — il faut au moins une colonne « N° de Chèque ».");
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
      const { importes, ignores } = await importLignes(societeId, rows);
      toast.success(
        ignores > 0
          ? `${importes} chèque(s) importé(s) — ${ignores} déjà existant(s) ignoré(s)`
          : `${importes} chèque(s) importé(s)`,
      );
      close();
    } catch {
      // erreur déjà affichée par le store
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Importer des chèques depuis un fichier</DialogTitle>
          <DialogDescription>
            Modèle du cabinet : Banque, N° de Chèque, Date d'Émission, Bénéficiaire, Motif /
            Description, Montant, Statut Débité (Oui/Non), Date de Débit (+ Devise facultative,
            TND par défaut). S'ajoute aux chèques existants ; un n° déjà présent pour la même
            banque est ignoré.
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
              <span className="font-semibold">{fileName}</span> — {rows.length} chèque(s) reconnu(s)
            </p>
            <div className="flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">Banque</th>
                    <th className="px-2 py-1.5 text-left font-semibold">N°</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Émission</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Bénéficiaire</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Motif</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Montant</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Débité</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Date de débit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1">{r.banque || "—"}</td>
                      <td className="px-2 py-1 font-mono">{r.numCheque || "—"}</td>
                      <td className="px-2 py-1">{fmtDate(r.dateEmission) || "—"}</td>
                      <td className="px-2 py-1">{r.beneficiaire || "—"}</td>
                      <td className="px-2 py-1">{r.motif || "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {fmtMontant(r.montant)} {r.devise}
                      </td>
                      <td className="px-2 py-1">{r.debite ? "Oui" : "Non"}</td>
                      <td className="px-2 py-1">{fmtDate(r.dateDebit) || "—"}</td>
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
              {saving ? "Import…" : `Importer ${rows.length} chèque(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
