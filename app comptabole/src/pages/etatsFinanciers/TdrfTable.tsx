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

type ParamsInput = Omit<TdrfParametres, "societeId" | "exercice" | "majLe">;

const FIELD_LABELS: Partial<Record<keyof ParamsInput, string>> = {
  pertesChangeNonRealisees: "1.10 Pertes de change non réalisées",
  gainsChangeNonRealisesAnterieurs: "1.11 Gains de change non réalisés antérieurement non imposés",
  remunerationsExcedentairesTitres: "1.12 Rémunérations excédentaires des titres participatifs et des comptes courants associés",
  chargesEspeces5000: "1.13 Charges d'une valeur ≥ 5.000 dinars payée en espèces",
  moinsValueCessionTitresOpcvm: "1.14 Moins-value de cession des titres d'OPCVM dans la limite des dividendes distribués",
  impotsDirectsLieuAutrui: "1.15 Impôts directs supportés au lieu et place d'autrui",
  taxeVoyage: "1.16 Taxe de voyage",
  transactionsAmendesPenalites: "1.17 Transactions, amendes, confiscations et pénalités non déductibles",
  depensesEssaimage: "1.18 Dépenses excédentaires engagées pour la réalisation des opérations d'essaimage",
  facturesNonParvenues: "1.19 Factures non parvenues",
  amortissementsBiensReevalues: "2.1 Amortissements non déductibles relatifs aux biens réévalués",
  provisionsNonDeductibles: "3.1 Provisions non déductibles",
  provisionsCreancesDouteusesReintegrees:
    "3.2 Provisions pour créances douteuses (autres que celles constituées par les établissements de crédit)",
  produitsEtranger: "Produits réalisés par les établissements situés à l'étranger",
  provisionsCreancesDouteuses: "Provisions pour créances douteuses",
  provisionsDeprecStocksVente: "Provisions pour dépréciation des stocks destinés à la vente",
  provisionsDeprecActionsCotees: "Provisions pour dépréciation de la valeur des actions cotées à la bourse",
  provisionsNonExigibiliteEngagements: "Provisions pour non exigibilité des engagements techniques (assurances)",
  moinsValueLeveeOption: "Moins-value de la levée d'option de souscription/acquisition",
  reintegrationAmortissementsExercice: "Réintégration des amortissements de l'exercice",
  deductionDeficitsReportes: "Déduction des déficits reportés",
  deductionAmortissementsExercice: "Déduction des amortissements de l'exercice",
  deductionAmortissementsDifferes: "Déduction des amortissements différés en périodes déficitaires",
  interetsDepotsTitresDevises: "Intérêts des dépôts et titres en devises ou en dinars convertibles",
};

const DEFAULT_PARAMS: ParamsInput = {
  chiffreAffairesLocal: 0,
  chiffreAffairesExport: 0,
  tauxImposition: 0.2,
  tauxExport: 0.2,
  tauxMinimum: 0.002,
  plancherMinimum: 500,
  contributionSociale: 0,
  excedentsAcomptes: 0,
  pertesChangeNonRealisees: 0,
  gainsChangeNonRealisesAnterieurs: 0,
  remunerationsExcedentairesTitres: 0,
  chargesEspeces5000: 0,
  moinsValueCessionTitresOpcvm: 0,
  impotsDirectsLieuAutrui: 0,
  taxeVoyage: 0,
  transactionsAmendesPenalites: 0,
  depensesEssaimage: 0,
  facturesNonParvenues: 0,
  amortissementsBiensReevalues: 0,
  provisionsNonDeductibles: 0,
  provisionsCreancesDouteusesReintegrees: 0,
  produitsEtranger: 0,
  provisionsCreancesDouteuses: 0,
  provisionsDeprecStocksVente: 0,
  provisionsDeprecActionsCotees: 0,
  provisionsNonExigibiliteEngagements: 0,
  moinsValueLeveeOption: 0,
  reintegrationAmortissementsExercice: 0,
  deductionDeficitsReportes: 0,
  deductionAmortissementsExercice: 0,
  deductionAmortissementsDifferes: 0,
  interetsDepotsTitresDevises: 0,
  excedentsAnterieurs: 0,
  acomptesProvisionnelsPayes: 0,
  retenueALaSource: 0,
  avanceIrppImport: 0,
};

