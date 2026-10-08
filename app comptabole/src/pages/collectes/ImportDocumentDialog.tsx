import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { lireGrandLivre, lignesPourTableau, TABLEAUX_GRAND_LIVRE, type GrandLivre, type NatureEcriture } from "@/lib/collecte/grandLivre";
import type { TabDef, TabRow } from "@/lib/collecte/tabs";
import { lireFichierPdf, nombreDeCaracteres, reconstruireTableau } from "@/lib/pdfToTables";
import { formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  def: TabDef;
  devise: string;
  /** Lignes à ajouter au tableau (comme si on les avait saisies : rien n'est enregistré avant « Enregistrer »). */
  onAjouter: (lignes: TabRow[]) => void;
}

const NATURES: Record<NatureEcriture, string> = {
  cheque_emis: "chèques émis",
  cheque_recu: "chèques encaissés",
  effet_recu: "effets encaissés",
  virement_emis: "virements émis",
  virement_recu: "virements reçus",
  report: "solde antérieur",
  autre: "autres écritures",
};

const nombre = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function afficher(v: unknown, type: string): string {
  if (v === "" || v == null) return "";
  if (type === "date") return formatDate(String(v));
  if (type === "number") return nombre(Number(v));
  return String(v);
}

/** Importe dans le tableau les lignes d'un document : pour l'instant le grand-livre d'un compte (PDF Sage 100). Le document est lu
 * dans le navigateur, jamais envoyé au serveur ; les lignes se vérifient ici avant d'être ajoutées au tableau. */
export function ImportDocumentDialog({ open, onOpenChange, def, devise, onAjouter }: Props) {
  const [livre, setLivre] = useState<GrandLivre | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [choix, setChoix] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) return;
    setLivre(null);
    setNomFichier("");
    setErreur("");
    setChoix(new Set());
  }, [open]);

  const cible = TABLEAUX_GRAND_LIVRE[def.key];
  const lignes = useMemo(() => (livre ? lignesPourTableau(def.key, livre.ecritures) : []), [livre, def.key]);
  const ailleurs = useMemo(() => {
    if (!livre || !cible) return [];
    const par = new Map<NatureEcriture, number>();
    for (const e of livre.ecritures) if (!cible.natures.includes(e.nature)) par.set(e.nature, (par.get(e.nature) ?? 0) + 1);
    return [...par.entries()].filter(([n]) => n !== "report");
  }, [livre, cible]);

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLecture(true);
    setErreur("");
    setLivre(null);
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error("Choisissez un PDF : le grand-livre du compte (Sage 100) exporté en PDF.");
      const pages = await lireFichierPdf(file);
      if (nombreDeCaracteres(pages) === 0) throw new Error("PDF scanné (image) : il ne contient pas de texte à lire.");
      const lu = lireGrandLivre(pages.map((p) => reconstruireTableau(p, { nombres: false }) as string[][]));
      if (!lu) throw new Error("Document non reconnu. Pour l'instant, seul le grand-livre d'un compte au format PDF de Sage 100 est lu (colonnes Date, Journal, N° pièce, Libellé, Débit, Crédit).");
      setNomFichier(file.name);
      setLivre(lu);
      setChoix(new Set(lignesPourTableau(def.key, lu.ecritures).map((_, i) => i)));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  }

  const colonnes = def.columns.filter((c) => !c.computed);
  const toutes = lignes.length > 0 && choix.size === lignes.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importer un document dans « {def.label} »</DialogTitle>
          <DialogDescription>
            Grand-livre d'un compte en PDF (Sage 100) : les écritures qui concernent ce tableau sont proposées, avec la banque, le n° et le nom lus dans leur libellé. Vérifiez
            puis ajoutez ; rien n'est enregistré avant « Enregistrer ».
          </DialogDescription>
        </DialogHeader>

        {!cible ? (
          <p className="rounded-md bg-secondary/60 px-3 py-3 text-sm text-muted-foreground">
            L'import de document n'est pas disponible pour ce tableau : il alimente la souche de chèques, les bordereaux de remise, les virements reçus et les virements émis.
          </p>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-input px-4 py-7 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-foreground">{lecture ? "Lecture en cours…" : nomFichier ? `${nomFichier} — choisir un autre fichier` : "Cliquez pour choisir un fichier .pdf"}</span>
            <input type="file" accept=".pdf,application/pdf" disabled={lecture} className="hidden" onChange={choisir} />
          </label>
        )}

        {erreur && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

        {livre && cible && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
              <span>
                Compte <strong>{livre.compte || "—"}</strong> de <strong>{livre.societe || "—"}</strong> · {livre.ecritures.length} écritures
              </span>
              {livre.controle === true && (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Totaux du document retrouvés (débit {nombre(livre.totaux!.debit)}, crédit {nombre(livre.totaux!.credit)})
                </span>
              )}
              {livre.controle === false && (
                <span role="alert" className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Les écritures lues ne retrouvent pas les totaux imprimés : une ligne a pu être mal lue.
                </span>
              )}
            </div>

            {lignes.length === 0 ? (
              <p className="rounded-md bg-secondary/60 px-3 py-3 text-sm text-muted-foreground">Aucune écriture de ce document ne concerne ce tableau ({cible.titre.toLowerCase()}).</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-secondary text-left">
                    <tr>
                      <th className="w-8 px-2 py-1.5">
                        <Checkbox
                          checked={toutes}
                          aria-label="Tout sélectionner"
                          onCheckedChange={(c) => setChoix(c ? new Set(lignes.map((_, i) => i)) : new Set())}
                        />
                      </th>
                      {colonnes.map((c) => (
                        <th key={c.key} className={c.type === "number" ? "px-2 py-1.5 text-right" : "px-2 py-1.5"}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">
                          <Checkbox
                            checked={choix.has(i)}
                            aria-label={`Ligne ${i + 1}`}
                            onCheckedChange={(c) =>
                              setChoix((s) => {
                                const suite = new Set(s);
                                if (c) suite.add(i);
                                else suite.delete(i);
                                return suite;
                              })
                            }
                          />
                        </td>
                        {colonnes.map((c) => (
                          <td key={c.key} className={c.type === "number" ? "whitespace-nowrap px-2 py-1 text-right tabular-nums" : "whitespace-nowrap px-2 py-1"}>
                            {afficher(l[c.key], c.type) || <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Montants en {devise}. Les cases que le document ne donne pas (par exemple le n° de bordereau) restent à compléter dans le tableau.
              {ailleurs.length > 0 && (
                <>
                  {" "}
                  Autres écritures du document, pour d'autres tableaux : {ailleurs.map(([n, k]) => `${k} ${NATURES[n]}`).join(", ")}.
                </>
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={choix.size === 0}
            onClick={() => {
              onAjouter(lignes.filter((_, i) => choix.has(i)));
              onOpenChange(false);
            }}
          >
            {`Ajouter ${choix.size} ligne${choix.size > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
