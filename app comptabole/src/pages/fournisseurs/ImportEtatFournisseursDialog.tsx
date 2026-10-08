import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { lireClasseurExcel } from "@/lib/classeurExcel";
import { lireEtatsFournisseurs, type FeuilleFournisseur } from "@/lib/etatFournisseursClasseur";
import { anomaliesLigne, rapprocherFeuille, type EtatPlan, type RapprochementFeuille } from "@/lib/etatFournisseursRapprochement";
import { MODE_LABELS } from "@/lib/fournisseurs";
import { fmtMontant } from "@/lib/stockRecap";
import { cn, formatDate } from "@/lib/utils";
import type { BilanImportEtat, ImportEtat } from "@/store/fournisseurs";
import type { FactureFournisseur } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  /** Factures d'achat de la société (gestion de stock) : celles que le classeur est rapproché. */
  factures: FactureFournisseur[];
  onImporter: (data: ImportEtat) => Promise<BilanImportEtat>;
}

interface FeuilleRapprochee {
  feuille: FeuilleFournisseur;
  rap: RapprochementFeuille;
}

const ETATS: Record<EtatPlan, { label: string; classe: string }> = {
  ok: { label: "Exact", classe: "bg-success/15 text-success" },
  partiel: { label: "Partiel", classe: "bg-accent/20 text-primary" },
  excedent: { label: "Écart", classe: "bg-warning/20 text-warning" },
  orphelin: { label: "À part", classe: "bg-warning/20 text-warning" },
  incomplet: { label: "Incomplet", classe: "bg-destructive/15 text-destructive" },
};

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const cle = (f: number, p: number) => `${f}:${p}`;

/** Importe un état fournisseur Excel (une feuille par fournisseur) : règlements et suivi de proforma sont rapprochés des
 * factures d'achat de la gestion de stock — une facture absente du stock n'est jamais inventée. */
