import { useEffect, useRef, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { computeFlux, suggestEmpruntsMouvement, type FluxResult } from "@/lib/etatsFinanciers/flux";
import type { PostesExercice } from "@/store/balances";
import type { FinancementMouvement, ImmoMouvement } from "@/types";
import { cn } from "@/lib/utils";

const NA = "n/d";

interface FinState {
  capitalNumeraire: string;
  empruntsContractes: string;
  empruntsRembourses: string;
  dividendesDistribues: string;
  interetsCourusNonEchus: string;
}

const emptyFin = (): FinState => ({
  capitalNumeraire: "",
  empruntsContractes: "",
  empruntsRembourses: "",
  dividendesDistribues: "",
  interetsCourusNonEchus: "",
});

/**
 * Flux de trésorerie — un seul tableau, tous les exercices en colonnes côte
 * à côte (comme le document Excel de référence : Notes | 31/12/2021 |
 * 31/12/2020 | 31/12/2019), au lieu d'un tableau séparé par exercice. Les 5
 * champs saisissables (financement) gardent un état local par exercice pour
 * ne pas se perdre entre deux saisies.
 */
export function FluxTable({
  exercices,
  immoMouvements,
  financementMouvements,
  onSaveFinancement,
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  financementMouvements: FinancementMouvement[];
  onSaveFinancement: (
    exercice: string,
    data: {
      empruntsContractes: number;
      empruntsRembourses: number;
      dividendesDistribues: number;
      capitalNumeraire: number;
      interetsCourusNonEchus: number;
    },
  ) => void;
}) {
  const flux = computeFlux(exercices, immoMouvements, financementMouvements);

  const suggestions = new Map(
    flux.map((f) => {
      const hasSaved = financementMouvements.some((m) => m.exercice === f.exercice);
      const cur = exercices.find((e) => e.exercice === f.exercice);
      const prevEx =
        exercices
          .filter((e) => e.exercice < f.exercice)
          .sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ?? null;
      const suggestion =
        !hasSaved && cur
          ? suggestEmpruntsMouvement(
              cur.postesDebit,
              cur.postesCredit,
              prevEx?.postesDebit ?? null,
              prevEx?.postesCredit ?? null,
            )
          : null;
      return [f.exercice, suggestion];
    }),
  );

  const [fin, setFin] = useState<Record<string, FinState>>(() => buildFinState(flux, suggestions));

  // Ajoute l'état local des exercices apparus après le premier rendu (ex.
  // nouvel exercice créé pendant que cet onglet est ouvert) sans écraser ce
  // qui a déjà été saisi pour les exercices existants.
  useEffect(() => {
    setFin((prev) => {
      const missing = flux.filter((f) => !(f.exercice in prev));
      if (missing.length === 0) return prev;
      const next = { ...prev };
      for (const f of missing) {
        const sug = suggestions.get(f.exercice);
        next[f.exercice] = {
          capitalNumeraire: String(f.capitalNumeraire || ""),
          empruntsContractes: String((sug?.empruntsContractes ?? f.empruntsContractes) || ""),
          empruntsRembourses: String((sug?.empruntsRembourses ?? f.empruntsRembourses) || ""),
          dividendesDistribues: String(f.dividendesDistribues || ""),
          interetsCourusNonEchus: String(f.interetsCourusNonEchus || ""),
        };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flux.map((f) => f.exercice).join(",")]);

  // Bascule la suggestion (emprunts) en mouvement réellement enregistré dès
  // l'affichage, une seule fois par exercice — comme pour le TAB VAR Immob.
  const suggestedApplied = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const [exercice, suggestion] of suggestions) {
      if (!suggestion || suggestedApplied.current.has(exercice)) continue;
      suggestedApplied.current.add(exercice);
      onSaveFinancement(exercice, {
        capitalNumeraire: 0,
        empruntsContractes: suggestion.empruntsContractes,
        empruntsRembourses: suggestion.empruntsRembourses,
        dividendesDistribues: 0,
        interetsCourusNonEchus: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flux.map((f) => f.exercice).join(",")]);

  function updateField(exercice: string, field: keyof FinState, value: string) {
    setFin((s) => ({ ...s, [exercice]: { ...(s[exercice] ?? emptyFin()), [field]: value } }));
  }

  function commit(exercice: string) {
    const f = fin[exercice];
    if (!f) return;
    onSaveFinancement(exercice, {
      capitalNumeraire: Number(f.capitalNumeraire) || 0,
      empruntsContractes: Number(f.empruntsContractes) || 0,
      empruntsRembourses: Number(f.empruntsRembourses) || 0,
      dividendesDistribues: Number(f.dividendesDistribues) || 0,
      interetsCourusNonEchus: Number(f.interetsCourusNonEchus) || 0,
    });
  }

  if (flux.length === 0) return null;
  const nCols = 1 + flux.length;

  return (
    <LedgerSheet>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="border-b-2 border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground" />
            {flux.map((f) => (
              <th
                key={f.exercice}
                className="min-w-[120px] border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {f.exercice}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Flux de trésorerie liés à l'exploitation" nCols={nCols} />
          <ReadonlyRow label="Résultat net de l'exercice" flux={flux} get={(f) => f.resultatNet} />
          <SousTitreRow label="Ajustements pour :" nCols={nCols} />
          <ReadonlyRow
            label="Dotations aux amortissements et aux provisions"
            flux={flux}
            get={(f) => f.dotationsNettes}
            indent
          />
          <EditableRow
            label="Intérêts sur placements courus et non échus"
            flux={flux}
            fin={fin}
            field="interetsCourusNonEchus"
            onChange={updateField}
            onCommit={commit}
            indent
          />
          <SousTitreRow label="Variation des :" nCols={nCols} />
          <ReadonlyRow
            label="Clients et comptes rattachés"
            flux={flux}
            get={(f) => f.variationClients}
            indent
          />
          <ReadonlyRow label="Autres actifs" flux={flux} get={(f) => f.variationAutresActifs} indent />
          <ReadonlyRow
            label="Fournisseurs et autres dettes"
            flux={flux}
            get={(f) => f.variationFournisseursAutresDettes}
            indent
          />
          <ReadonlyRow
            label="Modifications comptables"
            flux={flux}
            get={(f) => f.variationModificationsComptables}
            indent
          />
          <TotalRow
            label="Flux de trésorerie provenant des opérations d'exploitation"
            flux={flux}
            get={(f) => f.fluxExploitation}
          />

          <SectionRow label="Flux de trésorerie liés à l'investissement" nCols={nCols} />
          <ReadonlyRow
            label="Acquisition / Cession d'immobilisations corporelles et incorporelles"
            flux={flux}
            get={(f) => f.acquisitionCessionImmoCorpIncorp}
          />
          <ReadonlyRow
            label="Acquisition / Cession d'immobilisations financières"
            flux={flux}
            get={(f) => f.acquisitionCessionImmoFin}
          />
          <TotalRow
            label="Flux de trésorerie affectés à des activités d'investissement"
            flux={flux}
            get={(f) => f.fluxInvestissement}
          />

          <SectionRow label="Flux de trésorerie liés aux activités de financement" nCols={nCols} />
          <ReadonlyRow label="Variation des placements" flux={flux} get={(f) => f.variationPlacements} />
          <EditableRow
            label="Encaissement suite à une augmentation de capital"
            flux={flux}
            fin={fin}
            field="capitalNumeraire"
            onChange={updateField}
            onCommit={commit}
          />
          <EditableRow
            label="Distribution de dividendes"
            flux={flux}
            fin={fin}
            field="dividendesDistribues"
            onChange={updateField}
            onCommit={commit}
          />
          <EditableRow
            label="Emprunts contractés"
            flux={flux}
            fin={fin}
            field="empruntsContractes"
            onChange={updateField}
            onCommit={commit}
          />
          <EditableRow
            label="Remboursements d'emprunts"
            flux={flux}
            fin={fin}
            field="empruntsRembourses"
            onChange={updateField}
            onCommit={commit}
          />
          <TotalRow
            label="Flux de trésorerie affecté à des activités de financement"
            flux={flux}
            get={(f) => f.fluxFinancement}
          />

          <tr>
            <td colSpan={nCols} className="border-t-2 border-foreground" />
          </tr>
          <TotalRow label="VARIATION DE TRÉSORERIE" flux={flux} get={(f) => f.variationTresorerie} big />
          <ReadonlyRow
            label="Trésorerie au début de l'exercice"
            flux={flux}
            get={(f) => f.tresorerieOuverture}
          />
          <TotalRow
            label="Trésorerie à la clôture de l'exercice"
            flux={flux}
            get={(f) => f.tresorerieCloture}
            big
          />
        </tbody>
      </table>
    </LedgerSheet>
  );
}

function buildFinState(
  flux: FluxResult[],
  suggestions: Map<string, { empruntsContractes: number; empruntsRembourses: number } | null>,
): Record<string, FinState> {
  const out: Record<string, FinState> = {};
  for (const f of flux) {
    const sug = suggestions.get(f.exercice);
    out[f.exercice] = {
      capitalNumeraire: String(f.capitalNumeraire || ""),
      empruntsContractes: String((sug?.empruntsContractes ?? f.empruntsContractes) || ""),
      empruntsRembourses: String((sug?.empruntsRembourses ?? f.empruntsRembourses) || ""),
      dividendesDistribues: String(f.dividendesDistribues || ""),
      interetsCourusNonEchus: String(f.interetsCourusNonEchus || ""),
    };
  }
  return out;
}

function SectionRow({ label, nCols }: { label: string; nCols: number }) {
  return (
    <tr>
      <td
        colSpan={nCols}
        className="bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground"
      >
        {label}
      </td>
    </tr>
  );
}

function SousTitreRow({ label, nCols }: { label: string; nCols: number }) {
  return (
    <tr>
      <td colSpan={nCols} className="px-[18px] pt-2 text-sm text-foreground">
        {label}
      </td>
    </tr>
  );
}

function ReadonlyRow({
  label,
  flux,
  get,
  indent,
}: {
  label: string;
  flux: FluxResult[];
  get: (f: FluxResult) => number | null;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-border">
      <td className={cn("px-[18px] py-1.5 text-foreground", indent && "pl-8 text-muted-foreground")}>
        {label}
      </td>
      {flux.map((f) => {
        const v = get(f);
        return (
          <td key={f.exercice} className="px-3 py-1.5 text-right tabular-nums">
            {v === null ? NA : fmt(v)}
          </td>
        );
      })}
    </tr>
  );
}

function TotalRow({
  label,
  flux,
  get,
  big,
}: {
  label: string;
  flux: FluxResult[];
  get: (f: FluxResult) => number | null;
  big?: boolean;
}) {
  return (
    <tr className={cn("border-t border-border", big && "border-t-2 border-foreground")}>
      <td className={cn("px-[18px] py-1.5 font-bold text-foreground", big && "py-2 text-base")}>
        {label}
      </td>
      {flux.map((f) => {
        const v = get(f);
        return (
          <td
            key={f.exercice}
            className={cn(
              "px-3 py-1.5 text-right font-bold tabular-nums text-foreground",
              big && "py-2 text-base",
            )}
          >
            {v === null ? NA : fmt(v)}
          </td>
        );
      })}
    </tr>
  );
}

function EditableRow({
  label,
  flux,
  fin,
  field,
  onChange,
  onCommit,
  indent,
}: {
  label: string;
  flux: FluxResult[];
  fin: Record<string, FinState>;
  field: keyof FinState;
  onChange: (exercice: string, field: keyof FinState, value: string) => void;
  onCommit: (exercice: string) => void;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-border">
      <td className={cn("px-[18px] py-1 text-foreground", indent && "pl-8 text-muted-foreground")}>
        {label}
      </td>
      {flux.map((f) => (
        <td key={f.exercice} className="px-2 py-1 text-right">
          <Input
            value={fin[f.exercice]?.[field] ?? ""}
            onChange={(e) => onChange(f.exercice, field, e.target.value)}
            onBlur={() => onCommit(f.exercice)}
            placeholder="0"
            className="ml-auto h-7 w-28 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
          />
        </td>
      ))}
    </tr>
  );
}
