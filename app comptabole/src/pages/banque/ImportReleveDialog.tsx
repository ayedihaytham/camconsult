import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtMontant } from "@/lib/stockRecap";
import { formatDate } from "@/lib/utils";
import { lignesVersMouvements, TYPE_LABELS, type MouvementImport } from "@/lib/banque";
import { extraireMouvements, lireFichierPdf, nombreDeCaracteres } from "@/lib/pdfToTables";

interface Releve {
  nom: string;
  mouvements: MouvementImport[];
  ignorees: number;
  soldeOuverture: { date: string; montant: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  devise: string;
  /** Le compte n'a encore aucun mouvement : le solde d'ouverture du relevé peut devenir son solde de départ. */
  proposerSoldeDepart: boolean;
  onImport: (mouvements: MouvementImport[], soldeOuverture: { date: string; montant: number } | null) => Promise<void>;
}

/** Lit un relevé PDF (texte) ou un classeur Excel du cabinet et renvoie ses mouvements. */
async function lireReleve(file: File): Promise<Releve> {
  const nom = file.name;
  if (/\.pdf$/i.test(nom)) {
    const pages = await lireFichierPdf(file);
    if (nombreDeCaracteres(pages) === 0) throw new Error("PDF scanné (image) : il ne contient pas de texte à lire.");
    const tableau = extraireMouvements(pages);
    const r = tableau && lignesVersMouvements(tableau);
    if (!r) throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Libellé / Débit / Crédit).");
    return { nom, ...r };
  }
  const XLSX = await import("xlsx");
  const classeur = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  for (const feuille of classeur.SheetNames) {
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(classeur.Sheets[feuille], { header: 1, raw: true, defval: null });
    const r = lignesVersMouvements(lignes);
    if (r && r.mouvements.length > 0) return { nom, ...r };
  }
  throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Description / Débit / Crédit).");
}

export function ImportReleveDialog({ open, onOpenChange, devise, proposerSoldeDepart, onImport }: Props) {
  const [releve, setReleve] = useState<Releve | null>(null);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avecSolde, setAvecSolde] = useState(true);

  useEffect(() => {
    if (open) return;
    setReleve(null);
    setErreur("");
    setAvecSolde(true);
  }, [open]);

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLecture(true);
    setErreur("");
    setReleve(null);
    try {
      setReleve(await lireReleve(file));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  }

  const debit = releve ? Math.round(releve.mouvements.reduce((s, m) => s + m.debit, 0) * 1000) / 1000 : 0;
  const credit = releve ? Math.round(releve.mouvements.reduce((s, m) => s + m.credit, 0) * 1000) / 1000 : 0;
  const proposerSolde = proposerSoldeDepart && releve?.soldeOuverture;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importer un relevé</DialogTitle>
          <DialogDescription>
            Relevé de la banque en PDF (avec du texte) ou classeur Excel. Les opérations déjà présentes ne sont pas recréées.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-input px-4 py-8 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {lecture ? "Lecture en cours…" : releve ? `${releve.nom} — choisir un autre fichier` : "Cliquez pour choisir un fichier .pdf, .xlsx ou .xls"}
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={lecture}
            className="hidden"
            onChange={choisir}
          />
        </label>

        {erreur && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

        {releve && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{releve.mouvements.length}</strong> mouvement{releve.mouvements.length > 1 ? "s" : ""} lu{releve.mouvements.length > 1 ? "s" : ""} — débit{" "}
              <span className="tabular-nums">{fmtMontant(debit)}</span>, crédit <span className="tabular-nums">{fmtMontant(credit)}</span> {devise}
              {releve.ignorees > 0 && <span className="text-muted-foreground"> · {releve.ignorees} ligne{releve.ignorees > 1 ? "s" : ""} ignorée{releve.ignorees > 1 ? "s" : ""} (totaux, lignes vides)</span>}
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-secondary text-left">
                  <tr>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Description</th>
                    <th className="px-2 py-1.5">Type</th>
                    <th className="px-2 py-1.5 text-right">Débit</th>
                    <th className="px-2 py-1.5 text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {releve.mouvements.map((m, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="whitespace-nowrap px-2 py-1">{formatDate(m.dateOp)}</td>
                      <td className="px-2 py-1">{m.libelle}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{TYPE_LABELS[m.type]}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.debit ? fmtMontant(m.debit) : ""}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.credit ? fmtMontant(m.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {proposerSolde && releve.soldeOuverture && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={avecSolde} onChange={(e) => setAvecSolde(e.target.checked)} />
                Prendre « Solde au {formatDate(releve.soldeOuverture.date)} : {fmtMontant(releve.soldeOuverture.montant)} {devise} » comme solde de départ du compte
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={saving || !releve || releve.mouvements.length === 0}
            onClick={async () => {
              if (!releve) return;
              setSaving(true);
              try {
                await onImport(releve.mouvements, proposerSolde && avecSolde ? releve.soldeOuverture : null);
                onOpenChange(false);
              } catch {
                // erreur déjà affichée par le store
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Import…" : `Importer ${releve?.mouvements.length ?? 0} mouvement${(releve?.mouvements.length ?? 0) > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
