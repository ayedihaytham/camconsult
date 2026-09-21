import { useEffect, useRef, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/etatsFinanciers/postes";
import {
  computeImmoVariation,
  suggestImmoMouvement,
  MASSES,
  MASSE_LABELS,
  type ImmoVariationLigne,
} from "@/lib/etatsFinanciers/immobilisations";
import type { PostesExercice } from "@/store/balances";
import type { ImmoMasse, ImmoMouvement } from "@/types";

interface MouvState {
  acquisitions: string;
  cessions: string;
  dotations: string;
  reprises: string;
}

const key = (exercice: string, masse: ImmoMasse) => `${exercice}|${masse}`;

/**
 * État de variation des immobilisations et des amortissements — un seul
 * tableau (Valeurs brutes : Ouverture/Acquisitions/Cessions/Clôture,
 * Amortissements : Ouverture/Dotations/Cessions/Clôture, VNC), tous les
 * exercices en lignes sous chaque masse, comme le document Excel de
 * référence du cabinet — pas un tableau séparé par exercice.
 */
export function ImmoVariationTable({
  exercices,
  immoMouvements,
  onSave,
  readOnlyMasses = [],
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  onSave: (
    exercice: string,
    masse: ImmoMasse,
    data: { acquisitions: number; cessions: number; dotations: number; reprises: number },
  ) => void;
  /** Masses alimentées par le registre d'immobilisations — affichées en
   * lecture seule (plus de saisie manuelle, le registre fait foi). */
  readOnlyMasses?: ImmoMasse[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));

  const lignesParExercice = new Map<string, ImmoVariationLigne[]>();
  const suggestionsParExercice = new Map<
    string,
    Map<ImmoMasse, { acquisitions: number; cessions: number; dotations: number; reprises: number } | null>
  >();
  for (const e of chrono) {
    const prevExercice =
      chrono.filter((x) => x.exercice < e.exercice).sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ??
      null;
    const lignes = computeImmoVariation(e.exercice, e.postes, prevExercice ? prevExercice.postes : null, immoMouvements);
    lignesParExercice.set(e.exercice, lignes);
    const suggestions = new Map<ImmoMasse, { acquisitions: number; cessions: number; dotations: number; reprises: number } | null>();
    for (const l of lignes) {
      const hasSaved = immoMouvements.some((m) => m.exercice === e.exercice && m.masse === l.masse);
      suggestions.set(
        l.masse,
        !hasSaved && !readOnlyMasses.includes(l.masse)
          ? suggestImmoMouvement(
              l.masse,
              e.postesDebit,
              e.postesCredit,
              prevExercice ? prevExercice.postesDebit : null,
              prevExercice ? prevExercice.postesCredit : null,
            )
          : null,
      );
    }
    suggestionsParExercice.set(e.exercice, suggestions);
  }

  const [state, setState] = useState<Record<string, MouvState>>(() =>
    buildInitialState(chrono, lignesParExercice, suggestionsParExercice),
  );

  // Ajoute l'état local des exercices/masses apparus après le premier rendu
  // sans écraser ce qui a déjà été saisi.
  useEffect(() => {
    setState((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const e of chrono) {
        for (const masse of MASSES) {
          const k = key(e.exercice, masse);
          if (k in next) continue;
          changed = true;
          const ligne = lignesParExercice.get(e.exercice)?.find((l) => l.masse === masse);
          const sug = suggestionsParExercice.get(e.exercice)?.get(masse);
          next[k] = {
            acquisitions: String((sug?.acquisitions ?? ligne?.acquisitions ?? 0) || ""),
            cessions: String((sug?.cessions ?? ligne?.cessions ?? 0) || ""),
            dotations: String((sug?.dotations ?? ligne?.dotations ?? 0) || ""),
            reprises: String((sug?.reprises ?? ligne?.reprises ?? 0) || ""),
          };
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrono.map((e) => e.exercice).join(",")]);

  // Bascule chaque suggestion en mouvement réellement enregistré dès
  // l'affichage, une seule fois par exercice+masse.
  const applied = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const [exercice, suggestions] of suggestionsParExercice) {
      for (const [masse, suggestion] of suggestions) {
        const k = key(exercice, masse);
        if (!suggestion || applied.current.has(k)) continue;
        applied.current.add(k);
        onSave(exercice, masse, suggestion);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrono.map((e) => e.exercice).join(",")]);

  function updateField(exercice: string, masse: ImmoMasse, field: keyof MouvState, value: string) {
    const k = key(exercice, masse);
    setState((s) => ({
      ...s,
      [k]: { ...(s[k] ?? { acquisitions: "", cessions: "", dotations: "", reprises: "" }), [field]: value },
    }));
  }

  function commit(exercice: string, masse: ImmoMasse) {
    const s = state[key(exercice, masse)];
    if (!s) return;
    onSave(exercice, masse, {
      acquisitions: Number(s.acquisitions) || 0,
      cessions: Number(s.cessions) || 0,
      dotations: Number(s.dotations) || 0,
      reprises: Number(s.reprises) || 0,
    });
  }

  if (chrono.length === 0) return null;

  return (
    <LedgerSheet>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground align-bottom">
                Exercice
              </th>
              <th colSpan={4} className="border-b border-border px-2 py-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                Valeurs brutes
              </th>
              <th colSpan={4} className="border-b border-l border-border px-2 py-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                Amortissements / Provisions
              </th>
              <th rowSpan={2} className="border-l border-border px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground align-bottom">
                VNC
              </th>
            </tr>
            <tr>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Ouverture</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Acquisitions</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Cessions</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Clôture</th>
              <th className="border-l border-border px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Ouverture</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Dotations</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Cessions</th>
              <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Clôture</th>
            </tr>
          </thead>
          <tbody>
            {MASSES.map((masse) => {
              const readOnly = readOnlyMasses.includes(masse);
              return (
                <MasseGroup
                  key={masse}
                  masse={masse}
                  chrono={chrono}
                  lignesParExercice={lignesParExercice}
                  readOnly={readOnly}
                  state={state}
                  onChange={updateField}
                  onCommit={commit}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </LedgerSheet>
  );
}

function buildInitialState(
  chrono: PostesExercice[],
  lignesParExercice: Map<string, ImmoVariationLigne[]>,
  suggestionsParExercice: Map<
    string,
    Map<ImmoMasse, { acquisitions: number; cessions: number; dotations: number; reprises: number } | null>
  >,
): Record<string, MouvState> {
  const out: Record<string, MouvState> = {};
  for (const e of chrono) {
    for (const masse of MASSES) {
      const ligne = lignesParExercice.get(e.exercice)?.find((l) => l.masse === masse);
      const sug = suggestionsParExercice.get(e.exercice)?.get(masse);
      out[key(e.exercice, masse)] = {
        acquisitions: String((sug?.acquisitions ?? ligne?.acquisitions ?? 0) || ""),
        cessions: String((sug?.cessions ?? ligne?.cessions ?? 0) || ""),
        dotations: String((sug?.dotations ?? ligne?.dotations ?? 0) || ""),
        reprises: String((sug?.reprises ?? ligne?.reprises ?? 0) || ""),
      };
    }
  }
  return out;
}

function MasseGroup({
  masse,
  chrono,
  lignesParExercice,
  readOnly,
  state,
  onChange,
  onCommit,
}: {
  masse: ImmoMasse;
  chrono: PostesExercice[];
  lignesParExercice: Map<string, ImmoVariationLigne[]>;
  readOnly: boolean;
  state: Record<string, MouvState>;
  onChange: (exercice: string, masse: ImmoMasse, field: keyof MouvState, value: string) => void;
  onCommit: (exercice: string, masse: ImmoMasse) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={10} className="bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground">
          {MASSE_LABELS[masse]}
          {readOnly && (
            <span className="ml-2 rounded-[4px] bg-card px-1.5 py-0.5 text-[0.62rem] font-semibold normal-case tracking-normal text-muted-foreground">
              Calculé depuis le registre
            </span>
          )}
        </td>
      </tr>
      {chrono.map((e) => {
        const ligne = lignesParExercice.get(e.exercice)?.find((l) => l.masse === masse);
        if (!ligne) return null;
        const s = state[key(e.exercice, masse)];
        const ecart = ligne.brutOuvertureEcart;
        return (
          <tr key={e.exercice} className="border-b border-border">
            <td className="px-[18px] py-1.5 text-foreground">
              {e.exercice}
              {ecart !== null && Math.abs(ecart) > 0.5 && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-[2px] bg-warning align-middle"
                  title={`Écart de ${fmt(Math.abs(ecart))} entre l'ouverture déduite et le solde brut réel de l'exercice précédent`}
                />
              )}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(ligne.brutOuverture)}</td>
            <EditableOrReadonlyCell
              readOnly={readOnly}
              value={ligne.acquisitions}
              text={s?.acquisitions ?? ""}
              onChange={(v) => onChange(e.exercice, masse, "acquisitions", v)}
              onBlur={() => onCommit(e.exercice, masse)}
            />
            <EditableOrReadonlyCell
              readOnly={readOnly}
              value={ligne.cessions}
              text={s?.cessions ?? ""}
              onChange={(v) => onChange(e.exercice, masse, "cessions", v)}
              onBlur={() => onCommit(e.exercice, masse)}
            />
            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(ligne.brutCloture)}</td>
            <td className="border-l border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(ligne.amortOuverture)}</td>
            <EditableOrReadonlyCell
              readOnly={readOnly}
              value={ligne.dotations}
              text={s?.dotations ?? ""}
              onChange={(v) => onChange(e.exercice, masse, "dotations", v)}
              onBlur={() => onCommit(e.exercice, masse)}
            />
            <EditableOrReadonlyCell
              readOnly={readOnly}
              value={ligne.reprises}
              text={s?.reprises ?? ""}
              onChange={(v) => onChange(e.exercice, masse, "reprises", v)}
              onBlur={() => onCommit(e.exercice, masse)}
            />
            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(ligne.amortCloture)}</td>
            <td className="border-l border-border px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">
              {fmt(ligne.netCloture)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function EditableOrReadonlyCell({
  readOnly,
  value,
  text,
  onChange,
  onBlur,
}: {
  readOnly: boolean;
  value: number;
  text: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  if (readOnly) {
    return <td className="px-2 py-1.5 text-right tabular-nums">{fmt(value)}</td>;
  }
  return (
    <td className="px-1 py-1 text-right">
      <Input
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        className="ml-auto h-7 w-24 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
      />
    </td>
  );
}
