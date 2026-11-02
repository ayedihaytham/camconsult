import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import { TYPE_LABELS, type MouvementImport } from "@/lib/banque";
import { COLONNES, collerDansGrille, estVide, ligneVide, lireLigneSaisie, type Colonne, type LigneSaisie } from "@/lib/banqueSaisieRapide";

const NB_LIGNES = 10;
const ENTETES: Record<Colonne, string> = { date: "Date", libelle: "Libellé", debit: "Débit", credit: "Crédit" };
const LARGEURS: Record<Colonne, string> = { date: "w-32", libelle: "min-w-[16rem]", debit: "w-32", credit: "w-32" };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  devise: string;
  /** Date proposée à la première ligne (ex. dernière opération du compte), au format JJ/MM/AAAA. */
  dateParDefaut: string;
  onAjouter: (mouvements: MouvementImport[]) => Promise<void>;
}

/**
 * Saisie rapide : une grille comme un tableur. Tab et Entrée passent à la cellule suivante, Entrée dans la dernière cellule ajoute une ligne
 * (qui reprend la date de la précédente), et un tableau copié depuis Excel se colle d'un coup.
 */
export function SaisieRapideDialog({ open, onOpenChange, devise, dateParDefaut, onAjouter }: Props) {
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const grille = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (open) setLignes(Array.from({ length: NB_LIGNES }, () => ligneVide(dateParDefaut)));
  }, [open, dateParDefaut]);

  const annee = useMemo(() => (/\d{4}$/.exec(dateParDefaut)?.[0] ?? String(new Date().getFullYear())), [dateParDefaut]);
  const lues = useMemo(() => lignes.map((l) => lireLigneSaisie(l, annee)), [lignes, annee]);
  const valides = lues.flatMap((r) => (r.etat === "ok" ? [r.mouvement] : []));
  const nbErreurs = lues.filter((r) => r.etat === "erreur").length;
  const debit = Math.round(valides.reduce((s, m) => s + m.debit, 0) * 1000) / 1000;
  const credit = Math.round(valides.reduce((s, m) => s + m.credit, 0) * 1000) / 1000;

  const cellule = (r: number, c: number) => grille.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`) ?? null;
  /** Déplace le curseur tout de suite (une cellule qui n'existe pas encore, sur une ligne ajoutée, est atteinte juste après son affichage). */
  const aller = (r: number, c: number) => {
    const existante = cellule(r, c);
    if (existante) existante.focus();
    else setTimeout(() => cellule(r, c)?.focus(), 0);
  };

  function modifier(r: number, colonne: Colonne, valeur: string) {
    setLignes((prev) => prev.map((l, i) => (i === r ? { ...l, [colonne]: valeur } : l)));
  }

  function ajouterLigne(apres: number) {
    setLignes((prev) => [...prev, ligneVide(prev[apres]?.date ?? dateParDefaut)]);
    aller(apres + 1, 0);
  }

  function touche(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (c < COLONNES.length - 1) aller(r, c + 1);
      else if (r < lignes.length - 1) aller(r + 1, 0);
      else ajouterLigne(r);
    } else if (e.key === "ArrowDown" && r < lignes.length - 1) {
      e.preventDefault();
      aller(r + 1, c);
    } else if (e.key === "ArrowUp" && r > 0) {
      e.preventDefault();
      aller(r - 1, c);
    }
  }

  function coller(e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    const texte = e.clipboardData.getData("text");
    if (!texte.includes("\t") && !texte.includes("\n")) return;
    e.preventDefault();
    setLignes((prev) => collerDansGrille(prev, texte, r, COLONNES[c]));
  }

  async function ajouter() {
    setEnvoi(true);
    try {
      await onAjouter(valides);
      onOpenChange(false);
    } catch {
      // erreur déjà affichée par le store
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Saisie rapide de mouvements</DialogTitle>
          <DialogDescription>
            Tab ou Entrée passe à la cellule suivante ; Entrée dans la dernière cellule ajoute une ligne qui reprend la date. Vous pouvez aussi coller un tableau copié depuis Excel
            (Date, Libellé, Débit, Crédit). Le type (frais, encaissement…) est déduit du libellé.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto rounded-md border border-border">
          <table ref={grille} className="w-full border-collapse text-xs" aria-label="Grille de saisie">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="w-8 px-2 py-1.5 text-center">#</th>
                {COLONNES.map((c) => (
                  <th key={c} className={cn("px-2 py-1.5", (c === "debit" || c === "credit") && "text-right")}>
                    {ENTETES[c]} {(c === "debit" || c === "credit") && <span className="font-normal text-muted-foreground">({devise})</span>}
                  </th>
                ))}
                <th className="px-2 py-1.5">Type</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, r) => {
                const lue = lues[r];
                return (
                  <tr key={r} className={cn("border-t border-border", lue.etat === "erreur" && "bg-destructive/5")}>
                    <td className="px-2 py-1 text-center text-muted-foreground tabular-nums">{r + 1}</td>
                    {COLONNES.map((colonne, c) => (
                      <td key={colonne} className="px-1 py-0.5">
                        <Input
                          data-cell={`${r}-${c}`}
                          value={l[colonne]}
                          inputMode={colonne === "debit" || colonne === "credit" ? "decimal" : undefined}
                          aria-label={`${ENTETES[colonne]}, ligne ${r + 1}`}
                          aria-invalid={lue.etat === "erreur" || undefined}
                          onChange={(e) => modifier(r, colonne, e.target.value)}
                          onKeyDown={(e) => touche(e, r, c)}
                          onPaste={(e) => coller(e, r, c)}
                          onFocus={(e) => e.target.select()}
                          className={cn("h-8 text-xs", LARGEURS[colonne], (colonne === "debit" || colonne === "credit") && "text-right tabular-nums")}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                      {lue.etat === "ok" ? TYPE_LABELS[lue.mouvement.type] : lue.etat === "erreur" ? <span className="font-medium text-destructive">{lue.erreur}</span> : ""}
                    </td>
                    <td className="px-1 py-1">
                      {!estVide(l) && (
                        <button type="button" aria-label={`Vider la ligne ${r + 1}`} onClick={() => setLignes((prev) => prev.map((x, i) => (i === r ? ligneVide(x.date) : x)))} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" onClick={() => ajouterLigne(lignes.length - 1)}>
            <Plus className="h-3.5 w-3.5" />
            Ajouter une ligne
          </Button>
          <p className="tabular-nums text-muted-foreground">
            <b className="text-foreground">{valides.length}</b> ligne{valides.length > 1 ? "s" : ""} valide{valides.length > 1 ? "s" : ""} — débit {fmtMontant(debit)}, crédit {fmtMontant(credit)} {devise}
            {nbErreurs > 0 && <span className="font-medium text-destructive"> · {nbErreurs} à corriger</span>}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="ledger" disabled={envoi || valides.length === 0 || nbErreurs > 0} onClick={() => void ajouter()}>
            {envoi ? "Ajout…" : `Ajouter ${valides.length} mouvement${valides.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
