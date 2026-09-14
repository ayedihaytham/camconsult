import { useEffect, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { EmptyState } from "@/components/common/EmptyState";
import { Calculator } from "lucide-react";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { useNotes } from "@/store/notes";
import { FicheSocieteSection } from "./FicheSocieteSection";
import { PrincipesComptablesSection } from "./PrincipesComptablesSection";
import { DetailComptesSection } from "./DetailComptesSection";
import { ImmoResumeSection } from "./ImmoResumeSection";
import { NotesLibresSection } from "./NotesLibresSection";
import type { PostesExercice } from "@/store/balances";
import type { ImmoMouvement } from "@/types";

/**
 * Notes aux états financiers — étape 4. Rassemble : la fiche société
 * (réutilisée chaque année), le texte des principes comptables (modèle
 * cabinet + surcharge éventuelle), le détail par compte des principaux
 * postes (généré depuis la balance), le résumé des immobilisations, et les
 * notes narratives libres propres à l'exercice sélectionné.
 */
export function NotesView({
  societeId,
  societeName,
  exercices,
  immoMouvements,
}: {
  societeId: string;
  societeName: string;
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const [exercice, setExercice] = useState(chrono[0]?.exercice ?? "");

  useEffect(() => {
    if (!exercice && chrono[0]) setExercice(chrono[0].exercice);
  }, [chrono, exercice]);

  const modele = useNotes((s) => s.modele);
  const fetchModele = useNotes((s) => s.fetchModele);

  const fiche = useNotes((s) => s.fiche);
  const fetchFiche = useNotes((s) => s.fetchFiche);
  const clearFiche = useNotes((s) => s.clearFiche);
  const saveFiche = useNotes((s) => s.saveFiche);

  const notesExercice = useNotes((s) => s.notesExercice);
  const fetchNotesExercice = useNotes((s) => s.fetchNotesExercice);
  const clearNotesExercice = useNotes((s) => s.clearNotesExercice);
  const saveNotesExercice = useNotes((s) => s.saveNotesExercice);

  const detailComptes = useNotes((s) => s.detailComptes);
  const fetchDetailComptes = useNotes((s) => s.fetchDetailComptes);
  const clearDetailComptes = useNotes((s) => s.clearDetailComptes);

  useEffect(() => {
    fetchModele();
    fetchFiche(societeId);
    fetchDetailComptes(societeId);
    return () => {
      clearFiche();
      clearDetailComptes();
    };
  }, [societeId, fetchModele, fetchFiche, clearFiche, fetchDetailComptes, clearDetailComptes]);

  useEffect(() => {
    if (!exercice) return;
    fetchNotesExercice(societeId, exercice);
    return () => clearNotesExercice();
  }, [societeId, exercice, fetchNotesExercice, clearNotesExercice]);

  const exerciceCourant = exercices.find((e) => e.exercice === exercice);
  const listeExercices = chrono.map((e) => e.exercice);

  const isMasseNonVide = (masse: "incorporelles" | "corporelles" | "financieres") => {
    if (!exerciceCourant) return false;
    const key =
      masse === "incorporelles"
        ? "actif.immo_incorp_brut"
        : masse === "corporelles"
          ? "actif.immo_corp_brut"
          : "actif.immo_fin";
    if ((exerciceCourant.postes[key] ?? 0) !== 0) return true;
    return immoMouvements.some(
      (m) => m.exercice === exercice && m.masse === masse && (m.acquisitions || m.cessions || m.dotations || m.reprises),
    );
  };

  return (
    <div className="space-y-6">
      {fiche && <FicheSocieteSection fiche={fiche} onSave={(data) => saveFiche(societeId, data)} />}

      {modele && exerciceCourant && (
        <PrincipesComptablesSection
          modeleTexte={modele.texte}
          texteOverride={notesExercice?.texteOverride ?? ""}
          societe={societeName}
          exercice={exercice}
          onSave={(texte) =>
            saveNotesExercice(societeId, exercice, {
              texteOverride: texte,
              blocsLibres: notesExercice?.blocsLibres ?? [],
            })
          }
        />
      )}

      {chrono.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Exercice de référence pour les rubriques ci-dessous
          </p>
          <LedgerSegmented
            value={exercice}
            onChange={setExercice}
            options={chrono.map((e) => ({ value: e.exercice, label: e.exercice }))}
          />
        </div>
      )}

      {!exerciceCourant ? (
        <LedgerSheet>
          <EmptyState icon={Calculator} title="Aucune donnée" description="Importez ou saisissez une balance pour cet exercice." />
        </LedgerSheet>
      ) : (
        <>
          <SectionTitle>Actifs</SectionTitle>
          {isMasseNonVide("incorporelles") && (
            <ImmoResumeSection masse="incorporelles" titre="5.1 Immobilisations incorporelles" exerciceCourant={exerciceCourant} immoMouvements={immoMouvements} />
          )}
          {isMasseNonVide("corporelles") && (
            <ImmoResumeSection masse="corporelles" titre="5.2 Immobilisations corporelles" exerciceCourant={exerciceCourant} immoMouvements={immoMouvements} />
          )}
          {isMasseNonVide("financieres") && (
            <ImmoResumeSection masse="financieres" titre="5.3 Immobilisations financières" exerciceCourant={exerciceCourant} immoMouvements={immoMouvements} />
          )}
          <DetailComptesSection titre="5.4 Clients et comptes rattachés" poste="actif.clients" lignes={detailComptes} exercices={listeExercices} />
          <DetailComptesSection titre="5.5 Autres actifs courants" poste="actif.autres_courants" lignes={detailComptes} exercices={listeExercices} />
          <DetailComptesSection titre="5.6 Liquidités et équivalents de liquidités" poste="actif.liquidites" lignes={detailComptes} exercices={listeExercices} />

          <SectionTitle>Passifs</SectionTitle>
          <DetailComptesSection titre="6.2 Fournisseurs et comptes rattachés" poste="passif.fournisseurs" lignes={detailComptes} exercices={listeExercices} />
          <DetailComptesSection titre="6.3 Autres passifs courants" poste="passif.autres_passifs_courants" lignes={detailComptes} exercices={listeExercices} />
          <DetailComptesSection titre="6.4 Concours bancaires et autres passifs financiers" poste="passif.concours_bancaires" lignes={detailComptes} exercices={listeExercices} />

          <SectionTitle>État de résultat</SectionTitle>
          <DetailComptesSection titre="7.1 Autres charges d'exploitation" poste="cpc.charges_externes" lignes={detailComptes} exercices={listeExercices} />
          <LedgerSheet className="p-[18px]">
            <p className="text-sm font-bold text-foreground">7.2 Impôt sur les sociétés</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le mode de calcul de l'impôt sur les sociétés est présenté dans le tableau de
              détermination du résultat fiscal (onglet TDRF).
            </p>
          </LedgerSheet>

          <SectionTitle>État de flux de trésorerie</SectionTitle>
          <LedgerSheet>
            <p className="px-[18px] pt-[18px] text-sm font-bold text-foreground">8.1 Trésorerie nette</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {chrono.map((e, i) => (
                  <tr key={e.exercice} className={i === 0 ? "border-t border-border" : "border-t border-border"}>
                    <td className="px-[18px] py-1.5 text-muted-foreground">Liquidités actif au {e.exercice}</td>
                    <td className="px-[18px] py-1.5 text-right tabular-nums">{fmt(e.postes["actif.liquidites"] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </LedgerSheet>
        </>
      )}

      {exerciceCourant && notesExercice && (
        <>
          <SectionTitle>Notes narratives — exercice {exercice}</SectionTitle>
          <NotesLibresSection
            blocs={notesExercice.blocsLibres}
            onSave={(blocs) =>
              saveNotesExercice(societeId, exercice, {
                texteOverride: notesExercice.texteOverride,
                blocsLibres: blocs,
              })
            }
          />
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="pt-2 text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground">{children}</p>;
}
