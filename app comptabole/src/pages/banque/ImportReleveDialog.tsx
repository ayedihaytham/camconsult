import { useEffect, useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtMontant } from "@/lib/stockRecap";
import { formatDate } from "@/lib/utils";
import { TYPE_LABELS, type MouvementImport } from "@/lib/banque";
import {
  lireClasseurBancaire,
  lignesVersMouvements,
  type EcartSociete,
  type ResumeFeuille,
  type SoldeDate,
} from "@/lib/banqueClasseur";
import { lireClasseurExcel } from "@/lib/classeurExcel";
import { extraireMouvements, lireFichierPdf, nombreDeCaracteres } from "@/lib/pdfToTables";

interface Releve {
  nom: string;
  mouvements: MouvementImport[];
  ignorees: number;
  ouverture: SoldeDate | null;
  soldeReel: SoldeDate | null;
  feuilles: ResumeFeuille[];
  feuillesIgnorees: string[];
  avertissements: string[];
  ecartsSociete: EcartSociete[];
}

/** Ce que l'import peut aussi mettre à jour sur le compte : solde de départ et solde réel du relevé. */
export interface MiseAJourCompte {
  ouverture: SoldeDate | null;
  soldeReel: SoldeDate | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  devise: string;
  /** Le compte n'a encore aucun mouvement : le solde d'ouverture du relevé peut devenir son solde de départ. */
  proposerSoldeDepart: boolean;
  onImport: (mouvements: MouvementImport[], maj: MiseAJourCompte) => Promise<void>;
}

/** Lit un relevé PDF (texte) ou un classeur Excel du cabinet (une feuille par mois) et renvoie ses mouvements. */
async function lireReleve(file: File): Promise<Releve> {
  const nom = file.name;
  if (/\.pdf$/i.test(nom)) {
    const pages = await lireFichierPdf(file);
    if (nombreDeCaracteres(pages) === 0) throw new Error("PDF scanné (image) : il ne contient pas de texte à lire.");
    const tableau = extraireMouvements(pages);
    const r = tableau && lignesVersMouvements(tableau);
    if (!r) throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Libellé / Débit / Crédit).");
    return {
      nom,
      mouvements: r.mouvements,
      ignorees: r.ignorees,
      ouverture: r.soldeOuverture,
      soldeReel: null,
      feuilles: [],
      feuillesIgnorees: [],
      avertissements: [],
      ecartsSociete: [],
    };
  }
  const feuilles = await lireClasseurExcel(file);
  const lu = lireClasseurBancaire(feuilles);
  if (lu.mouvements.length === 0) throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Description / Débit / Crédit).");
  return { nom, ...lu };
}

const nombre = (n: number) => fmtMontant(n);

