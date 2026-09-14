import { useEffect, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Substitue les jetons du modèle par les valeurs de la société/exercice en
 * cours — voir le modèle par défaut inséré dans schema.sql. */
export function substituteTokens(texte: string, societe: string, exercice: string) {
  return texte
    .split("{{SOCIETE}}").join(societe || "la société")
    .split("{{EXERCICE}}").join(exercice)
    .split("{{DATE_CLOTURE}}").join(exercice ? `31 décembre ${exercice}` : "la clôture");
}

/**
 * Texte des principes comptables (sections « Présentation des états
 * financiers » / « Respect des normes » / « Bases de mesure »). Un modèle
 * unique du cabinet est prérempli automatiquement ; une société/exercice
 * peut le surcharger si un client a une particularité.
 */
export function PrincipesComptablesSection({
  modeleTexte,
  texteOverride,
  societe,
  exercice,
  onSave,
}: {
  modeleTexte: string;
  texteOverride: string;
  societe: string;
  exercice: string;
  onSave: (texteOverride: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(texteOverride || substituteTokens(modeleTexte, societe, exercice));

  useEffect(() => {
    setDraft(texteOverride || substituteTokens(modeleTexte, societe, exercice));
  }, [texteOverride, modeleTexte, societe, exercice]);

  const displayed = texteOverride || substituteTokens(modeleTexte, societe, exercice);
  const isOverride = Boolean(texteOverride);

  return (
    <LedgerSheet className="p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          Présentation des états financiers, normes et principes comptables
          {isOverride && <span className="ml-2 text-xs font-normal text-muted-foreground">(personnalisé pour cet exercice)</span>}
        </p>
        <div className="flex gap-2">
          {isOverride && !editing && (
            <Button variant="outline" size="sm" onClick={() => onSave("")}>
              Revenir au modèle du cabinet
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(displayed); }}>
                Annuler
              </Button>
              <Button
                variant="ledger"
                size="sm"
                onClick={() => {
                  onSave(draft === substituteTokens(modeleTexte, societe, exercice) ? "" : draft);
                  setEditing(false);
                }}
              >
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[360px] font-mono text-xs" />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{displayed}</p>
      )}
    </LedgerSheet>
  );
}
