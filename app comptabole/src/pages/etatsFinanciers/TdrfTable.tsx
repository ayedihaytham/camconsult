import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt, resultatComptableAvantImpot } from "@/lib/etatsFinanciers/postes";
import { computeTdrf } from "@/lib/etatsFinanciers/tdrf";
import type { PostesExercice } from "@/store/balances";
import type { TdrfKind, TdrfLigne, TdrfParametres } from "@/types";
import { cn } from "@/lib/utils";

type ParamsInput = {
  chiffreAffairesLocal: number;
  chiffreAffairesExport: number;
  tauxImposition: number;
  tauxExport: number;
  tauxMinimum: number;
  plancherMinimum: number;
  contributionSociale: number;
  excedentsAcomptes: number;
};

/**
 * TDRF — Tableau de détermination du résultat fiscal (Annexe n°2, note
 * commune n°26/2016). Réintégrations/déductions : saisie libre (jugement
 * professionnel propre à chaque exercice, rien de tout ça n'est dans la
 * balance). Résultat fiscal = résultat comptable avant impôt +
 * réintégrations − déductions. La suite (IS/minimum d'impôt/CSS/impôts à
 * payer) applique le régime commun tunisien par défaut, avec taux et
 * plancher modifiables par exercice — voir computeTdrf().
 */
export function TdrfTable({
  exercices,
  lignes,
  parametres,
  onAdd,
  onUpdate,
  onRemove,
  onSaveParametres,
}: {
  exercices: PostesExercice[];
  lignes: TdrfLigne[];
  parametres: TdrfParametres[];
  onAdd: (exercice: string, kind: TdrfKind, libelle: string, montant: number) => void;
  onUpdate: (id: string, data: Partial<{ kind: TdrfKind; libelle: string; montant: number }>) => void;
  onRemove: (id: string) => void;
  onSaveParametres: (exercice: string, data: ParamsInput) => void;
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));

  return (
    <div className="space-y-6">
      {chrono.map((e) => (
        <TdrfExercice
          key={e.exercice}
          exercice={e.exercice}
          resultatComptable={resultatComptableAvantImpot(e.postes)}
          chiffreAffairesLocalSuggere={e.caLocalSuggere}
          chiffreAffairesExportSuggere={e.caExportSuggere}
          lignes={lignes.filter((l) => l.exercice === e.exercice)}
          params={parametres.find((p) => p.exercice === e.exercice) ?? null}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSaveParametres={onSaveParametres}
        />
      ))}
    </div>
  );
}

