import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";
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
import {
  parseBalanceAmount,
  parseBalanceRows,
  type AmountField,
  type BalanceImportRow,
} from "@/lib/etatsFinanciers/importBalance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceId: string;
  societeId: string;
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ImportBalanceDialog({ open, onOpenChange, balanceId, societeId }: Props) {
  const grilleComptes = useBalances((s) => s.grilleComptes);
  const grilleComptesSociete = useBalances((s) => s.grilleComptesSociete);
  const replaceLignes = useBalances((s) => s.replaceLignes);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BalanceImportRow[] | null>(null);
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
      const parsed = parseBalanceRows(raw);
      if (!parsed.headerFound || parsed.rows.length === 0) {
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
      const preFilled = parsed.rows.map((l, i) => {
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

  function updateAmount(idx: number, field: AmountField, raw: string) {
    setRows((current) => {
      if (!current) return current;
      return current.map((row, i) => {
        if (i !== idx) return row;
        const parsed = parseBalanceAmount(raw);
        const errors = { ...row.amountErrors };
        if (parsed.ok) delete errors[field];
        else errors[field] = `Montant ${field === "debit" ? "Débit" : "Crédit"} invalide ou ambigu.`;
        return {
          ...row,
          ...(parsed.ok ? { [field]: parsed.value } : {}),
          amountErrors: errors,
          ...(field === "debit"
            ? { debitRaw: parsed.ok ? undefined : raw }
            : { creditRaw: parsed.ok ? undefined : raw }),
        };
      });
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
    if (!rows || invalidAmountCount > 0 || saving) return;
    setSaving(true);
    try {
      const withScope: BalanceLigneInput[] = rows.map(
        ({ sourceRow: _sourceRow, amountErrors: _amountErrors, debitRaw: _debitRaw, creditRaw: _creditRaw, ...line }, i) => ({
          ...line,
          scopeSociete: scoped.has(i),
        }),
      );
      await replaceLignes(balanceId, withScope, societeId);
      toast.success(`${rows.length} ligne(s) importée(s)`);
      close();
    } catch {
      // The store reports the API error; retain the parsed preview for retry.
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
  const invalidAmountCount = rows?.reduce(
    (count, row) => count + Object.keys(row.amountErrors).length,
    0,
  ) ?? 0;

  function renderAmount(row: BalanceImportRow, index: number, field: AmountField) {
    const error = row.amountErrors[field];
    const raw = field === "debit" ? row.debitRaw : row.creditRaw;
    if (!error) return row[field] ? fmt(row[field]) : "";

    return (
      <div className="min-w-28 text-left">
        <label className="sr-only" htmlFor={`import-${field}-${row.sourceRow}`}>
          Corriger le montant {field === "debit" ? "Débit" : "Crédit"}, ligne {row.sourceRow}
        </label>
        <input
          id={`import-${field}-${row.sourceRow}`}
          inputMode="decimal"
          aria-invalid="true"
          aria-describedby={`import-${field}-${row.sourceRow}-error`}
          value={raw ?? ""}
          onChange={(event) => updateAmount(index, field, event.target.value)}
          className="h-8 w-full rounded-sm border border-destructive bg-background px-2 text-right text-xs tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p
          id={`import-${field}-${row.sourceRow}-error`}
          role="alert"
          className="mt-0.5 text-left text-[0.65rem] leading-tight text-destructive"
        >
          Ligne {row.sourceRow} · valeur invalide
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Importer une balance</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : Compte, Libellé, Débit, Crédit, Affectat (SOLDE est
            recalculé automatiquement). Cochez la case à droite d'un code pour que le changement
            ne s'applique qu'à ce dossier, sans modifier les autres sociétés.
          </DialogDescription>
        </DialogHeader>

        <p className="flex items-start gap-2 border-l-2 border-warning bg-warning/10 px-3 py-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <strong>Remplacement intégral :</strong> confirmer l'import remplacera toutes les
            lignes actuellement enregistrées pour cet exercice.
          </span>
        </p>

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
            {invalidAmountCount > 0 && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {invalidAmountCount} montant(s) à corriger avant de remplacer la balance.
              </p>
            )}
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
                      key={r.sourceRow}
                      className={
                        (i + 1) % 5 === 0
                          ? "border-b-[1.5px] border-rule-strong"
                          : "border-b border-border"
                      }
                    >
                      <td className="px-2 py-1.5 font-mono text-xs">{r.compte}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5">{r.libelle}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {renderAmount(r, i, "debit")}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {renderAmount(r, i, "credit")}
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
          <Button variant="outline" disabled={saving} onClick={close}>
            Annuler
          </Button>
          {rows && (
            <Button variant="ledger" disabled={saving || invalidAmountCount > 0} onClick={confirm}>
              {saving ? "Import en cours…" : `Importer ${rows.length} ligne(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