/**
 * TDRF — Tableau de détermination du résultat fiscal (Annexe n°2, note
 * commune n°26/2016). Reproduit l'enchaînement exact du formulaire officiel :
 * réintégrations standard (charges non déductibles/amortissements/
 * provisions) puis une cascade de déductions plafonnées (provisions ≤ 50% du
 * résultat, moins-value de levée d'option ≤ 5%) jusqu'au résultat imposable,
 * puis IS/minimum d'impôt/CSS/impôts à payer. "Autres réintégrations" /
 * "Autres déductions" (tdrf_lignes, texte libre) restent disponibles pour
 * tout ce que le formulaire standard ne prévoit pas.
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
  chiffreAffairesLocalSuggere: number;
  chiffreAffairesExportSuggere: number;
  lignes: TdrfLigne[];
  params: TdrfParametres | null;
  onAdd: (exercice: string, kind: TdrfKind, libelle: string, montant: number) => void;
  onUpdate: (id: string, data: Partial<{ kind: TdrfKind; libelle: string; montant: number }>) => void;
  onRemove: (id: string) => void;
  onSaveParametres: (exercice: string, data: ParamsInput) => void;
}) {
  const reintegrationsLibres = lignes.filter((l) => l.kind === "reintegration");
  const deductionsLibres = lignes.filter((l) => l.kind === "deduction");

  const regimeExportSuggere = chiffreAffairesExportSuggere > 0;

  const [form, setForm] = useState<Record<keyof ParamsInput, string>>(() =>
    toFormState({
      ...DEFAULT_PARAMS,
      ...params,
      chiffreAffairesLocal: params?.chiffreAffairesLocal || chiffreAffairesLocalSuggere || 0,
      chiffreAffairesExport: params?.chiffreAffairesExport || chiffreAffairesExportSuggere || 0,
      tauxImposition: params?.tauxImposition ?? (regimeExportSuggere ? 0.15 : 0.2),
      tauxExport: params?.tauxExport ?? (regimeExportSuggere ? 0.1 : 0.2),
    }),
  );

  // Persiste les valeurs suggérées (CA local/export depuis la balance, taux
  // réduits si régime export détecté) dès l'affichage si rien n'a encore été
  // saisi — sinon l'export Excel/PDF verrait des valeurs à 0. Tout reste
  // modifiable ensuite.
  useEffect(() => {
    if (!params && (chiffreAffairesLocalSuggere || chiffreAffairesExportSuggere)) {
      onSaveParametres(exercice, {
        ...DEFAULT_PARAMS,
        chiffreAffairesLocal: chiffreAffairesLocalSuggere,
        chiffreAffairesExport: chiffreAffairesExportSuggere,
        tauxImposition: regimeExportSuggere ? 0.15 : 0.2,
        tauxExport: regimeExportSuggere ? 0.1 : 0.2,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(field: keyof ParamsInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function commit() {
    onSaveParametres(exercice, fromFormState(form));
  }

  const parsed = fromFormState(form);
  const result = computeTdrf(resultatComptable, lignes, parsed);

  return (
    <div>
      <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
        Exercice {exercice}
      </p>
      <LedgerSheet>
        <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-rule-strong px-[18px] py-2.5">
          <p className="text-sm text-foreground">Résultat comptable avant impôt</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(resultatComptable)}</p>
        </div>

        {/* ── Réintégrations ── */}
        <Section titre="Réintégrations — Charges non déductibles">
          {(
            [
              "pertesChangeNonRealisees",
              "gainsChangeNonRealisesAnterieurs",
              "remunerationsExcedentairesTitres",
              "chargesEspeces5000",
              "moinsValueCessionTitresOpcvm",
              "impotsDirectsLieuAutrui",
              "taxeVoyage",
              "transactionsAmendesPenalites",
              "depensesEssaimage",
              "facturesNonParvenues",
            ] as const
          ).map((f) => (
            <ParamRow key={f} label={FIELD_LABELS[f]!} value={form[f]} onChange={(v) => setField(f, v)} onBlur={commit} />
          ))}
        </Section>
        <Section titre="Réintégrations — Amortissements">
          <ParamRow
            label={FIELD_LABELS.amortissementsBiensReevalues!}
            value={form.amortissementsBiensReevalues}
            onChange={(v) => setField("amortissementsBiensReevalues", v)}
            onBlur={commit}
          />
        </Section>
        <Section titre="Réintégrations — Provisions">
          <ParamRow
            label={FIELD_LABELS.provisionsNonDeductibles!}
            value={form.provisionsNonDeductibles}
            onChange={(v) => setField("provisionsNonDeductibles", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.provisionsCreancesDouteusesReintegrees!}
            value={form.provisionsCreancesDouteusesReintegrees}
            onChange={(v) => setField("provisionsCreancesDouteusesReintegrees", v)}
            onBlur={commit}
          />
        </Section>
        <LignesGroup
          titre="Autres réintégrations"
          kind="reintegration"
          exercice={exercice}
          lignes={reintegrationsLibres}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
        <Milestone label="TOTAL RÉINTÉGRATIONS" value={result.totalReintegrations} />

        {/* ── Déductions (cascade à plafonds) ── */}
        <Section titre="Déductions">
          <ParamRow
            label={FIELD_LABELS.produitsEtranger!}
            value={form.produitsEtranger}
            onChange={(v) => setField("produitsEtranger", v)}
            onBlur={commit}
          />
        </Section>
        <Milestone
          label="Résultat fiscal avant déduction des provisions (code B/P)"
          value={result.resultatFiscalAvantDeductionProvisions}
        />

        <Section titre="Déduction des provisions (plafonnée à 50% du résultat fiscal)">
          <ParamRow
            label={FIELD_LABELS.provisionsCreancesDouteuses!}
            value={form.provisionsCreancesDouteuses}
            onChange={(v) => setField("provisionsCreancesDouteuses", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.provisionsDeprecStocksVente!}
            value={form.provisionsDeprecStocksVente}
            onChange={(v) => setField("provisionsDeprecStocksVente", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.provisionsDeprecActionsCotees!}
            value={form.provisionsDeprecActionsCotees}
            onChange={(v) => setField("provisionsDeprecActionsCotees", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.provisionsNonExigibiliteEngagements!}
            value={form.provisionsNonExigibiliteEngagements}
            onChange={(v) => setField("provisionsNonExigibiliteEngagements", v)}
            onBlur={commit}
          />
          <ReadRow label={`Plafond (50%)`} value={result.plafondProvisions} />
          <ReadRow label="Provisions déductibles (plafonnées)" value={result.provisionsDeductibles} />
        </Section>
        <Milestone
          label="Résultat fiscal après déduction des provisions (code B/P)"
          value={result.resultatFiscalApresProvisions}
        />

        <Section titre="Déduction de la moins-value de levée d'option (plafonnée à 5% du résultat)">
          <ParamRow
            label={FIELD_LABELS.moinsValueLeveeOption!}
            value={form.moinsValueLeveeOption}
            onChange={(v) => setField("moinsValueLeveeOption", v)}
            onBlur={commit}
          />
          <ReadRow label="Plafond (5%)" value={result.plafondMoinsValueLeveeOption} />
          <ReadRow label="Déductible (plafonnée)" value={result.moinsValueLeveeOptionDeductible} />
        </Section>
        <Milestone
          label="Résultat fiscal avant déduction des déficits et amortissements"
          value={result.resultatFiscalAvantDeficitsAmortissements}
        />

        <Section titre="Amortissements différés et déficits reportés">
          <ParamRow
            label={FIELD_LABELS.reintegrationAmortissementsExercice!}
            value={form.reintegrationAmortissementsExercice}
            onChange={(v) => setField("reintegrationAmortissementsExercice", v)}
            onBlur={commit}
            help="s'ajoute au résultat"
          />
          <ParamRow
            label={FIELD_LABELS.deductionDeficitsReportes!}
            value={form.deductionDeficitsReportes}
            onChange={(v) => setField("deductionDeficitsReportes", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.deductionAmortissementsExercice!}
            value={form.deductionAmortissementsExercice}
            onChange={(v) => setField("deductionAmortissementsExercice", v)}
            onBlur={commit}
          />
          <ParamRow
            label={FIELD_LABELS.deductionAmortissementsDifferes!}
            value={form.deductionAmortissementsDifferes}
            onChange={(v) => setField("deductionAmortissementsDifferes", v)}
            onBlur={commit}
          />
        </Section>
        <Milestone
          label="Résultat fiscal après déduction des déficits et amortissements (B/P)"
          value={result.resultatFiscalApresDeficitsAmortissements}
        />

        <Section titre="Déduction des bénéfices ou revenus exceptionnels non imposables">
          <ParamRow
            label={FIELD_LABELS.interetsDepotsTitresDevises!}
            value={form.interetsDepotsTitresDevises}
            onChange={(v) => setField("interetsDepotsTitresDevises", v)}
            onBlur={commit}
          />
        </Section>
        <LignesGroup
          titre="Autres déductions"
          kind="deduction"
          exercice={exercice}
          lignes={deductionsLibres}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />

        <div className="flex items-center justify-between gap-3 border-t-2 border-foreground px-[18px] py-2.5">
          <p className="text-sm font-bold text-foreground">RÉSULTAT IMPOSABLE</p>
          <p className="text-base font-bold tabular-nums text-foreground">{fmt(result.resultatImposable)}</p>
        </div>

        <div className="border-t border-border px-[18px] py-2.5">
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Détermination de l'impôt
            <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold normal-case tracking-normal text-muted-foreground">
              CA généré depuis la balance — à vérifier
            </span>
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Répartition local/export détectée via le libellé des comptes de vente (ex. « CA EXPORT… »)
            — fiable seulement si un compte export dédié existe pour cet exercice.
          </p>
          <table className="w-full text-sm">
            <tbody>
              <ParamRow label="Chiffre d'affaires local" value={form.chiffreAffairesLocal} onChange={(v) => setField("chiffreAffairesLocal", v)} onBlur={commit} />
              <ParamRow label="Chiffre d'affaires export" value={form.chiffreAffairesExport} onChange={(v) => setField("chiffreAffairesExport", v)} onBlur={commit} />
              <ParamRow label="Taux d'imposition (%)" value={form.tauxImposition} onChange={(v) => setField("tauxImposition", v)} onBlur={commit} isPercent />
              <ParamRow label="Taux d'imposition — part export (%)" value={form.tauxExport} onChange={(v) => setField("tauxExport", v)} onBlur={commit} isPercent help="régime partiellement exportateur courant : ~10 %" />
              <ParamRow label="Taux minimum d'impôt (%)" value={form.tauxMinimum} onChange={(v) => setField("tauxMinimum", v)} onBlur={commit} isPercent help="porte uniquement sur le CA local" />
              <ParamRow label="Plancher du minimum d'impôt" value={form.plancherMinimum} onChange={(v) => setField("plancherMinimum", v)} onBlur={commit} />
              <ReadRow label="Impôt sur les sociétés (résultat imposable réparti local/export × taux respectifs)" value={result.isCalcule} />
              <ReadRow label="Minimum d'impôt (CA local × taux minimum, plancher inclus)" value={result.minimumImpot} />
              <ReadRow label="IMPÔTS SUR LES SOCIÉTÉS (le plus élevé des deux)" value={result.impotSocietes} bold />
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-[18px] py-2.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Contribution sociale de solidarité
          </p>
          <table className="w-full text-sm">
            <tbody>
              <ParamRow label="Contribution sociale de solidarité" value={form.contributionSociale} onChange={(v) => setField("contributionSociale", v)} onBlur={commit} />
              <ParamRow label="Excédents et acomptes provisionnels imputables" value={form.excedentsAcomptes} onChange={(v) => setField("excedentsAcomptes", v)} onBlur={commit} negatif />
              <ParamRow label="Excédents antérieurs" value={form.excedentsAnterieurs} onChange={(v) => setField("excedentsAnterieurs", v)} onBlur={commit} negatif />
              <ParamRow label="Acomptes provisionnels payés" value={form.acomptesProvisionnelsPayes} onChange={(v) => setField("acomptesProvisionnelsPayes", v)} onBlur={commit} negatif />
              <ParamRow label="Retenue à la source" value={form.retenueALaSource} onChange={(v) => setField("retenueALaSource", v)} onBlur={commit} negatif />
              <ParamRow label="Avance IRPP sur import" value={form.avanceIrppImport} onChange={(v) => setField("avanceIrppImport", v)} onBlur={commit} negatif />
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

function toFormState(p: ParamsInput): Record<keyof ParamsInput, string> {
  const out = {} as Record<keyof ParamsInput, string>;
  for (const k of Object.keys(DEFAULT_PARAMS) as (keyof ParamsInput)[]) {
    const v = p[k];
    if (k === "tauxImposition" || k === "tauxExport" || k === "tauxMinimum") {
      out[k] = String((v || 0) * 100);
    } else {
      out[k] = String(v || "");
    }
  }
  return out;
}

function fromFormState(form: Record<keyof ParamsInput, string>): ParamsInput {
  const out = {} as ParamsInput;
  for (const k of Object.keys(DEFAULT_PARAMS) as (keyof ParamsInput)[]) {
    const n = Number(form[k]) || 0;
    out[k] = k === "tauxImposition" || k === "tauxExport" || k === "tauxMinimum" ? n / 100 : n;
  }
  return out;
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-[18px] py-2.5">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{titre}</p>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Milestone({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-rule-strong bg-muted px-[18px] py-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(value)}</p>
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
  isPercent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  negatif?: boolean;
  help?: string;
  isPercent?: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-1 pr-2 text-foreground">
        {label}
        {negatif && <span className="ml-1.5 text-xs text-muted-foreground">(en déduction)</span>}
        {isPercent && <span className="ml-1.5 text-xs text-muted-foreground">(%)</span>}
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
      <td className={cn("py-1 pr-2", bold ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</td>
      <td className={cn("w-32 py-1 pr-2 text-right tabular-nums", bold ? "font-bold text-foreground" : "text-foreground")}>
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
  onAdd,
  onUpdate,
  onRemove,
}: {
  titre: string;
  kind: TdrfKind;
  exercice: string;
  lignes: TdrfLigne[];
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