function TdrfExercice({
  exercice,
  resultatComptable,
  chiffreAffairesLocalSuggere,
  chiffreAffairesExportSuggere,
  lignes,
  params,
  onAdd,
  onUpdate,
  onRemove,
  onSaveParametres,
}: {
  exercice: string;
  resultatComptable: number;
  /** CA local/export suggéré depuis la balance (voir server/routes/balances.js
   * "/postes") — détecté par le libellé des comptes de ventes ("export" ou
   * non). Fiable seulement quand le client tient un compte de vente export
   * dédié pour cet exercice ; sinon tout tombe en local par défaut même si
   * l'activité est réellement exportatrice — à corriger à la main dans ce
   * cas (voir les Notes annexes de l'exercice, si disponibles). */
  chiffreAffairesLocalSuggere: number;
  chiffreAffairesExportSuggere: number;
  lignes: TdrfLigne[];
  params: TdrfParametres | null;
  onAdd: (exercice: string, kind: TdrfKind, libelle: string, montant: number) => void;
  onUpdate: (id: string, data: Partial<{ kind: TdrfKind; libelle: string; montant: number }>) => void;
  onRemove: (id: string) => void;
  onSaveParametres: (exercice: string, data: ParamsInput) => void;
}) {
  const reintegrations = lignes.filter((l) => l.kind === "reintegration");
  const deductions = lignes.filter((l) => l.kind === "deduction");

  // Régime partiellement exportateur détecté (CA export > 0) : taux réduits
  // par défaut (15 % / 10 %) au lieu du régime commun (20 % / 20 %) — reste
  // un point de départ, toujours modifiable.
  const regimeExportSuggere = chiffreAffairesExportSuggere > 0;

  const [chiffreAffairesLocal, setChiffreAffairesLocal] = useState(
    String(params?.chiffreAffairesLocal || chiffreAffairesLocalSuggere || ""),
  );
  const [chiffreAffairesExport, setChiffreAffairesExport] = useState(
    String(params?.chiffreAffairesExport || chiffreAffairesExportSuggere || ""),
  );
  const [tauxImposition, setTauxImposition] = useState(
    String((params?.tauxImposition ?? (regimeExportSuggere ? 0.15 : 0.2)) * 100),
  );
  const [tauxExport, setTauxExport] = useState(
    String((params?.tauxExport ?? (regimeExportSuggere ? 0.1 : 0.2)) * 100),
  );
  const [tauxMinimum, setTauxMinimum] = useState(String((params?.tauxMinimum ?? 0.002) * 100));
  const [plancherMinimum, setPlancherMinimum] = useState(String(params?.plancherMinimum ?? 500));
  const [contributionSociale, setContributionSociale] = useState(
    String(params?.contributionSociale || ""),
  );
  const [excedentsAcomptes, setExcedentsAcomptes] = useState(
    String(params?.excedentsAcomptes || ""),
  );

  // Persiste les valeurs suggérées (CA local/export depuis la balance, taux
  // réduits si régime export détecté) dès l'affichage si rien n'a encore été
  // saisi pour cet exercice — sinon l'export Excel/PDF (qui lit
  // tdrf_parametres côté serveur, pas cet écran) verrait des valeurs à 0.
  // Tout reste modifiable ensuite, sans exception.
  useEffect(() => {
    if (!params && (chiffreAffairesLocalSuggere || chiffreAffairesExportSuggere)) {
      onSaveParametres(exercice, {
        chiffreAffairesLocal: chiffreAffairesLocalSuggere,
        chiffreAffairesExport: chiffreAffairesExportSuggere,
        tauxImposition: regimeExportSuggere ? 0.15 : 0.2,
        tauxExport: regimeExportSuggere ? 0.1 : 0.2,
        tauxMinimum: 0.002,
        plancherMinimum: 500,
        contributionSociale: 0,
        excedentsAcomptes: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitParams() {
    onSaveParametres(exercice, {
      chiffreAffairesLocal: Number(chiffreAffairesLocal) || 0,
      chiffreAffairesExport: Number(chiffreAffairesExport) || 0,
      tauxImposition: (Number(tauxImposition) || 0) / 100,
      tauxExport: (Number(tauxExport) || 0) / 100,
      tauxMinimum: (Number(tauxMinimum) || 0) / 100,
      plancherMinimum: Number(plancherMinimum) || 0,
      contributionSociale: Number(contributionSociale) || 0,
      excedentsAcomptes: Number(excedentsAcomptes) || 0,
    });
  }

  const result = computeTdrf(resultatComptable, lignes, {
    chiffreAffairesLocal: Number(chiffreAffairesLocal) || 0,
    chiffreAffairesExport: Number(chiffreAffairesExport) || 0,
    tauxImposition: (Number(tauxImposition) || 0) / 100,
    tauxExport: (Number(tauxExport) || 0) / 100,
    tauxMinimum: (Number(tauxMinimum) || 0) / 100,
    plancherMinimum: Number(plancherMinimum) || 0,
    contributionSociale: Number(contributionSociale) || 0,
    excedentsAcomptes: Number(excedentsAcomptes) || 0,
  });

  return (
    <div>
      <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
        Exercice {exercice}
      </p>
      <LedgerSheet>
        <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-rule-strong px-[18px] py-2.5">
          <p className="text-sm text-foreground">Résultat comptable avant impôt</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {fmt(result.resultatComptable)}
          </p>
        </div>

        <LignesGroup
          titre="Réintégrations"
          kind="reintegration"
          exercice={exercice}
          lignes={reintegrations}
          total={result.totalReintegrations}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
        <LignesGroup
          titre="Déductions"
          kind="deduction"
          exercice={exercice}
          lignes={deductions}
          total={result.totalDeductions}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />

        <div className="flex items-center justify-between gap-3 border-t-2 border-foreground px-[18px] py-2.5">
          <p className="text-sm font-bold text-foreground">RÉSULTAT FISCAL (résultat imposable)</p>
          <p className="text-base font-bold tabular-nums text-foreground">{fmt(result.resultatFiscal)}</p>
        </div>

        <div className="border-t border-border px-[18px] py-2.5">
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Détermination de l'impôt
            <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold normal-case tracking-normal text-muted-foreground">
              Généré depuis la balance — à vérifier
            </span>
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Répartition local/export détectée via le libellé des comptes de vente (ex. « CA EXPORT… »)
            — fiable seulement si un compte export dédié existe pour cet exercice ; sinon tout tombe en
            local par défaut, même si l'activité est réellement exportatrice. Vérifiez et corrigez si besoin.
          </p>
          <table className="w-full text-sm">
            <tbody>
              <ParamRow
                label="Chiffre d'affaires local"
                value={chiffreAffairesLocal}
                onChange={setChiffreAffairesLocal}
                onBlur={commitParams}
              />
              <ParamRow
                label="Chiffre d'affaires export"
                value={chiffreAffairesExport}
                onChange={setChiffreAffairesExport}
                onBlur={commitParams}
              />
              <ParamRow
                label="Taux d'imposition (%)"
                value={tauxImposition}
                onChange={setTauxImposition}
                onBlur={commitParams}
              />
              <ParamRow
                label="Taux d'imposition — part export (%)"
                value={tauxExport}
                onChange={setTauxExport}
                onBlur={commitParams}
                help="régime partiellement exportateur courant : ~10 %"
              />
              <ParamRow
                label="Taux minimum d'impôt (%)"
                value={tauxMinimum}
                onChange={setTauxMinimum}
                onBlur={commitParams}
                help="porte uniquement sur le CA local"
              />
              <ParamRow
                label="Plancher du minimum d'impôt"
                value={plancherMinimum}
                onChange={setPlancherMinimum}
                onBlur={commitParams}
              />
              <ReadRow
                label="Impôt sur les sociétés (résultat imposable réparti local/export × taux respectifs)"
                value={result.isCalcule}
              />
              <ReadRow
                label="Minimum d'impôt (CA local × taux minimum, plancher inclus)"
                value={result.minimumImpot}
              />
              <ReadRow label="IMPÔTS SUR LES SOCIÉTÉS (le plus élevé des deux)" value={result.impotSocietes} bold />
              <ParamRow
                label="Contribution sociale de solidarité"
                value={contributionSociale}
                onChange={setContributionSociale}
                onBlur={commitParams}
              />
              <ParamRow
                label="Excédents et acomptes provisionnels imputables"
                value={excedentsAcomptes}
                onChange={setExcedentsAcomptes}
                onBlur={commitParams}
                negatif
              />
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t-2 border-foreground px-[18px] py-2.5">
          <div>
            <p className="text-sm font-bold text-foreground">IMPÔTS À PAYER / (REPORT)</p>
            {result.tauxEffectif !== null && (
              <p className="text-xs text-muted-foreground">
                Taux effectif d'imposition : {(result.tauxEffectif * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <p className="text-base font-bold tabular-nums text-foreground">{fmt(result.impotsAPayer)}</p>
        </div>
      </LedgerSheet>
    </div>
  );
}

function ParamRow({
  label,
  value,
  onChange,
  onBlur,
  negatif,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  negatif?: boolean;
  help?: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-1 pr-2 text-foreground">
        {label}
        {negatif && <span className="ml-1.5 text-xs text-muted-foreground">(en déduction)</span>}
        {help && <span className="ml-1.5 text-xs text-muted-foreground">({help})</span>}
      </td>
      <td className="w-32 py-1 text-right">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="0"
          className="ml-auto h-7 w-32 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
        />
      </td>
    </tr>
  );
}

function ReadRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={cn("py-1 pr-2", bold ? "font-bold text-foreground" : "text-muted-foreground")}>
        {label}
      </td>
      <td
        className={cn(
          "w-32 py-1 pr-2 text-right tabular-nums",
          bold ? "font-bold text-foreground" : "text-foreground",
        )}
      >
        {fmt(value)}
      </td>
    </tr>
  );
}

function LignesGroup({
  titre,
  kind,
  exercice,
  lignes,
  total,
  onAdd,
  onUpdate,
  onRemove,
}: {
  titre: string;
  kind: TdrfKind;
  exercice: string;
  lignes: TdrfLigne[];
  total: number;
  onAdd: (exercice: string, kind: TdrfKind, libelle: string, montant: number) => void;
  onUpdate: (id: string, data: Partial<{ libelle: string; montant: number }>) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");

  function submitAdd() {
    if (!libelle.trim()) return;
    onAdd(exercice, kind, libelle.trim(), Number(montant) || 0);
    setLibelle("");
    setMontant("");
    setAdding(false);
  }

  return (
    <div className="border-b border-border px-[18px] py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{titre}</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </button>
      </div>
      {lignes.length === 0 && !adding ? (
        <p className="py-1 text-sm text-muted-foreground">Aucune ligne</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {lignes.map((l, i) => (
              <LigneRow key={l.id} ligne={l} last={i === lignes.length - 1 && !adding} onUpdate={onUpdate} onRemove={onRemove} />
            ))}
            {adding && (
              <tr>
                <td className="py-1 pr-2">
                  <Input
                    autoFocus
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    placeholder="Libellé"
                    className="h-7"
                    onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  />
                </td>
                <td className="w-32 py-1 pr-2">
                  <Input
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="Montant"
                    className="h-7 text-right"
                    onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  />
                </td>
                <td className="w-[80px] py-1">
                  <div className="flex gap-1">
                    <Button variant="ledger" size="sm" className="h-7 px-2" onClick={submitAdd}>
                      OK
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setAdding(false);
                        setLibelle("");
                        setMontant("");
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {lignes.length > 0 && (
        <div className="mt-1 flex justify-end pr-[104px] text-sm font-semibold tabular-nums text-foreground">
          Total : {fmt(total)}
        </div>
      )}
    </div>
  );
}

function LigneRow({
  ligne,
  last,
  onUpdate,
  onRemove,
}: {
  ligne: TdrfLigne;
  last: boolean;
  onUpdate: (id: string, data: Partial<{ libelle: string; montant: number }>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr className={cn(!last && "border-b border-border")}>
      <td className="py-1 pr-2">
        <Input
          defaultValue={ligne.libelle}
          className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-1"
          onBlur={(e) => e.target.value !== ligne.libelle && onUpdate(ligne.id, { libelle: e.target.value })}
        />
      </td>
      <td className="w-32 py-1 pr-2">
        <Input
          defaultValue={String(ligne.montant)}
          className="h-7 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
          onBlur={(e) => {
            const v = Number(e.target.value) || 0;
            if (v !== ligne.montant) onUpdate(ligne.id, { montant: v });
          }}
        />
      </td>
      <td className="w-[80px] py-1 text-right">
        <button
          onClick={() => onRemove(ligne.id)}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