export function ImportReleveDialog({ open, onOpenChange, devise, proposerSoldeDepart, onImport }: Props) {
  const [releve, setReleve] = useState<Releve | null>(null);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avecOuverture, setAvecOuverture] = useState(true);
  const [avecSoldeReel, setAvecSoldeReel] = useState(true);

  useEffect(() => {
    if (open) return;
    setReleve(null);
    setErreur("");
    setAvecOuverture(true);
    setAvecSoldeReel(true);
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
  const proposerOuverture = Boolean(proposerSoldeDepart && releve?.ouverture?.date);
  const n = releve?.mouvements.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importer un relevé</DialogTitle>
          <DialogDescription>
            Relevé de la banque en PDF (avec du texte) ou classeur Excel, avec une ou plusieurs feuilles (un mois par feuille). Les opérations déjà présentes ne sont pas
            recréées.
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
              <strong>{n}</strong> mouvement{n > 1 ? "s" : ""} lu{n > 1 ? "s" : ""} — débit <span className="tabular-nums">{nombre(debit)}</span>, crédit{" "}
              <span className="tabular-nums">{nombre(credit)}</span> {devise}
              {releve.ignorees > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {releve.ignorees} ligne{releve.ignorees > 1 ? "s" : ""} ignorée{releve.ignorees > 1 ? "s" : ""} (totaux, lignes vides)
                </span>
              )}
            </p>

            {releve.feuilles.length > 0 && (
              <div className="overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse text-xs" aria-label="Feuilles du classeur">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="px-2 py-1.5">Feuille</th>
                      <th className="px-2 py-1.5 text-right">Mouvements</th>
                      <th className="px-2 py-1.5 text-right">Solde de départ</th>
                      <th className="px-2 py-1.5 text-right">Débit</th>
                      <th className="px-2 py-1.5 text-right">Crédit</th>
                      <th className="px-2 py-1.5 text-right">Solde calculé</th>
                      <th className="px-2 py-1.5 text-right">Solde réel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releve.feuilles.map((f) => (
                      <tr key={f.nom} className="border-t border-border">
                        <td className="whitespace-nowrap px-2 py-1 font-medium">{f.nom}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.nbMouvements}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.ouverture == null ? "—" : nombre(f.ouverture)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{nombre(f.debit)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{nombre(f.credit)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.cloture == null ? "—" : nombre(f.cloture)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.soldeReel == null ? "—" : nombre(f.soldeReel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(releve.avertissements.length > 0 || releve.feuillesIgnorees.length > 0 || releve.ecartsSociete.length > 0) && (
              <div role="alert" className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />À vérifier avant d'importer
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {releve.avertissements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {releve.feuillesIgnorees.length > 0 && <li>Feuille(s) sans relevé reconnu, ignorée(s) : {releve.feuillesIgnorees.join(", ")}.</li>}
                  {releve.ecartsSociete.length > 0 && (
                    <li>
                      {releve.ecartsSociete.length} ligne{releve.ecartsSociete.length > 1 ? "s" : ""} où le montant « société » diffère du montant « banque » (frais bancaires probables) : les
                      montants de la banque sont importés. Exemple : {releve.ecartsSociete[0].libelle} — société {nombre(releve.ecartsSociete[0].societe)}, banque{" "}
                      {nombre(releve.ecartsSociete[0].banque)}.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-secondary text-left">
                  <tr>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Description</th>
                    <th className="px-2 py-1.5">N° pièce</th>
                    <th className="px-2 py-1.5">Type</th>
                    <th className="px-2 py-1.5 text-right">Débit</th>
                    <th className="px-2 py-1.5 text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {releve.mouvements.slice(0, 200).map((m, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="whitespace-nowrap px-2 py-1">{formatDate(m.dateOp)}</td>
                      <td className="px-2 py-1">
                        {m.libelle}
                        {m.cours ? <span className="ml-1 font-medium text-primary">· cours {m.cours}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-[0.7rem]">{m.numPiece || "—"}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{TYPE_LABELS[m.type]}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.debit ? nombre(m.debit) : ""}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.credit ? nombre(m.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {n > 200 && <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">… et {n - 200} autres mouvements.</p>}
            </div>

            {proposerOuverture && releve.ouverture?.date && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={avecOuverture} onChange={(e) => setAvecOuverture(e.target.checked)} />
                Prendre « solde au {formatDate(releve.ouverture.date)} : {nombre(releve.ouverture.montant)} {devise} » comme solde de départ du compte
              </label>
            )}
            {releve.soldeReel && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={avecSoldeReel} onChange={(e) => setAvecSoldeReel(e.target.checked)} />
                Enregistrer le solde réel du relevé : {nombre(releve.soldeReel.montant)} {devise}
                {releve.soldeReel.date ? ` au ${formatDate(releve.soldeReel.date)}` : ""}
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
            disabled={saving || !releve || n === 0}
            onClick={async () => {
              if (!releve) return;
              setSaving(true);
              try {
                await onImport(releve.mouvements, {
                  ouverture: proposerOuverture && avecOuverture ? releve.ouverture : null,
                  soldeReel: avecSoldeReel ? releve.soldeReel : null,
                });
                onOpenChange(false);
              } catch {
                // erreur déjà affichée par le store
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Import…" : `Importer ${n} mouvement${n > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
