import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dejaPresente, ligneDepuisEcriture, lireGrandLivre, TABLEAU_PAR_NATURE, virementDepuisLigne, virementSwiftDejaPresent, type EcritureLivre, type GrandLivre } from "@/lib/collecte/grandLivre";
import { TAB_BY_KEY, type TabRow } from "@/lib/collecte/tabs";
import { lireFichierPdf, nombreDeCaracteres, reconstruireTableau } from "@/lib/pdfToTables";
import { cn, formatDate } from "@/lib/utils";
import { useCollectes } from "@/store/collectes";
import { useEtatSwift } from "@/store/etatSwift";
import type { CollecteFull } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collecte: CollecteFull;
  /** Tableaux que cette session peut modifier (jamais la souche, ni un tableau archivé). */
  editableTab: (onglet: string) => boolean;
  /** Un tableau est ouvert avec des modifications non enregistrées : l'import le remplacerait. */
  brouillonOuvert: boolean;
}

type Etat = "prete" | "doublon" | "absent" | "ferme" | "report" | "aclasser";

const nombre = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const ETAT_LIBELLE: Record<Etat, string> = {
  prete: "",
  doublon: "Déjà dans le tableau",
  absent: "Tableau non demandé dans cette collecte",
  ferme: "Tableau fermé à la modification",
  report: "Solde antérieur : à justifier",
  aclasser: "À classer à la main",
};

/** Importe d'un seul coup un grand-livre (PDF Sage 100) dans la collecte : chaque écriture est rangée d'après son libellé dans le bon tableau
 * (chèques émis, chèques encaissés, traites, virements reçus et émis). Les écritures sont vérifiées ici ; l'import ajoute les lignes à la suite de
 * celles qui existent et enregistre chaque tableau. Le document est lu dans le navigateur, jamais envoyé au serveur. */
