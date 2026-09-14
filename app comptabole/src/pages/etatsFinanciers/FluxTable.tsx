import { useEffect, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { computeFlux, suggestEmpruntsMouvement, type FluxResult } from "@/lib/etatsFinanciers/flux";
import type { PostesExercice } from "@/store/balances";
import type { FinancementMouvement, ImmoMouvement } from "@/types";
import { cn } from "@/lib/utils";

const NA = "n/d";

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

  return (
    <div className="space-y-6">
      {flux.map((f) => {
        const hasSaved = financementMouvements.some((m) => m.exercice === f.exercice);
        const cur = exercices.find((e) => e.exercice === f.exercice);
        const prevEx =
          exercices.filter((e) => e.exercice < f.exercice).sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ??
          null;
        const suggestion =
          !hasSaved && cur
            ? suggestEmpruntsMouvement(
                cur.postesDebit,
                cur.postesCredit,
                prevEx?.postesDebit ?? null,
                prevEx?.postesCredit ?? null,
              )
            : null;
        return (
          <FluxExercice key={f.exercice} flux={f} suggestion={suggestion} onSaveFinancement={onSaveFinancement} />
        );
      })}
    </div>
  );
}

function FluxExercice({
  flux: f,
  suggestion,
  onSaveFinancement,
}: {
  flux: FluxResult;
  /** Emprunts contractés/remboursés suggérés depuis la balance (voir
   * suggestEmpruntsMouvement) — préremplissage modifiable quand rien n'a
   * encore été saisi pour cet exercice. */
  suggestion?: { empruntsContractes: number; empruntsRembourses: number } | null;
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
  const [capitalNumeraire, setCapitalNumeraire] = useState(String(f.capitalNumeraire || ""));
  const [empruntsContractes, setEmpruntsContractes] = useState(
    String((suggestion?.empruntsContractes ?? f.empruntsContractes) || ""),
  );
  const [empruntsRembourses, setEmpruntsRembourses] = useState(
    String((suggestion?.empruntsRembourses ?? f.empruntsRembourses) || ""),
  );
  const [dividendesDistribues, setDividendesDistribues] = useState(
    String(f.dividendesDistribues || ""),
  );
  const [interetsCourusNonEchus, setInteretsCourusNonEchus] = useState(
    String(f.interetsCourusNonEchus || ""),
  );

  function commit() {
    onSaveFinancement(f.exercice, {
      capitalNumeraire: Number(capitalNumeraire) || 0,
      empruntsContractes: Number(empruntsContractes) || 0,
      empruntsRembourses: Number(empruntsRembourses) || 0,
      dividendesDistribues: Number(dividendesDistribues) || 0,
      interetsCourusNonEchus: Number(interetsCourusNonEchus) || 0,
    });
  }

  // Bascule la suggestion (emprunts) en mouvement réellement enregistré dès
  // l'affichage, comme pour le TAB VAR Immob — reste modifiable ensuite.
  useEffect(() => {
    if (suggestion) {
      onSaveFinancement(f.exercice, {
        capitalNumeraire: 0,
        empruntsContractes: suggestion.empruntsContractes,
        empruntsRembourses: suggestion.empruntsRembourses,
        dividendesDistribues: 0,
        interetsCourusNonEchus: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
        Exercice {f.exercice}
      </p>
      <LedgerSheet>
        <Section titre="Flux de trésorerie liés à l'exploitation">
          <Ligne label="Résultat net de l'exercice" value={f.resultatNet} />
          <SousTitre label="Ajustements pour :" />
          <Ligne label="Dotations aux amortissements et aux provisions" value={f.dotationsNettes} indent />
          <LigneInput
            label="Intérêts sur placements courus et non échus"
            value={interetsCourusNonEchus}
            onChange={setInteretsCourusNonEchus}
            onBlur={commit}
            indent
          />
          <SousTitre label="Variation des :" />
          <Ligne
            label="Clients et comptes rattachés"
            value={f.variationClients}
            indent
            help={f.variationClients === null ? "nécessite l'exercice précédent" : undefined}
          />
          <Ligne label="Autres actifs" value={f.variationAutresActifs} indent />
          <Ligne label="Fournisseurs et autres dettes" value={f.variationFournisseursAutresDettes} indent />
          <Ligne label="Modifications comptables" value={f.variationModificationsComptables} indent />
          <Total label="Flux de trésorerie provenant des opérations d'exploitation" value={f.fluxExploitation} />
        </Section>

        <Section titre="Flux de trésorerie liés à l'investissement">
          <Ligne
            label="Acquisition / Cession d'immobilisations corporelles et incorporelles"
            value={f.acquisitionCessionImmoCorpIncorp}
          />
          <Ligne label="Acquisition / Cession d'immobilisations financières" value={f.acquisitionCessionImmoFin} />
          <Total label="Flux de trésorerie affectés à des activités d'investissement" value={f.fluxInvestissement} />
        </Section>

        <Section titre="Flux de trésorerie liés aux activités de financement" last>
          <Ligne
            label="Variation des placements"
            value={f.variationPlacements}
            help={f.variationPlacements === null ? "nécessite l'exercice précédent" : undefined}
          />
          <LigneInput
            label="Encaissement suite à une augmentation de capital"
            value={capitalNumeraire}
            onChange={setCapitalNumeraire}
            onBlur={commit}
          />
          <LigneInput
            label="Distribution de dividendes"
            value={dividendesDistribues}
            onChange={setDividendesDistribues}
            onBlur={commit}
          />
          <LigneInput
            label="Emprunts contractés"
            value={empruntsContractes}
            onChange={setEmpruntsContractes}
            onBlur={commit}
            help={suggestion ? "généré depuis la balance — à vérifier" : "absent de votre document, disponible pour les clients concernés"}
          />
          <LigneInput
            label="Remboursements d'emprunts"
            value={empruntsRembourses}
            onChange={setEmpruntsRembourses}
            onBlur={commit}
            help={suggestion ? "généré depuis la balance — à vérifier" : undefined}
          />
          <Total label="Flux de trésorerie affecté à des activités de financement" value={f.fluxFinancement} />
        </Section>

        <div className="space-y-0 border-t-2 border-foreground px-[18px] py-2">
          <RowValue
            label="VARIATION DE TRÉSORERIE"
            value={f.variationTresorerie}
            bold
          />
          <RowValue label="Trésorerie au début de l'exercice" value={f.tresorerieOuverture} />
          <RowValue label="Trésorerie à la clôture de l'exercice" value={f.tresorerieCloture} bold last />
        </div>
      </LedgerSheet>
    </div>
  );
}

function Section({ titre, last, children }: { titre: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(!last && "border-b-[1.5px] border-rule-strong")}>
      <p className="bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground">
        {titre}
      </p>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SousTitre({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="px-[18px] pt-2 text-sm text-foreground">
        {label}
      </td>
    </tr>
  );
}

function Ligne({
  label,
  value,
  help,
  indent,
}: {
  label: string;
  value: number | null;
  help?: string;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={cn("px-[18px] py-1.5 text-foreground", indent && "pl-8 text-muted-foreground")}>
        {label}
        {help && <span className="ml-1.5 text-xs text-muted-foreground">({help})</span>}
      </td>
      <td className="px-[18px] py-1.5 text-right tabular-nums">
        {value === null ? NA : fmt(value)}
      </td>
    </tr>
  );
}

function LigneInput({
  label,
  value,
  onChange,
  onBlur,
  indent,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  indent?: boolean;
  help?: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={cn("px-[18px] py-1 text-foreground", indent && "pl-8 text-muted-foreground")}>
        {label}
        {help && <span className="ml-1.5 text-xs text-muted-foreground">({help})</span>}
      </td>
      <td className="px-[18px] py-1 text-right">
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

function Total({ label, value }: { label: string; value: number | null }) {
  return (
    <tr className="border-t border-border">
      <td className="px-[18px] py-1.5 font-bold text-foreground">{label}</td>
      <td className="px-[18px] py-1.5 text-right font-bold tabular-nums text-foreground">
        {value === null ? NA : fmt(value)}
      </td>
    </tr>
  );
}

function RowValue({
  label,
  value,
  bold,
  last,
}: {
  label: string;
  value: number | null;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5", !last && "border-b border-border")}>
      <p className={cn("text-sm", bold ? "font-bold text-foreground" : "text-foreground")}>{label}</p>
      <p className={cn("tabular-nums", bold ? "text-base font-bold text-foreground" : "text-sm text-foreground")}>
        {value === null ? NA : fmt(value)}
      </p>
    </div>
  );
}