export function ImportEtatFournisseursDialog({ open, onOpenChange, societeId, factures, onImporter }: Props) {
  const [nomFichier, setNomFichier] = useState("");
  const [lues, setLues] = useState<FeuilleRapprochee[]>([]);
  const [ignorees, setIgnorees] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [avecSuivi, setAvecSuivi] = useState(true);
  const [bilan, setBilan] = useState<BilanImportEtat | null>(null);

  useEffect(() => {
    if (open) return;
    setNomFichier("");
    setLues([]);
    setIgnorees([]);
    setErreur("");
    setSelection(new Set());
    setAvecSuivi(true);
    setBilan(null);
  }, [open]);

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLecture(true);
    setErreur("");
    setBilan(null);
    try {
      const { feuilles, ignorees: sans } = lireEtatsFournisseurs(await lireClasseurExcel(file));
      if (feuilles.length === 0) throw new Error("Aucun état fournisseur reconnu (colonnes N° facture, Mont fact, Mode de règlement…).");
      const rapprochees = feuilles.map((feuille) => ({ feuille, rap: rapprocherFeuille(feuille, factures) }));
      setNomFichier(file.name);
      setLues(rapprochees);
      setIgnorees(sans);
      // Par défaut : les règlements exacts et partiels. Les écarts se cochent à la main.
      const initial = new Set<string>();
      rapprochees.forEach(({ rap }, f) =>
        rap.importables.forEach(({ plan }) => {
          if (plan.etat === "ok" || plan.etat === "partiel") initial.add(cle(f, plan.index));
        }),
      );
      setSelection(initial);
    } catch (err) {
      setLues([]);
      setErreur(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  }

  const importables = useMemo(() => new Set(lues.flatMap(({ rap }, f) => rap.importables.map(({ plan }) => cle(f, plan.index)))), [lues]);
  const nbLignes = lues.reduce((s, { feuille }) => s + feuille.factures.length, 0);
  const nbRetrouvees = lues.reduce((s, { rap }) => s + rap.lignes.filter((l) => l.mouvements.length > 0 && l.manquants.length === 0 && l.ambigus.length === 0).length, 0);
  const nbSuivis = lues.reduce(
    (s, { rap }) => s + rap.lignes.filter((l) => l.mouvements.length > 0 && (l.facture.proforma || l.facture.numTitre || l.facture.etatChargement || l.facture.vuPasse)).length,
    0,
  );

  async function importer() {
    setSaving(true);
    try {
      const payload: ImportEtat = { societeId, suivis: [], reglements: [] };
      lues.forEach(({ feuille, rap }, f) => {
        for (const imp of rap.importables) {
          if (!selection.has(cle(f, imp.plan.index))) continue;
          const r = imp.plan.reglement;
          const affecte = r3(imp.affectations.reduce((s, a) => s + a.montant, 0));
          const rs = Math.min(r.rsMontant, affecte);
          payload.reglements.push({
            fournisseurCle: imp.fournisseurCle,
            dateReglement: r.date,
            mode: r.mode,
            reference: r.reference,
            banque: r.banque,
            devise: imp.devise,
            rsNumero: r.rsNumero,
            rsTaux: affecte > 0 ? r3((rs / affecte) * 100) : 0,
            rsMontant: rs,
            note: `Importé de l'état « ${feuille.nom} »`,
            affectations: imp.affectations,
          });
        }
        if (avecSuivi) {
          for (const l of rap.lignes) {
            const p = l.facture.proforma;
            if (l.mouvements.length === 0 || !(p || l.facture.numTitre || l.facture.etatChargement || l.facture.vuPasse)) continue;
            for (const m of l.mouvements) {
              payload.suivis.push({
                mouvementId: m.id,
                numProforma: p?.num ?? "",
                dateProforma: p?.date ?? null,
                montantProforma: p?.montant ?? 0,
                qteProforma: p?.qte ?? 0,
                etatProforma: p?.etat ?? "",
                numTitre: l.facture.numTitre,
                etatChargement: l.facture.etatChargement,
                vuPasse: l.facture.vuPasse,
              });
            }
          }
        }
      });
      setBilan(await onImporter(payload));
    } catch {
      // erreur déjà affichée par le store
    } finally {
      setSaving(false);
    }
  }

  const nbChoisis = selection.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importer un état fournisseur</DialogTitle>
          <DialogDescription>
            Classeur Excel de vos états (une feuille par fournisseur). Les factures du classeur sont retrouvées par leur numéro dans la gestion de stock ; leurs règlements et le suivi des
            proformas sont repris. Une facture absente du stock n'est pas créée : ajoutez-la d'abord dans le stock.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-input px-4 py-7 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-foreground">{lecture ? "Lecture en cours…" : nomFichier ? `${nomFichier} — choisir un autre fichier` : "Cliquez pour choisir un fichier .xlsx"}</span>
          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={lecture || saving} className="hidden" onChange={choisir} />
        </label>

        {erreur && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

        {lues.length > 0 && !bilan && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              <strong>{lues.length}</strong> feuille{lues.length > 1 ? "s" : ""} · <strong>{nbRetrouvees}</strong> ligne{nbRetrouvees > 1 ? "s" : ""} de facture retrouvée{nbRetrouvees > 1 ? "s" : ""} sur{" "}
              <strong>{nbLignes}</strong> · <strong>{importables.size}</strong> règlement{importables.size > 1 ? "s" : ""} importable{importables.size > 1 ? "s" : ""}
              {ignorees.length > 0 && <span className="text-muted-foreground"> · feuille(s) ignorée(s) : {ignorees.join(", ")}</span>}
            </p>

            {nbRetrouvees === 0 && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                Aucune facture du classeur n'a été retrouvée dans la gestion de stock de cette société. Les factures d'achat y sont lues par leur numéro : enregistrez-les d'abord dans le stock.
              </p>
            )}

            {lues.map(({ feuille, rap }, f) => {
              const manquantes = rap.lignes.filter((l) => l.manquants.length > 0 || l.ambigus.length > 0);
              const anomalies = rap.lignes.flatMap((l) => anomaliesLigne(l, factures).map((a) => `${l.facture.texteNumero || "ligne " + l.facture.ligne} : ${a}`));
              return (
                <section key={feuille.nom} className="rounded-lg border border-border" aria-label={`Feuille ${feuille.nom}`}>
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2">
                    <h3 className="font-serif text-lg text-primary">{feuille.nom}</h3>
                    <span className="text-xs text-muted-foreground">
                      {rap.lignes.length - manquantes.length}/{rap.lignes.length} factures retrouvées · {rap.importables.length}/{rap.plans.length} règlements importables
                    </span>
                  </header>

                  {rap.plans.length > 0 && (
                    <div className="max-h-72 overflow-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead className="sticky top-0 bg-card text-left">
                          <tr className="border-b border-border">
                            <th className="w-8 px-2 py-1.5" />
                            <th className="px-2 py-1.5">Date</th>
                            <th className="px-2 py-1.5">Règlement</th>
                            <th className="px-2 py-1.5">Banque</th>
                            <th className="px-2 py-1.5">N° RS</th>
                            <th className="px-2 py-1.5 text-right">Total réglé</th>
                            <th className="px-2 py-1.5">État</th>
                            <th className="px-2 py-1.5">Remarque</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rap.plans.map((plan) => {
                            const k = cle(f, plan.index);
                            const possible = importables.has(k);
                            const r = plan.reglement;
                            return (
                              <tr key={k} className={cn("border-b border-border/60 align-top", !possible && "text-muted-foreground")}>
                                <td className="px-2 py-1.5">
                                  <Checkbox
                                    checked={selection.has(k)}
                                    disabled={!possible}
                                    aria-label={`Importer le règlement du ${r.date ? formatDate(r.date) : "sans date"} (${r.reference || MODE_LABELS[r.mode]})`}
                                    onCheckedChange={(c) =>
                                      setSelection((s) => {
                                        const suite = new Set(s);
                                        if (c) suite.add(k);
                                        else suite.delete(k);
                                        return suite;
                                      })
                                    }
                                  />
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5">{r.date ? formatDate(r.date) : "—"}</td>
                                <td className="px-2 py-1.5">
                                  {MODE_LABELS[r.mode]}
                                  {r.reference && <span className="ml-1 font-mono text-[0.7rem]">{r.reference}</span>}
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5">{r.banque || "—"}</td>
                                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[0.7rem]">{r.rsNumero || "—"}</td>
                                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{fmtMontant(plan.brut)}</td>
                                <td className="px-2 py-1.5">
                                  <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", ETATS[plan.etat].classe)}>{ETATS[plan.etat].label}</span>
                                </td>
                                <td className="px-2 py-1.5">{plan.note}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {manquantes.length > 0 && (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                      <strong className="text-foreground">{manquantes.length} ligne{manquantes.length > 1 ? "s" : ""}</strong> du classeur sans facture correspondante dans le stock (ex. :{" "}
                      {manquantes
                        .slice(0, 4)
                        .map((l) => l.manquants[0] ?? l.ambigus[0])
                        .join(", ")}
                      ).
                    </p>
                  )}
                  {anomalies.length > 0 && (
                    <details className="border-t border-border px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-medium text-warning">
                        {anomalies.length} différence{anomalies.length > 1 ? "s" : ""} avec la gestion de stock
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {anomalies.slice(0, 8).map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                        {anomalies.length > 8 && <li>… et {anomalies.length - 8} autres.</li>}
                      </ul>
                    </details>
                  )}
                  {feuille.avertissements.length > 0 && (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{feuille.avertissements.slice(0, 3).join(" ")}</p>
                  )}
                </section>
              );
            })}

            {nbSuivis > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={avecSuivi} onChange={(e) => setAvecSuivi(e.target.checked)} />
                Reprendre aussi la proforma, le titre, l'état de chargement et « vu passé » de {nbSuivis} facture{nbSuivis > 1 ? "s" : ""} retrouvée{nbSuivis > 1 ? "s" : ""}
              </label>
            )}
          </div>
        )}

        {bilan && (
          <div role="status" className="space-y-2 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              Import terminé
            </p>
            <ul className="list-disc space-y-0.5 pl-6">
              <li>{bilan.crees} règlement{bilan.crees > 1 ? "s" : ""} créé{bilan.crees > 1 ? "s" : ""}</li>
              {bilan.ignores > 0 && <li>{bilan.ignores} déjà présent{bilan.ignores > 1 ? "s" : ""}, non recréé{bilan.ignores > 1 ? "s" : ""}</li>}
              {bilan.suivisMaj > 0 && <li>{bilan.suivisMaj} suivi{bilan.suivisMaj > 1 ? "s" : ""} de facture mis à jour</li>}
              {bilan.refuses.length > 0 && <li className="text-destructive">{bilan.refuses.length} refusé{bilan.refuses.length > 1 ? "s" : ""} : {bilan.refuses.slice(0, 3).map((x) => x.raison).join(" · ")}</li>}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {bilan ? "Fermer" : "Annuler"}
          </Button>
          {!bilan && (
            <Button type="button" variant="ledger" disabled={saving || lues.length === 0 || (nbChoisis === 0 && !(avecSuivi && nbSuivis > 0))} onClick={() => void importer()}>
              {saving ? "Import…" : `Importer ${nbChoisis} règlement${nbChoisis > 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