export function ImportGrandLivreDialog({ open, onOpenChange, collecte, editableTab, brouillonOuvert }: Props) {
  const saveLignes = useCollectes((s) => s.saveLignes);
  // « État SWIFT » : les virements sont ceux du module ; on les relit pour ne pas importer deux fois la même écriture.
  const virementsSwift = useEtatSwift((s) => s.virements);
  useEffect(() => {
    if (open) void useEtatSwift.getState().fetch(collecte.societeId).catch(() => undefined);
  }, [open, collecte.societeId]);
  const [livre, setLivre] = useState<GrandLivre | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [choix, setChoix] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) return;
    setLivre(null);
    setNomFichier("");
    setErreur("");
    setChoix(new Set());
  }, [open]);

  const lignesDe = (onglet: string): TabRow[] => collecte.lignes.filter((l) => l.onglet === onglet).sort((a, b) => a.ordre - b.ordre).map((l) => l.data as TabRow);

  /** Pour chaque écriture : son tableau et pourquoi elle peut (ou non) être importée. */
  const classer = (l: GrandLivre) =>
    l.ecritures.map((e): { e: EcritureLivre; table: string | null; etat: Etat } => {
      const table = TABLEAU_PAR_NATURE[e.nature];
      if (e.nature === "report") return { e, table: null, etat: "report" };
      if (!table) return { e, table: null, etat: "aclasser" };
      if (!collecte.onglets.includes(table)) return { e, table, etat: "absent" };
      if (!editableTab(table)) return { e, table, etat: "ferme" };
      const deja = table === "etat_swift" ? virementSwiftDejaPresent(e, virementsSwift) : dejaPresente(table, e, collecte.lignes.filter((x) => x.onglet === table).map((x) => x.data as TabRow));
      if (deja) return { e, table, etat: "doublon" };
      return { e, table, etat: "prete" };
    });
  // editableTab est recréée à chaque rendu du parent : la classification est recalculée, mais la sélection de l'utilisateur, elle, ne l'est jamais.
  const lignes = livre ? classer(livre) : [];

  const preparees = new Set(lignes.flatMap((l, i) => (l.etat === "prete" ? [i] : [])));

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLecture(true);
    setErreur("");
    setLivre(null);
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error("Choisissez un PDF : le grand-livre (Sage 100) exporté en PDF.");
      const pages = await lireFichierPdf(file);
      if (nombreDeCaracteres(pages) === 0) throw new Error("PDF scanné (image) : il ne contient pas de texte à lire.");
      const lu = lireGrandLivre(pages.map((p) => reconstruireTableau(p, { nombres: false }) as string[][]));
      if (!lu) throw new Error("Document non reconnu. Seul le grand-livre au format PDF de Sage 100 est lu (colonnes Date, Journal, N° pièce, Libellé, Débit, Crédit).");
      setNomFichier(file.name);
      setLivre(lu);
      // Sélection de départ : toutes les écritures prêtes (ni déjà importées, ni dans un tableau fermé).
      setChoix(new Set(classer(lu).flatMap((l, i) => (l.etat === "prete" ? [i] : []))));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  }

  const selection = lignes.flatMap((l, i) => (choix.has(i) && l.etat === "prete" ? [l] : []));
  const parTable = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const l of selection) {
      const t = m.get(l.table!) ?? { n: 0, total: 0 };
      t.n += 1;
      t.total += l.e.montant;
      m.set(l.table!, t);
    }
    return m;
  }, [selection]);

  /** Compte d'attente : somme reçue les années précédentes (solde antérieur) et situation à la fin de la période. */
  const attente = useMemo(() => {
    if (!livre) return null;
    const ec = livre.ecritures.filter((e) => e.classe === "attente");
    if (ec.length === 0) return null;
    const report = ec.filter((e) => e.nature === "report").reduce((s, e) => s + e.credit - e.debit, 0);
    const recus = ec.filter((e) => e.nature !== "report").reduce((s, e) => s + e.credit, 0);
    const payes = ec.filter((e) => e.nature !== "report").reduce((s, e) => s + e.debit, 0);
    return { report, recus, payes, fin: report + recus - payes };
  }, [livre]);

  async function importer() {
    if (selection.length === 0) return;
    setEnvoi(true);
    const echecs: string[] = [];
    let total = 0;
    for (const [table] of parTable) {
      const def = TAB_BY_KEY[table];
      if (def.module) {
        // Virements SWIFT : créés dans le module (brouillons à vérifier, puis à envoyer à la société).
        try {
          for (const l of selection.filter((x) => x.table === table)) await useEtatSwift.getState().create(collecte.societeId, virementDepuisLigne(ligneDepuisEcriture(table, l.e)));
          total += selection.filter((x) => x.table === table).length;
        } catch {
          echecs.push(def.label);
        }
        continue;
      }
      const vide = Object.fromEntries(def.columns.map((c) => [c.key, c.defaut ?? ""]));
      const nouvelles = selection.filter((l) => l.table === table).map((l) => ({ ...vide, ...ligneDepuisEcriture(table, l.e) }));
      const toutes = [...lignesDe(table), ...nouvelles];
      const sortie = def.derive ? def.derive(toutes) : toutes;
      try {
        await saveLignes(collecte.id, table, sortie.map((data, ordre) => ({ data, ordre })));
        total += nouvelles.length;
      } catch {
        echecs.push(def.label);
      }
    }
    setEnvoi(false);
    if (total > 0) toast.success(`${total} ligne${total > 1 ? "s" : ""} importée${total > 1 ? "s" : ""} et enregistrée${total > 1 ? "s" : ""}`);
    if (echecs.length > 0) toast.error(`Import impossible dans : ${echecs.join(", ")}`);
    else onOpenChange(false);
  }

  const pasPretes = lignes.filter((l) => l.etat !== "prete" && l.etat !== "doublon" && l.etat !== "report").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Importer un grand-livre dans la collecte</DialogTitle>
          <DialogDescription>
            Le sens de chaque écriture est lu dans son libellé : chèque encaissé, règlement par chèque, virement… Chacune est rangée dans le tableau qui lui correspond ;
            ce que le grand-livre ne donne pas (n° de bordereau, échéance, client) reste à compléter.
          </DialogDescription>
        </DialogHeader>

        {brouillonOuvert && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Un tableau est ouvert avec des modifications non enregistrées. Enregistrez-le d'abord : l'import enregistre les tableaux concernés.
          </p>
        )}

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-input px-4 py-6 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
          <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-foreground">{lecture ? "Lecture en cours…" : nomFichier ? `${nomFichier} — choisir un autre fichier` : "Cliquez pour choisir le grand-livre (.pdf)"}</span>
          <input type="file" accept=".pdf,application/pdf" disabled={lecture} className="sr-only" onChange={choisir} />
        </label>

        {erreur && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

        {livre && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
              <span>
                {livre.comptes.length > 1 ? `${livre.comptes.length} comptes` : <>Compte <strong>{livre.compte || "—"}</strong></>} de <strong>{livre.societe || "—"}</strong> · {livre.ecritures.length} écritures
              </span>
              {livre.controle === true && (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> Totaux du document retrouvés
                </span>
              )}
              {livre.controle === false && (
                <span role="alert" className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Les écritures lues ne retrouvent pas les totaux imprimés : une ligne a pu être mal lue.
                </span>
              )}
              {livre.comptes.some((c) => c.classe === "inconnue") && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Type de compte non reconnu : sens débit/crédit lu comme celui d'un compte d'attente.
                </span>
              )}
            </div>

            {attente && attente.report > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-foreground">
                <p className="flex items-center gap-2 font-semibold text-warning"><Info className="size-4" aria-hidden="true" /> Solde antérieur à justifier : {nombre(attente.report)} {collecte.devise}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sommes encaissées avant la période sans être rattachées à un client ni à une facture. Ce solde n'est pas importé : il ne correspond à aucun chèque ni virement identifiable.
                  Pour le détailler, importez le grand-livre de ce compte pour l'exercice précédent. Sur la période : {nombre(attente.recus)} reçus, {nombre(attente.payes)} payés ;
                  reste à justifier en fin de période : <strong className="text-foreground">{nombre(attente.fin)} {collecte.devise}</strong>.
                </p>
              </div>
            )}

            {parTable.size > 0 && (
              <ul className="flex flex-wrap gap-2">
                {[...parTable].map(([table, v]) => (
                  <li key={table} className="rounded-md border border-accent/30 bg-card px-3 py-1.5 text-xs">
                    <span className="font-semibold text-primary">{TAB_BY_KEY[table].label}</span> · {v.n} ligne{v.n > 1 ? "s" : ""} · {nombre(v.total)}
                  </li>
                ))}
              </ul>
            )}

            <div className="max-h-80 overflow-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-secondary text-left">
                  <tr>
                    <th className="w-8 px-2 py-1.5">
                      <Checkbox
                        checked={preparees.size > 0 && choix.size === preparees.size}
                        disabled={preparees.size === 0}
                        aria-label="Tout sélectionner"
                        onCheckedChange={(c) => setChoix(c ? new Set(preparees) : new Set())}
                      />
                    </th>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Sens</th>
                    <th className="px-2 py-1.5">Libellé</th>
                    <th className="px-2 py-1.5 text-right">Montant</th>
                    <th className="px-2 py-1.5">Vers</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className={cn("border-t border-border", l.etat !== "prete" && "text-muted-foreground")}>
                      <td className="px-2 py-1">
                        <Checkbox
                          checked={choix.has(i)}
                          disabled={l.etat !== "prete"}
                          aria-label={`Écriture ${l.e.piece} du ${formatDate(l.e.date)}`}
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
                      <td className="whitespace-nowrap px-2 py-1">{formatDate(l.e.date)}</td>
                      <td className="whitespace-nowrap px-2 py-1">{l.e.sousType}</td>
                      <td className="px-2 py-1">{l.e.libelle}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{nombre(l.e.montant)}</td>
                      <td className="whitespace-nowrap px-2 py-1">
                        {l.etat === "prete" ? <span className="font-medium text-foreground">{TAB_BY_KEY[l.table!].label}</span> : ETAT_LIBELLE[l.etat]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Montants en {collecte.devise}. « Observations » garde le sens et le repère de l'écriture (compte, banque, n° de pièce) : une écriture déjà importée n'est jamais proposée deux fois.
              {pasPretes > 0 && ` ${pasPretes} écriture${pasPretes > 1 ? "s" : ""} ne peu${pasPretes > 1 ? "vent" : "t"} pas être importée${pasPretes > 1 ? "s" : ""} : voir la dernière colonne.`}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={envoi}>
            Annuler
          </Button>
          <Button type="button" variant="ledger" disabled={selection.length === 0 || envoi || brouillonOuvert} onClick={() => void importer()}>
            {envoi && <LoaderCircle className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
            {`Importer ${selection.length} ligne${selection.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
