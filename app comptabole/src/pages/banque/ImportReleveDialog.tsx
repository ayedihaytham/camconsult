import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { extraireMouvements, lireFichierPdf, nombreDeCaracteres, type PdfTextItem } from "@/lib/pdfToTables";
import { lirePdfParOcr, relireMontantsParColonnes } from "@/lib/ocrPdf";
import { controleReleve, harmoniserLibelles, type ControleReleve } from "@/lib/controleReleve";
import { verifierImport } from "@/lib/verifierImport";
import type { MouvementBancaire } from "@/types";

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
  /** PDF : totaux et solde calculés comparés à ceux que le relevé imprime ; null pour un classeur ou un relevé sans totaux. */
  controle: ControleReleve | null;
  /** PDF sans texte (image) lu par reconnaissance de caractères. */
  ocr: boolean;
  /** Texte lu du PDF (pour relire les montants à la demande). */
  pagesPdf: PdfTextItem[][];
}

/** Soldes réels de la banque par mois et opérations en cours que le classeur donne en pied de chaque feuille. */
export interface ImportMensuel {
  releves: { mois: string; soldeReel: number | null }[];
  enCours: { mois: string; designation: string; debit: number; credit: number }[];
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
  /** Mouvements du compte, relus après l'import pour vérifier qu'ils sont bien ceux du fichier. */
  mouvementsCompte?: MouvementBancaire[];
  onImport: (mouvements: MouvementImport[], maj: MiseAJourCompte, mensuel: ImportMensuel) => Promise<void>;
}

const ecartTotal = (c: ControleReleve | null) => (c ? c.lignes.reduce((t, l) => t + Math.abs(l.ecart), 0) : null);

/** Mouvements d'un PDF déjà lu (texte natif ou OCR), avec le contrôle de ses totaux. */
function releveDePdf(nom: string, pages: PdfTextItem[][], ocr: boolean): Releve {
  let tableau = extraireMouvements(pages);
  if (ocr && tableau) tableau = harmoniserLibelles(tableau);
  const controle = tableau ? controleReleve(pages, tableau) : null;
  const r = tableau && lignesVersMouvements(tableau);
  if (!r) throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Libellé / Débit / Crédit).");
  return { nom, mouvements: r.mouvements, ignorees: r.ignorees, ouverture: r.soldeOuverture, soldeReel: null, feuilles: [], feuillesIgnorees: [], avertissements: [], ecartsSociete: [], controle, ocr, pagesPdf: pages };
}

/** Lit un relevé PDF (texte, ou image lue par reconnaissance de caractères) ou un classeur Excel du cabinet (une feuille par mois) et renvoie ses mouvements. */
async function lireReleve(file: File, etat: (texte: string) => void): Promise<Releve> {
  const nom = file.name;
  if (/\.pdf$/i.test(nom)) {
    let pages = await lireFichierPdf(file);
    let ocr = false;
    if (nombreDeCaracteres(pages) === 0) {
      etat("PDF sans texte : lecture par reconnaissance de caractères…");
      pages = await lirePdfParOcr(file, { onProgression: ({ page, pages: total }) => etat(`Reconnaissance de caractères : page ${page} sur ${total}…`) });
      if (nombreDeCaracteres(pages) === 0) throw new Error("Aucun texte reconnu sur ce scan : image trop floue, trop sombre ou de travers.");
      ocr = true;
    }
    return releveDePdf(nom, pages, ocr);
  }
  const feuilles = await lireClasseurExcel(file);
  const lu = lireClasseurBancaire(feuilles);
  if (lu.mouvements.length === 0) throw new Error("Aucun tableau de mouvements reconnu (en-tête Date / Description / Débit / Crédit).");
  return { nom, ...lu, controle: null, ocr: false, pagesPdf: [] };
}

const nombre = (n: number) => fmtMontant(n);

