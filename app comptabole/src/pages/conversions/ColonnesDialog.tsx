import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apercuColonnes, ROLES_COLONNES, type ColonnesChoisies, type PdfTextItem, type RoleColonne } from "@/lib/pdfToTables";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pages: PdfTextItem[][];
  onValider: (choix: ColonnesChoisies) => void;
}

const CLE = (n: number) => `conversion:colonnes:${n}`;

/** Rôle probable d'une colonne d'après son intitulé. */
function devine(entete: string): RoleColonne {
  const t = entete.toLowerCase();
  if (/^date|jour/.test(t)) return "date";
  if (/libell|op[ée]ration|d[ée]sign|d[ée]tail|description|intitul/.test(t)) return "libelle";
  if (/d[ée]bit|sortie|retrait|withdraw/.test(t)) return "debit";
  if (/cr[ée]dit|entr[ée]e|versement|deposit/.test(t)) return "credit";
  if (/solde|total|balance/.test(t)) return "solde";
  if (/r[ée]f/.test(t)) return "reference";
  return "";
}

function dernierChoix(n: number): RoleColonne[] | null {
  try {
    const brut = window.localStorage.getItem(CLE(n));
    const roles = brut ? (JSON.parse(brut) as RoleColonne[]) : null;
    return Array.isArray(roles) && roles.length === n ? roles : null;
  } catch {
    return null;
  }
}

/** Assistant « Indiquer les colonnes » : pour un relevé dont l'en-tête n'est pas reconnu, l'utilisateur dit ce que contient chaque colonne,
 * le choix est ensuite appliqué à toutes les pages (et retenu pour le prochain relevé de même forme). */
export function ColonnesDialog({ open, onOpenChange, pages, onValider }: Props) {
  const apercu = useMemo(() => (open ? apercuColonnes(pages) : null), [open, pages]);
  const [roles, setRoles] = useState<RoleColonne[]>([]);

  useEffect(() => {
    if (!apercu) return;
    setRoles(dernierChoix(apercu.bandes.length) ?? apercu.bandes.map((_, i) => devine(apercu.exemple[0]?.[i] ?? "")));
  }, [apercu]);

  const aDate = roles.includes("date");
  const aMontant = roles.includes("debit") || roles.includes("credit");

  function valider() {
    if (!apercu) return;
    try {
      window.localStorage.setItem(CLE(apercu.bandes.length), JSON.stringify(roles));
    } catch {
      // mémoire du navigateur indisponible : le choix vaut pour ce fichier seulement
    }
    onValider({ bandes: apercu.bandes, roles });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Indiquer les colonnes du relevé</DialogTitle>
          <DialogDescription>
            Pour chaque colonne, choisissez ce qu'elle contient. Le choix est appliqué à toutes les pages et retenu pour le prochain relevé de même forme. Le contrôle des soldes dit ensuite si les montants sont justes.
          </DialogDescription>
        </DialogHeader>

        {!apercu ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune ligne datée n'a été trouvée dans ce document : il n'est pas un relevé que l'on peut lire par colonnes. S'il est scanné, relancez la lecture par reconnaissance de caractères.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  {apercu.bandes.map((_, i) => (
                    <th key={i} className="border-b border-border p-1.5 text-left font-normal">
                      <select
                        value={roles[i] ?? ""}
                        onChange={(e) => setRoles((r) => r.map((v, k) => (k === i ? (e.target.value as RoleColonne) : v)))}
                        aria-label={`Contenu de la colonne ${i + 1}`}
                        className="h-9 w-full rounded-md border border-input bg-card px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {ROLES_COLONNES.map((r) => (
                          <option key={r.valeur} value={r.valeur}>
                            {r.nom}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apercu.exemple.map((ligne, n) => (
                  <tr key={n} className="border-b border-border last:border-0">
                    {ligne.map((c, i) => (
                      <td key={i} className="max-w-[220px] truncate px-2 py-1.5 tabular-nums" title={c}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {apercu && !aDate && <p role="alert" className="text-sm text-destructive">Indiquez la colonne « Date » : elle repère les opérations.</p>}
        {apercu && aDate && !aMontant && <p role="alert" className="text-sm text-destructive">Indiquez au moins une colonne « Débit » ou « Crédit ».</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="ledger" disabled={!apercu || !aDate || !aMontant} onClick={valider}>
            Utiliser ces colonnes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
