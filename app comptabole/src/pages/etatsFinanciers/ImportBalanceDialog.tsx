import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBalances, type BalanceLigneInput } from "@/store/balances";
import { suggestAffectatFromCompte } from "@/lib/etatsFinanciers/pcgClassement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceId: string;
  societeId: string;
}

const HEADER_KEYS: Record<string, keyof BalanceLigneInput | "solde"> = {
  affectat: "affectat",
  affect: "affectat",
  compte: "compte",
  libelle: "libelle",
  libellé: "libelle",
  debit: "debit",
  débit: "debit",
  credit: "credit",
  crédit: "credit",
  solde: "solde",
};

function toNum(cell: unknown): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : 0;
  const s = String(cell ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Cherche la ligne d'en-tête dans les 10 premières lignes du fichier
 * (COMPTE est la seule colonne vraiment obligatoire pour la reconnaître). */
function parseRows(raw: unknown[][]): BalanceLigneInput[] {
  let headerIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i] ?? [];
    const map: Record<string, number> = {};
    row.forEach((cell, j) => {
      const key = HEADER_KEYS[normalize(String(cell ?? ""))];
      if (key) map[key] = j;
    });
    if (map.compte !== undefined) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const out: BalanceLigneInput[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const compte = String(row[colMap.compte] ?? "").trim();
    if (!compte) continue;
    out.push({
      compte,
      libelle: colMap.libelle !== undefined ? String(row[colMap.libelle] ?? "").trim() : "",
      debit: colMap.debit !== undefined ? toNum(row[colMap.debit]) : 0,
      credit: colMap.credit !== undefined ? toNum(row[colMap.credit]) : 0,
      affectat:
        colMap.affectat !== undefined ? String(row[colMap.affectat] ?? "").trim() : "",
    });
  }
  return out;
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ImportBalanceDialog({ open, onOpenChange, balanceId, societeId }: Props) {
  const grilleComptes = useBalances((s) => s.grilleComptes);
  const grilleComptesSociete = useBalances((s) => s.grilleComptesSociete);
  const replaceLignes = useBalances((s) => s.replaceLignes);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BalanceLigneInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  // Index des lignes dont l'AFFECTAT vient d'être deviné (classe du compte),
  // pas d'un import précédent confirmé par un comptable — à relire avant
  // de valider, marqué visuellement distinct des codes déjà « appris ».
  const [suggested, setSuggested] = useState<Set<number>>(new Set());
  // Lignes dont l'association compte -> AFFECTAT ne doit être apprise que
  // pour cette société (case à cocher), pas cabinet-wide.
  const [scoped, setScoped] = useState<Set<number>>(new Set());

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        toast.error("Aucune ligne reconnue — vérifiez qu'une colonne « Compte » existe.");
        return;
      }
      // Préremplissage AFFECTAT, par priorité : 1) override propre à cette
      // société (grille_comptes_societe) 2) grille apprise cabinet-wide
      // (comptes déjà rencontrés lors d'un import précédent, fiable)
      // 3) suggestion par classe de compte (Système Comptable des
      // Entreprises tunisien — voir pcgClassement.ts), à relire avant de
      // valider.
      const byCompteSociete = new Map(grilleComptesSociete.map((c) => [c.compte, c.affectatCode]));
      const byCompte = new Map(grilleComptes.map((c) => [c.compte, c.affectatCode]));
      const nextSuggested = new Set<number>();
      const nextScoped = new Set<number>();
      const preFilled = parsed.map((l, i) => {
        if (l.affectat) return l;
        const propreSociete = byCompteSociete.get(l.compte);
        if (propreSociete) {
          nextScoped.add(i);
          return { ...l, affectat: propreSociete };
        }
        const appris = byCompte.get(l.compte);
        if (appris) return { ...l, affectat: appris };
        const devine = suggestAffectatFromCompte(l.compte);
        if (devine) {
          nextSuggested.add(i);
          return { ...l, affectat: devine };
        }
        return l;
      });
      setRows(preFilled);
      setSuggested(nextSuggested);
      setScoped(nextScoped);
      setFileName(file.name);
    } catch {
      toast.error("Fichier illisible — export Excel (.xlsx) ou CSV attendu.");
    }
  }

  function updateAffectat(idx: number, value: string) {
    setRows((r) => (r ? r.map((l, i) => (i === idx ? { ...l, affectat: value } : l)) : r));
    setSuggested((s) => {
      if (!s.has(idx)) return s;
      const next = new Set(s);
      next.delete(idx);
      return next;
    });
  }

  function toggleScoped(idx: number) {
    setScoped((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function confirm() {
    if (!rows) return;
    setSaving(true);
    try {
      const withScope = rows.map((l, i) => ({ ...l, scopeSociete: scoped.has(i) }));
      await replaceLignes(balanceId, withScope, societeId);
      toast.success(`${rows.length} ligne(s) importée(s)`);
      close();
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setRows(null);
    setFileName("");
    setSuggested(new Set());
    setScoped(new Set());
    onOpenChange(false);
  }

  const nbSansCode = rows?.filter((r) => !r.affectat).length ?? 0;
  const nbSuggere = suggested.size;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Importer une balance</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : Compte, Libellé, Débit, Crédit, Affectat (SOLDE est
            recalculé automatiquement). Remplace toutes les lignes existantes de cet
            exercice. Cochez la case à droite d'un code pour que le changement ne
            s'applique qu'à ce dossier, sans modifier les autres sociétés.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <label className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-12 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              Cliquez pour choisir un fichier{" "}
              <span className="font-semibold underline underline-offset-2">.xlsx / .csv</span>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {fileName} · <b className="text-foreground">{rows.length}</b> ligne(s)
              </span>
              <span className="flex items-center gap-3">
                {nbSuggere > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                    <span className="h-[7px] w-[7px] rounded-full border border-accent" />
                    {nbSuggere} code(s) deviné(s) — à relire
                  </span>
                )}
                {nbSansCode > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="h-[7px] w-[7px] rounded-[2px] bg-warning" />
                    {nbSansCode} sans code AFFECTAT
                  </span>
                )}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Compte
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Libellé
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Débit
                    </th>
                    <th className="sticky top-0 border-b-2 border-foreground bg-card px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Crédit
                    </th>
                    <th className="sticky top-0 w-28 border-b-2 border-foreground bg-card px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Affectat
                    </th>
                    <th
                      className="sticky top-0 w-8 border-b-2 border-foreground bg-card px-1 py-2 text-center text-[0.66rem] font-bold text-muted-foreground"
                      title="Limiter le changement de code à ce dossier"
                    >
                      <span className="sr-only">Limiter à ce dossier</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        (i + 1) % 5 === 0
                          ? "border-b-[1.5px] border-rule-strong"
                          : "border-b border-border"
                      }
                    >
                      <td className="px-2 py-1.5 font-mono text-xs">{r.compte}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5">{r.libelle}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.debit ? fmt(r.debit) : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.credit ? fmt(r.credit) : ""}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={r.affectat}
                          onChange={(e) => updateAffectat(i, e.target.value.toUpperCase())}
                          placeholder="—"
                          title={suggested.has(i) ? "Code deviné à partir de la classe du compte — à relire" : undefined}
                          className={
                            "w-full rounded-[4px] border bg-card px-1.5 py-1 font-mono text-xs uppercase outline-none focus:border-accent " +
                            (suggested.has(i)
                              ? "border-accent/50 text-accent"
                              : "border-input")
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={scoped.has(i)}
                          onChange={() => toggleScoped(i)}
                          title="Limiter ce code à ce dossier uniquement (n'affecte pas les autres sociétés)"
                          className="h-3.5 w-3.5 cursor-pointer accent-accent"
                        />
                      </td>
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
              {saving ? "Import en cours…" : `Importer ${rows.length} ligne(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