export function ImportReleveDialog({ open, onOpenChange, devise, proposerSoldeDepart, mouvementsCompte = [], onImport }: Props) {
  const [releve, setReleve] = useState<Releve | null>(null);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [etatLecture, setEtatLecture] = useState("");
  const [importe, setImporte] = useState(false);
  const fichierRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [avecOuverture, setAvecOuverture] = useState(true);
  const [avecSoldeReel, setAvecSoldeReel] = useState(true);
  const [avecMensuel, setAvecMensuel] = useState(true);

  useEffect(() => {
    if (open) return;
    setReleve(null);
    setErreur("");
    setImporte(false);
    setAvecOuverture(true);
    setAvecSoldeReel(true);
    setAvecMensuel(true);
  }, [open]);

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLecture(true);
    setEtatLecture("");
    setErreur("");
    setReleve(null);
    try {
      fichierRef.current = file;
      setReleve(await lireReleve(file, setEtatLecture));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  }

  /** Relecture à la demande des colonnes de montants d'un scan dont les totaux ne tombent pas juste (plus lente que la première lecture). */
  async function relireMontants() {
    if (!releve || !fichierRef.current) return;
    setLecture(true);
    setEtatLecture("Relecture des montants…");
    try {
      const relues = await relireMontantsParColonnes(fichierRef.current, releve.pagesPdf, { onProgression: ({ page, pages: total }) => setEtatLecture(`Relecture des montants : page ${page} sur ${total}…`) });
      const autre = releveDePdf(releve.nom, relues, true);
      if ((ecartTotal(autre.controle) ?? Infinity) < (ecartTotal(releve.controle) ?? Infinity)) {
        setReleve(autre);
        toast.success(autre.controle?.ok ? "Relecture réussie : les totaux sont maintenant exacts" : "Relecture : l'écart avec les totaux du relevé a diminué");
      } else toast.info("La relecture n'améliore pas les totaux : la première lecture est conservée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relecture impossible");
    } finally {
      setLecture(false);
    }
  }

  const debit = releve ? Math.round(releve.mouvements.reduce((s, m) => s + m.debit, 0) * 1000) / 1000 : 0;
  const credit = releve ? Math.round(releve.mouvements.reduce((s, m) => s + m.credit, 0) * 1000) / 1000 : 0;
  const proposerOuverture = Boolean(proposerSoldeDepart && releve?.ouverture?.date);
  const n = releve?.mouvements.length ?? 0;
  const mensuel: ImportMensuel = {
    releves: (releve?.feuilles ?? []).filter((f) => f.mois && f.soldeBanque !== null).map((f) => ({ mois: f.mois!, soldeReel: f.soldeBanque })),
    enCours: (releve?.feuilles ?? []).flatMap((f) => (f.mois ? f.enCours.map((o) => ({ mois: f.mois!, ...o })) : [])),
  };
  const lignesPerdues = (releve?.feuilles ?? []).flatMap((f) => f.lignesIgnorees.map((l) => ({ ...l, feuille: f.nom.trim() })));

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

        {!importe && <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-input px-4 py-8 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {lecture ? etatLecture || "Lecture en cours…" : releve ? `${releve.nom} — choisir un autre fichier` : "Cliquez pour choisir un fichier .pdf, .xlsx ou .xls"}
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={lecture}
            className="hidden"
            onChange={choisir}
          />
        </label>}

        {erreur && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

        {releve && importe && <VerificationImportPanel releve={releve} devise={devise} enregistres={mouvementsCompte} />}

        {releve && !importe && (
          <div className="space-y-3">
            {releve.ocr && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                PDF image lu par reconnaissance de caractères : une lecture automatique peut se tromper, d'où le contrôle ci-dessous.
              </p>
            )}
            {releve.controle && <ControlePanel controle={releve.controle} devise={devise} />}
            {releve.ocr && releve.controle && !releve.controle.ok && (
              <Button type="button" variant="outline" size="sm" disabled={lecture} onClick={() => void relireMontants()}>
                {lecture ? etatLecture : "Relire les montants (plus lent)"}
              </Button>
            )}
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
                      <th className="px-2 py-1.5 text-right">Solde réel (banque)</th>
                      <th className="px-2 py-1.5 text-right">Écart</th>
                      <th className="px-2 py-1.5 text-right">En cours</th>
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
                        <td className="px-2 py-1 text-right tabular-nums">{f.soldeBanque == null ? "—" : nombre(f.soldeBanque)}</td>
                        {(() => {
                          const ecart = f.soldeBanque == null || f.cloture == null ? null : Math.round((f.soldeBanque - f.cloture) * 1000) / 1000;
                          return <td className={cn("px-2 py-1 text-right font-semibold tabular-nums", ecart ? "text-destructive" : "text-success")}>{ecart === null ? "—" : nombre(ecart)}</td>;
                        })()}
                        <td className="px-2 py-1 text-right tabular-nums">{f.enCours.length || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(releve.avertissements.length > 0 || releve.feuillesIgnorees.length > 0 || releve.ecartsSociete.length > 0 || lignesPerdues.length > 0) && (
              <div role="alert" className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />À vérifier avant d'importer
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {releve.avertissements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {lignesPerdues.slice(0, 8).map((l) => (
                    <li key={`${l.feuille}-${l.ligne}`}>Ligne non importée — « {l.feuille} » ligne {l.ligne} : {l.texte} ({l.raison}).</li>
                  ))}
                  {lignesPerdues.length > 8 && <li>… et {lignesPerdues.length - 8} autres lignes non importées.</li>}
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
            {(mensuel.releves.length > 0 || mensuel.enCours.length > 0) && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={avecMensuel} onChange={(e) => setAvecMensuel(e.target.checked)} />
                Enregistrer les soldes réels de {mensuel.releves.length} mois et {mensuel.enCours.length} opération{mensuel.enCours.length > 1 ? "s" : ""} en cours du classeur
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
            {importe ? "Fermer" : "Annuler"}
          </Button>
          {!importe && <Button
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
                }, avecMensuel ? mensuel : { releves: [], enCours: [] });
                setImporte(true);
              } catch {
                // erreur déjà affichée par le store
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Import…" : `Importer ${n} mouvement${n > 1 ? "s" : ""}`}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Totaux et solde du PDF comparés à ceux que le relevé imprime : avant l'import, la preuve que chaque montant a été lu juste. */
function ControlePanel({ controle, devise }: { controle: ControleReleve; devise: string }) {
  return (
    <div role="status" className={cn("rounded-md border px-3 py-2 text-xs", controle.ok ? "border-success/40 bg-success/10" : "border-destructive/30 bg-destructive/5")}>
      <p className={cn("flex items-center gap-1.5 font-semibold", controle.ok ? "text-success" : "text-destructive")}>
        {controle.ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
        {controle.ok ? "Relevé contrôlé : les totaux calculés sont exactement ceux que le relevé imprime" : "Les totaux calculés ne sont pas ceux que le relevé imprime : vérifiez les lignes avant d'importer"}
      </p>
      <ul className="mt-1 space-y-0.5 text-foreground">
        {controle.lignes.map((l) => (
          <li key={l.libelle} className="tabular-nums">
            {l.libelle} : {nombre(l.calcule)} calculé, {nombre(l.releve)} au relevé {devise}
            {l.ok ? " ✓" : ` — écart ${nombre(l.ecart)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Après l'import : le fichier, ce qui en a été extrait et ce qui est enregistré dans le compte, côte à côte. */
function VerificationImportPanel({ releve, devise, enregistres }: { releve: Releve; devise: string; enregistres: MouvementBancaire[] }) {
  const v = verifierImport(releve.mouvements, enregistres, releve.controle);
  const valeur = (l: { libelle: string }, x: number) => (l.libelle === "Nombre de lignes" ? String(x) : nombre(x));
  return (
    <div role="status" className="space-y-3">
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", v.ok ? "text-success" : "text-destructive")}>
        {v.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
        {v.ok ? "Import exact : le compte contient exactement les lignes du fichier, et leurs totaux sont ceux du relevé" : "Import à vérifier : le compte ne correspond pas exactement au fichier"}
      </p>
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs" aria-label="Vérification de l'import">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="px-2 py-1.5">Contrôle ({devise})</th>
              <th className="px-2 py-1.5 text-right">Relevé imprimé</th>
              <th className="px-2 py-1.5 text-right">Extrait du fichier</th>
              <th className="px-2 py-1.5 text-right">Enregistré dans le compte</th>
              <th className="px-2 py-1.5 text-right">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {v.lignes.map((l) => (
              <tr key={l.libelle} className="border-t border-border">
                <td className="px-2 py-1 font-medium">{l.libelle}</td>
                <td className="px-2 py-1 text-right tabular-nums">{l.releve === null ? "—" : valeur(l, l.releve)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{valeur(l, l.fichier)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{valeur(l, l.compte)}</td>
                <td className={cn("px-2 py-1 text-right font-semibold", l.ok ? "text-success" : "text-destructive")}>{l.ok ? "Exact" : "Écart"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {v.manquantes.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          <p className="font-semibold text-destructive">{v.manquantes.length} ligne{v.manquantes.length > 1 ? "s" : ""} du fichier introuvable{v.manquantes.length > 1 ? "s" : ""} dans le compte</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {v.manquantes.slice(0, 10).map((m, i) => (
              <li key={i}>
                {formatDate(m.dateOp)} — {m.libelle} — {m.debit ? `débit ${nombre(m.debit)}` : `crédit ${nombre(m.credit)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
